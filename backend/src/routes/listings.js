const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');
const { computeCurrentPrice } = require('../services/priceDecay');
const { haversine } = require('../utils/haversine');
const { checkAndTriggerFallback, acceptRequest } = require('../services/recyclerFallback');
const { checkBatchEligibility } = require('../services/bulkBatching');

// ---------------------------------------------------------------------------
// Allowed fields for listing creation
// ---------------------------------------------------------------------------
const LISTING_FIELDS = [
  'material_type',
  'sub_grade',
  'contamination_pct',
  'quantity',
  'unit',
  'condition',
  'photo_url',
  'list_price',
  'price_floor',
  'pickup_lat',
  'pickup_long',
];

const SELLER_ROLES = ['manufacturer', 'retailer'];

// ---------------------------------------------------------------------------
// POST /api/listings — Create a new listing (seller only)
// ---------------------------------------------------------------------------
router.post('/', requireAuth, async (req, res) => {
  try {
    // Role gate: only manufacturers and retailers can list
    if (!req.profile || !SELLER_ROLES.includes(req.profile.role)) {
      return res.status(403).json({ error: 'Only manufacturers and retailers can create listings' });
    }

    // Pick allowed fields from the body
    const payload = {};
    for (const field of LISTING_FIELDS) {
      if (req.body[field] !== undefined) {
        payload[field] = req.body[field];
      }
    }

    // Required field validation
    if (!payload.material_type || payload.list_price == null || payload.price_floor == null) {
      return res.status(400).json({ error: 'material_type, list_price, and price_floor are required' });
    }

    payload.seller_id = req.user.id;
    payload.decay_window_seconds = config.DECAY_WINDOW_SECONDS;
    payload.status = 'open';

    const { data, error } = await supabase
      .from('listings')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Insert listing error:', error);
      return res.status(500).json({ error: 'Failed to create listing' });
    }

    return res.status(201).json(data);
  } catch (err) {
    console.error('POST /api/listings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/listings — Browse / search open listings (no auth required)
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const {
      material_type,
      max_distance_km,
      buyer_lat,
      buyer_long,
      min_quantity,
    } = req.query;

    // Base query: open listings, newest first
    let query = supabase
      .from('listings')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    // Server-side filter: material type
    if (material_type) {
      query = query.eq('material_type', material_type);
    }

    // Server-side filter: minimum quantity
    if (min_quantity) {
      query = query.gte('quantity', parseFloat(min_quantity));
    }

    const { data: listings, error } = await query;

    if (error) {
      console.error('Fetch listings error:', error);
      return res.status(500).json({ error: 'Failed to fetch listings' });
    }

    const hasBuyerLocation =
      buyer_lat !== undefined && buyer_long !== undefined;
    const parsedBuyerLat = hasBuyerLocation ? parseFloat(buyer_lat) : null;
    const parsedBuyerLong = hasBuyerLocation ? parseFloat(buyer_long) : null;
    const parsedMaxDistance = max_distance_km
      ? parseFloat(max_distance_km)
      : null;

    // Enrich each listing
    let enriched = listings.map((listing) => {
      const current_price = computeCurrentPrice(listing);
      const entry = { ...listing, current_price };

      // Distance computation when buyer location is provided
      if (hasBuyerLocation && listing.pickup_lat != null && listing.pickup_long != null) {
        entry.distance_km = Math.round(
          haversine(parsedBuyerLat, parsedBuyerLong, listing.pickup_lat, listing.pickup_long) * 100
        ) / 100;
      }

      return entry;
    });

    // Filter by max_distance_km (application-side, requires buyer location)
    if (hasBuyerLocation && parsedMaxDistance != null) {
      enriched = enriched.filter(
        (l) => l.distance_km !== undefined && l.distance_km <= parsedMaxDistance
      );
    }

    // Fire-and-forget: recycler fallback + batch eligibility checks
    // These are lazy evaluations — they may mutate listing status in the DB
    // but we don't await them to keep the response fast.
    for (const listing of enriched) {
      checkAndTriggerFallback(listing).catch((err) =>
        console.error('Fallback check error for listing', listing.id, err)
      );
      checkBatchEligibility(listing).catch((err) =>
        console.error('Batch eligibility check error for listing', listing.id, err)
      );
    }

    return res.status(200).json(enriched);
  } catch (err) {
    console.error('GET /api/listings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/listings/:id — Single listing detail (no auth required)
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: listing, error } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Enrich with current decayed price
    listing.current_price = computeCurrentPrice(listing);

    // Lazy side-effects: recycler fallback + batch eligibility
    checkAndTriggerFallback(listing).catch((err) =>
      console.error('Fallback check error for listing', id, err)
    );
    checkBatchEligibility(listing).catch((err) =>
      console.error('Batch eligibility check error for listing', id, err)
    );

    return res.status(200).json(listing);
  } catch (err) {
    console.error('GET /api/listings/:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/listings/:id — Update listing (owner only, while open)
// ---------------------------------------------------------------------------
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch existing listing
    const { data: existing, error: fetchError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Owner check
    if (existing.seller_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only update your own listings' });
    }

    // Status gate
    if (existing.status !== 'open') {
      return res.status(400).json({ error: 'Only open listings can be updated' });
    }

    // Pick allowed update fields
    const updates = {};
    for (const field of LISTING_FIELDS) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update listing error:', error);
      return res.status(500).json({ error: 'Failed to update listing' });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('PATCH /api/listings/:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/listings/:id/requests — Create a purchase request (buyer only)
// ---------------------------------------------------------------------------
router.post('/:id/requests', requireAuth, async (req, res) => {
  try {
    // Only buyers (recycler role) can create requests
    const buyerRoles = ['recycler'];
    if (!req.profile || !buyerRoles.includes(req.profile.role)) {
      return res.status(403).json({ error: 'Only buyers (recyclers) can create requests' });
    }

    const { id: listingId } = req.params;

    // Fetch the listing
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.status !== 'open') {
      return res.status(400).json({ error: 'Listing is no longer open' });
    }

    // Create the pending request
    const { data: request, error: reqError } = await supabase
      .from('requests')
      .insert({
        listing_id: listingId,
        buyer_id: req.user.id,
        status: 'pending',
      })
      .select()
      .single();

    if (reqError) {
      console.error('Insert request error:', reqError);
      return res.status(500).json({ error: 'Failed to create request' });
    }

    // Check the seller's auto_accept flag
    const { data: seller } = await supabase
      .from('users')
      .select('auto_accept')
      .eq('id', listing.seller_id)
      .single();

    if (seller && seller.auto_accept) {
      try {
        await acceptRequest(request.id, listing);
        // Re-fetch the request to reflect the updated status
        const { data: updatedRequest } = await supabase
          .from('requests')
          .select('*')
          .eq('id', request.id)
          .single();

        return res.status(201).json(updatedRequest || request);
      } catch (acceptErr) {
        console.error('Auto-accept failed:', acceptErr);
        // Still return the pending request even if auto-accept fails
        return res.status(201).json(request);
      }
    }

    return res.status(201).json(request);
  } catch (err) {
    console.error('POST /api/listings/:id/requests error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
