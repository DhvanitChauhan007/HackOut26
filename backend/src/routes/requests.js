const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { requireAuth } = require('../middleware/auth');
const { acceptRequest } = require('../services/recyclerFallback');

const VALID_STATUSES = ['accepted', 'declined'];

/**
 * PATCH /api/requests/:id
 * Seller accepts or declines a request on their listing.
 */
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `status is required and must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    // Fetch the request
    const { data: request, error: reqError } = await supabase
      .from('requests')
      .select('*')
      .eq('id', id)
      .single();

    if (reqError || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request has already been processed' });
    }

    // Fetch the listing to verify seller ownership
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', request.listing_id)
      .single();

    if (listingError || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.seller_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the listing seller can manage requests' });
    }

    // --- Accept ---
    if (status === 'accepted') {
      const { transaction, request: updatedRequest } = await acceptRequest(id, listing);
      return res.status(200).json({ request: updatedRequest, transaction });
    }

    // --- Decline ---
    const { data: declined, error: declineError } = await supabase
      .from('requests')
      .update({ status: 'declined' })
      .eq('id', id)
      .select()
      .single();

    if (declineError) {
      console.error('Decline request error:', declineError);
      return res.status(500).json({ error: 'Failed to decline request' });
    }

    return res.status(200).json({ request: declined });
  } catch (err) {
    console.error('PATCH /api/requests/:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
