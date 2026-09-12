const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /api/impact/summary
 * Aggregate impact metrics across all completed transactions for the current user.
 */
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Find any bulk lots the user contributed to
    const { data: userItems } = await supabase
      .from('bulk_lot_items')
      .select('bulk_lot_id, quantity')
      .eq('seller_id', userId);
      
    const userBulkItems = userItems || [];
    const bulkLotIds = [...new Set(userBulkItems.map(i => i.bulk_lot_id))];

    // Fetch completed transactions (joined with listing and bulk_lot for prices)
    let query = supabase
      .from('transactions')
      .select('*, listing:listings(list_price), bulk_lot:bulk_lots(total_quantity, bulk_rate_per_kg)')
      .eq('status', 'completed');
      
    if (bulkLotIds.length > 0) {
      query = query.or(`buyer_id.eq.${userId},seller_id.eq.${userId},bulk_lot_id.in.(${bulkLotIds.join(',')})`);
    } else {
      query = query.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error('Fetch impact transactions error:', error);
      return res.status(500).json({ error: 'Failed to fetch transactions' });
    }

    let totalKgDiverted = 0;
    let totalCo2eAvoided = 0;
    let totalCostSavings = 0;

    for (const txn of transactions) {
       let isBuyer = txn.buyer_id === userId;
       let isSingleSeller = txn.seller_id === userId;
       let isBulkSeller = txn.bulk_lot_id && bulkLotIds.includes(txn.bulk_lot_id);

       if (isBuyer) {
         totalKgDiverted += parseFloat(txn.impact_kg_diverted || 0);
         totalCo2eAvoided += parseFloat(txn.impact_co2e_kg || 0);
         totalCostSavings += parseFloat(txn.estimated_cost || 0);
       } else if (isSingleSeller) {
         totalKgDiverted += parseFloat(txn.impact_kg_diverted || 0);
         totalCo2eAvoided += parseFloat(txn.impact_co2e_kg || 0);
         if (txn.listing && txn.listing.list_price) {
           totalCostSavings += parseFloat(txn.listing.list_price);
         }
       } else if (isBulkSeller) {
         const contributedItems = userBulkItems.filter(i => i.bulk_lot_id === txn.bulk_lot_id);
         const userQty = contributedItems.reduce((sum, i) => sum + parseFloat(i.quantity || 0), 0);
         
         const totalLotQty = txn.bulk_lot && txn.bulk_lot.total_quantity ? parseFloat(txn.bulk_lot.total_quantity) : 1;
         const portion = userQty / totalLotQty;
         
         totalKgDiverted += parseFloat(txn.impact_kg_diverted || 0) * portion;
         totalCo2eAvoided += parseFloat(txn.impact_co2e_kg || 0) * portion;
         
         if (txn.bulk_lot && txn.bulk_lot.bulk_rate_per_kg) {
            totalCostSavings += parseFloat(txn.bulk_lot.bulk_rate_per_kg) * userQty;
         }
       }
    }

    return res.status(200).json({
      total_kg_diverted: Math.round(totalKgDiverted * 100) / 100,
      total_co2e_avoided: Math.round(totalCo2eAvoided * 100) / 100,
      total_cost_savings: Math.round(totalCostSavings * 100) / 100,
      transaction_count: transactions.length,
    });
  } catch (err) {
    console.error('GET /api/impact/summary error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
