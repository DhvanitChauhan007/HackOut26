const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { requireAuth } = require('../middleware/auth');
const { haversine } = require('../utils/haversine');
const config = require('../config');

// Lazy-import to avoid circular-dep issues if bulkBatching is defined later
let _checkFormingLotTimeouts;
function getCheckFormingLotTimeouts() {
  if (!_checkFormingLotTimeouts) {
    try {
      const bulkBatching = require('../services/bulkBatching');
      _checkFormingLotTimeouts = bulkBatching.checkFormingLotTimeouts;
    } catch {
      // Service not yet implemented — silently skip
      _checkFormingLotTimeouts = async () => {};
    }
  }
  return _checkFormingLotTimeouts;
}

// ────────────────────────────────────────────────────────────
// GET /api/bulk-lots
// Public — list open bulk lots with optional filters
// ────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { material_type, max_distance_km, buyer_lat, buyer_long } = req.query;

    // Lazy cleanup of expired forming lots
    const checkTimeouts = getCheckFormingLotTimeouts();
    checkTimeouts().catch((err) =>
      console.error('checkFormingLotTimeouts error:', err)
    );

    // Build query — only open lots
    let query = supabase.from('bulk_lots').select('*').eq('status', 'open');

    if (material_type) {
      query = query.eq('material_type', material_type);
    }

    const { data: lots, error } = await query;

    if (error) {
      console.error('Fetch bulk_lots error:', error);
      return res.status(500).json({ error: 'Failed to fetch bulk lots' });
    }

    // For each lot, fetch items to compute centroid & item_count
    const enriched = await Promise.all(
      lots.map(async (lot) => {
        const { data: items, error: itemsErr } = await supabase
          .from('bulk_lot_items')
          .select('pickup_lat, pickup_long')
          .eq('bulk_lot_id', lot.id);

        if (itemsErr) {
          console.error(`Fetch items for lot ${lot.id} error:`, itemsErr);
          return null;
        }

        const item_count = items.length;

        // Compute centroid from pickup coords
        let centroid_lat = null;
        let centroid_long = null;

        const validCoords = items.filter(
          (i) => i.pickup_lat != null && i.pickup_long != null
        );

        if (validCoords.length > 0) {
          centroid_lat =
            validCoords.reduce((sum, i) => sum + i.pickup_lat, 0) /
            validCoords.length;
          centroid_long =
            validCoords.reduce((sum, i) => sum + i.pickup_long, 0) /
            validCoords.length;
        }

        const total_price =
          parseFloat(lot.bulk_rate_per_kg) * parseFloat(lot.total_quantity);

        return {
          id: lot.id,
          material_type: lot.material_type,
          sub_grade: lot.sub_grade,
          status: lot.status,
          total_quantity: lot.total_quantity,
          bulk_rate_per_kg: lot.bulk_rate_per_kg,
          total_price,
          item_count,
          centroid_lat,
          centroid_long,
          created_at: lot.created_at,
        };
      })
    );

    // Drop any lots that failed to enrich
    let results = enriched.filter(Boolean);

    // Distance filtering
    const hasBuyerCoords =
      buyer_lat != null &&
      buyer_long != null &&
      !isNaN(parseFloat(buyer_lat)) &&
      !isNaN(parseFloat(buyer_long));

    if (hasBuyerCoords) {
      const bLat = parseFloat(buyer_lat);
      const bLong = parseFloat(buyer_long);
      const maxDist = max_distance_km ? parseFloat(max_distance_km) : null;

      results = results
        .map((lot) => {
          if (lot.centroid_lat == null || lot.centroid_long == null) {
            return { ...lot, distance_km: null };
          }
          const distance_km = haversine(
            bLat,
            bLong,
            lot.centroid_lat,
            lot.centroid_long
          );
          return { ...lot, distance_km: Math.round(distance_km * 100) / 100 };
        })
        .filter((lot) => {
          if (maxDist != null && lot.distance_km != null) {
            return lot.distance_km <= maxDist;
          }
          return true;
        });
    }

    return res.status(200).json({ lots: results });
  } catch (err) {
    console.error('GET /api/bulk-lots error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/bulk-lots/:id
// Public — single lot detail (no seller identities)
// ────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: lot, error } = await supabase
      .from('bulk_lots')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !lot) {
      return res.status(404).json({ error: 'Bulk lot not found' });
    }

    // Fetch item count (don't expose seller_id or listing_id)
    const { data: items, error: itemsErr } = await supabase
      .from('bulk_lot_items')
      .select('id')
      .eq('bulk_lot_id', lot.id);

    if (itemsErr) {
      console.error(`Fetch items for lot ${id} error:`, itemsErr);
      return res.status(500).json({ error: 'Failed to fetch lot items' });
    }

    const total_price =
      parseFloat(lot.bulk_rate_per_kg) * parseFloat(lot.total_quantity);

    return res.status(200).json({
      id: lot.id,
      material_type: lot.material_type,
      sub_grade: lot.sub_grade,
      total_quantity: lot.total_quantity,
      bulk_rate_per_kg: lot.bulk_rate_per_kg,
      total_price,
      item_count: items.length,
      status: lot.status,
      created_at: lot.created_at,
    });
  } catch (err) {
    console.error('GET /api/bulk-lots/:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/bulk-lots/:id/purchase
// Auth required (buyer role) — auto-complete bulk purchase
// ────────────────────────────────────────────────────────────
router.post('/:id/purchase', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Role check — only buyers (manufacturers / retailers) can purchase
    if (
      !req.profile ||
      !['manufacturer', 'retailer'].includes(req.profile.role)
    ) {
      return res
        .status(403)
        .json({ error: 'Only buyers (manufacturer/retailer) can purchase bulk lots' });
    }

    // Fetch the lot
    const { data: lot, error: lotErr } = await supabase
      .from('bulk_lots')
      .select('*')
      .eq('id', id)
      .single();

    if (lotErr || !lot) {
      return res.status(404).json({ error: 'Bulk lot not found' });
    }

    if (lot.status !== 'open') {
      return res
        .status(409)
        .json({ error: `Lot is not open for purchase (current status: ${lot.status})` });
    }

    // ── Step a: Set lot status → claimed ──
    const { error: lotUpdateErr } = await supabase
      .from('bulk_lots')
      .update({ status: 'claimed' })
      .eq('id', id);

    if (lotUpdateErr) {
      console.error('Update lot status error:', lotUpdateErr);
      return res.status(500).json({ error: 'Failed to claim lot' });
    }

    // ── Step b: Set all contributing listings → claimed ──
    const { data: items, error: itemsErr } = await supabase
      .from('bulk_lot_items')
      .select('listing_id')
      .eq('bulk_lot_id', id);

    if (itemsErr) {
      console.error('Fetch lot items error:', itemsErr);
      return res.status(500).json({ error: 'Failed to fetch lot items' });
    }

    const listingIds = items.map((i) => i.listing_id);

    if (listingIds.length > 0) {
      const { error: listingsUpdateErr } = await supabase
        .from('listings')
        .update({ status: 'claimed' })
        .in('id', listingIds);

      if (listingsUpdateErr) {
        console.error('Update listings status error:', listingsUpdateErr);
        return res.status(500).json({ error: 'Failed to claim listings' });
      }
    }

    // ── Step c: Create transaction ──
    const total_price =
      parseFloat(lot.bulk_rate_per_kg) * parseFloat(lot.total_quantity);

    const { data: transaction, error: txErr } = await supabase
      .from('transactions')
      .insert({
        bulk_lot_id: id,
        listing_id: null,
        seller_id: null,
        buyer_id: req.user.id,
        status: 'pending',
        estimated_cost: total_price,
      })
      .select()
      .single();

    if (txErr) {
      console.error('Create transaction error:', txErr);
      return res.status(500).json({ error: 'Failed to create transaction' });
    }

    return res.status(201).json(transaction);
  } catch (err) {
    console.error('POST /api/bulk-lots/:id/purchase error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
