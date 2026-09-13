import express from 'express';
import { supabaseAdmin } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { getDistanceKm } from './sharedRoutes.js';
import { geocodeAddress } from '../services/geocoding.js';

const router = express.Router();

// 1. Request a listing
router.post('/listings/:id/requests', requireAuth, async (req, res) => {
  const listingId = req.params.id;
  const buyerId = req.user.id;

  try {
    // Check if request already exists
    const { data: existing } = await supabaseAdmin
      .from('requests')
      .select('*')
      .eq('listing_id', listingId)
      .eq('buyer_id', buyerId)
      .maybeSingle();

    if (existing) {
      return res.json(existing);
    }

    const { data, error } = await supabaseAdmin
      .from('requests')
      .insert({ listing_id: listingId, buyer_id: buyerId, status: 'pending' })
      .select()
      .single();

    if (error) {
      console.error('Error inserting request:', error);
      return res.status(400).json({ error: error.message });
    }
    res.json(data);
  } catch (err) {
    console.error('Unexpected error in request listing:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Estimate cost with dynamic distance calculation
router.post('/transactions/:id/estimate', requireAuth, async (req, res) => {
  const transactionId = req.params.id;
  
  const { data: trxRecord } = await supabaseAdmin
    .from('transactions')
    .select('*, listings(*, users:seller_id(*)), buyer:buyer_id(*)')
    .eq('id', transactionId)
    .single();

  const pickupLocation = trxRecord?.listings?.condition?.split('|')?.[1]?.replace('Pickup:', '')?.trim() ||
                         trxRecord?.listings?.users?.address ||
                         'DAIICT, Gandhinagar';
  const dropoffLocation = trxRecord?.buyer?.address || 'Hebbal Facility, Bengaluru';

  let pickupLat = trxRecord?.listings?.pickup_lat || trxRecord?.listings?.users?.lat;
  let pickupLong = trxRecord?.listings?.pickup_long || trxRecord?.listings?.users?.long;
  let dropoffLat = trxRecord?.buyer?.lat;
  let dropoffLong = trxRecord?.buyer?.long;

  if (pickupLat == null || pickupLong == null) {
    const pCoords = await geocodeAddress(pickupLocation);
    if (pCoords) {
      pickupLat = pCoords.lat;
      pickupLong = pCoords.long;
    }
  }

  if (dropoffLat == null || dropoffLong == null) {
    const dCoords = await geocodeAddress(dropoffLocation);
    if (dCoords) {
      dropoffLat = dCoords.lat;
      dropoffLong = dCoords.long;
    }
  }

  const pLat = pickupLat != null ? parseFloat(pickupLat) : 23.188408;
  const pLon = pickupLong != null ? parseFloat(pickupLong) : 72.627969;
  const dLat = dropoffLat != null ? parseFloat(dropoffLat) : 21.145022;
  const dLon = dropoffLong != null ? parseFloat(dropoffLong) : 72.757319;

  const distanceKm = getDistanceKm(pLat, pLon, dLat, dLon);
  const estimatedCost = Math.max(1200, Math.round(distanceKm * 85));

  const { data, error } = await supabaseAdmin
    .from('transactions')
    .update({ 
      distance_km: distanceKm, 
      estimated_cost: estimatedCost, 
      status: 'estimated' 
    })
    .eq('id', transactionId)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 3. Commit transaction
router.post('/transactions/:id/commit', requireAuth, async (req, res) => {
  const transactionId = req.params.id;

  // Mark transaction as committed
  const { data: trx, error: trxError } = await supabaseAdmin
    .from('transactions')
    .update({ status: 'committed' })
    .eq('id', transactionId)
    .select('*, listings(*, users:seller_id(*)), buyer:buyer_id(*)')
    .single();

  if (trxError) return res.status(400).json({ error: trxError.message });

  const pickupLocation = trx.listings?.condition?.split('|')?.[1]?.replace('Pickup:', '')?.trim() ||
                         trx.listings?.users?.address ||
                         'DAIICT, Gandhinagar';
  const dropoffLocation = trx.buyer?.address || 'Hebbal Facility, Bengaluru';

  let pickupLat = trx.listings?.pickup_lat || trx.listings?.users?.lat;
  let pickupLong = trx.listings?.pickup_long || trx.listings?.users?.long;
  let dropoffLat = trx.buyer?.lat;
  let dropoffLong = trx.buyer?.long;

  if (pickupLat == null || pickupLong == null) {
    const pCoords = await geocodeAddress(pickupLocation);
    if (pCoords) {
      pickupLat = pCoords.lat;
      pickupLong = pCoords.long;
    }
  }

  if (dropoffLat == null || dropoffLong == null) {
    const dCoords = await geocodeAddress(dropoffLocation);
    if (dCoords) {
      dropoffLat = dCoords.lat;
      dropoffLong = dCoords.long;
    }
  }

  const pLat = pickupLat != null ? parseFloat(pickupLat) : 23.188408;
  const pLon = pickupLong != null ? parseFloat(pickupLong) : 72.627969;
  const dLat = dropoffLat != null ? parseFloat(dropoffLat) : 21.145022;
  const dLon = dropoffLong != null ? parseFloat(dropoffLong) : 72.757319;

  const distanceKm = trx.distance_km || getDistanceKm(pLat, pLon, dLat, dLon);
  const durationMin = Math.max(10, Math.round((distanceKm / 45) * 60));
  const estimatedCost = trx.estimated_cost || Math.max(1200, Math.round(distanceKm * 85));

  // Create a job for logistics with accurate coordinates and location labels
  const { error: jobError } = await supabaseAdmin
    .from('jobs')
    .insert({
      transaction_id: transactionId,
      pickup_lat: pLat,
      pickup_long: pLon,
      dropoff_lat: dLat,
      dropoff_long: dLon,
      distance_km: distanceKm,
      estimated_cost: estimatedCost,
      duration_min: durationMin,
      pickup_location: pickupLocation,
      dropoff_location: dropoffLocation,
      status: 'open'
    });

  if (jobError) return res.status(400).json({ error: jobError.message });
  res.json(trx);
});

// 4. Rate a transaction
router.post('/transactions/:id/ratings', requireAuth, async (req, res) => {
  const { ratee_id, rating, comment } = req.body;
  const transactionId = req.params.id;

  const { data, error } = await supabaseAdmin
    .from('ratings')
    .insert({
      transaction_id: transactionId,
      rater_id: req.user.id,
      ratee_id,
      rating,
      comment
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 5. Purchase Bulk Lot directly
router.post('/bulk-lots/:id/purchase', requireAuth, async (req, res) => {
  const bulkLotId = req.params.id;
  
  await supabaseAdmin.from('bulk_lots').update({ status: 'claimed' }).eq('id', bulkLotId);
  
  const { data: trx, error } = await supabaseAdmin
    .from('transactions')
    .insert({
      bulk_lot_id: bulkLotId,
      buyer_id: req.user.id,
      status: 'committed'
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // Look up contributing items
  const { data: items } = await supabaseAdmin
    .from('bulk_lot_items')
    .select('*')
    .eq('bulk_lot_id', bulkLotId);

  // Look up buyer coordinates
  const { data: buyer } = await supabaseAdmin.from('users').select('lat, long, address').eq('id', req.user.id).single();
  let dropoffLat = buyer?.lat;
  let dropoffLong = buyer?.long;
  if ((dropoffLat == null || dropoffLong == null) && buyer?.address) {
    const coords = await geocodeAddress(buyer.address);
    if (coords) {
      dropoffLat = coords.lat;
      dropoffLong = coords.long;
    }
  }
  dropoffLat = dropoffLat != null ? parseFloat(dropoffLat) : 21.145022;
  dropoffLong = dropoffLong != null ? parseFloat(dropoffLong) : 72.757319;

  // Create multi-stop job for logistics with dynamically chained distance
  let totalKm = 0;
  let prevLat = items?.[0]?.pickup_lat || 13.0285;
  let prevLong = items?.[0]?.pickup_long || 77.5197;
  for (let i = 1; i < (items?.length || 0); i++) {
    const curLat = items[i].pickup_lat || prevLat;
    const curLong = items[i].pickup_long || prevLong;
    totalKm += getDistanceKm(prevLat, prevLong, curLat, curLong);
    prevLat = curLat;
    prevLong = curLong;
  }
  totalKm += getDistanceKm(prevLat, prevLong, dropoffLat, dropoffLong);
  const distanceKm = Math.max(2.5, Math.round(totalKm * 10) / 10);
  const durationMin = Math.max(15, Math.round((distanceKm / 40) * 60));
  const estimatedCost = Math.max(1500, Math.round(distanceKm * 85 + (items?.length || 1) * 350));

  const firstStop = items?.[0];
  const { data: job } = await supabaseAdmin
    .from('jobs')
    .insert({
      transaction_id: trx.id,
      pickup_lat: firstStop?.pickup_lat || 13.0285,
      pickup_long: firstStop?.pickup_long || 77.5197,
      dropoff_lat: dropoffLat,
      dropoff_long: dropoffLong,
      distance_km: distanceKm,
      estimated_cost: estimatedCost,
      duration_min: durationMin,
      pickup_location: 'Multi-Seller Waypoint Pool',
      dropoff_location: buyer?.address || 'Hebbal Facility, Bengaluru',
      status: 'open'
    })
    .select()
    .single();

  // Insert sequential job_stops
  if (job && items?.length) {
    const stopsToInsert = items.map((item, idx) => ({
      job_id: job.id,
      listing_id: item.listing_id,
      seller_id: item.seller_id,
      pickup_lat: item.pickup_lat,
      pickup_long: item.pickup_long,
      seq_order: idx + 1
    }));
    await supabaseAdmin.from('job_stops').insert(stopsToInsert);
  }

  res.json(trx);
});

// 6. Impact Summary — from accepted requests + committed/completed transactions
router.get('/impact/summary', requireAuth, async (req, res) => {
  const EMISSION_FACTORS = {
    cardboard: 2.46, occ: 2.46, paper: 2.46, duplex: 2.46,
    plastic: 3.14, pet: 3.14, hdpe: 1.93, ldpe: 2.25, film: 2.25,
    pallets: 0.91, wood: 0.91, timber: 0.91,
    metal: 1.78, aluminium: 9.1, steel: 1.78,
    glass: 0.31,
  };
  const getEmissionFactor = (materialType = '') => {
    const m = materialType.toLowerCase().trim();
    for (const [key, factor] of Object.entries(EMISSION_FACTORS)) {
      if (m.includes(key)) return factor;
    }
    return 1.5;
  };

  try {
    // Source 1: accepted requests for this buyer → listing quantity
    const { data: acceptedRequests } = await supabaseAdmin
      .from('requests')
      .select('listing_id, listings(quantity, material_type)')
      .eq('buyer_id', req.user.id)
      .eq('status', 'accepted');

    // Source 2: committed/completed transactions (buyer OR seller)
    const { data: transactions } = await supabaseAdmin
      .from('transactions')
      .select('impact_kg_diverted, impact_co2e_kg, estimated_cost, listings(quantity, material_type), bulk_lots(total_quantity, material_type)')
      .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`)
      .in('status', ['committed', 'completed']);

    // Source 3: seller's claimed listings
    const { data: claimedListings } = await supabaseAdmin
      .from('listings')
      .select('quantity, material_type')
      .eq('seller_id', req.user.id)
      .in('status', ['claimed', 'completed']);

    let totalKg = 0;
    let totalCo2e = 0;
    let totalSavings = 0;
    const seenListingIds = new Set();

    // Process accepted requests (most reliable for buyer data)
    for (const r of acceptedRequests || []) {
      const kg = Number(r.listings?.quantity ?? 0);
      const mat = r.listings?.material_type || '';
      totalKg += kg;
      totalCo2e += kg * getEmissionFactor(mat);
      if (r.listing_id) seenListingIds.add(r.listing_id);
    }

    // Process transactions (add only if not already counted via request)
    for (const t of transactions || []) {
      const listingId = t.listing_id;
      if (listingId && seenListingIds.has(listingId)) continue; // avoid double-count

      let kg = Number(t.impact_kg_diverted ?? 0);
      if (kg === 0) kg = Number(t.listings?.quantity ?? t.bulk_lots?.total_quantity ?? 0);

      let co2e = Number(t.impact_co2e_kg ?? 0);
      if (co2e === 0 && kg > 0) {
        const mat = t.listings?.material_type || t.bulk_lots?.material_type || '';
        co2e = kg * getEmissionFactor(mat);
      }

      totalKg += kg;
      totalCo2e += co2e;
      totalSavings += Number(t.estimated_cost ?? 0);
      if (listingId) seenListingIds.add(listingId);
    }

    // Process seller's claimed listings
    for (const l of claimedListings || []) {
      const kg = Number(l.quantity ?? 0);
      const mat = l.material_type || '';
      totalKg += kg;
      totalCo2e += kg * getEmissionFactor(mat);
    }

    res.json({
      total_kg_diverted: Math.round(totalKg),
      total_co2e_avoided: Math.round(totalCo2e * 10) / 10,
      total_savings: Math.round(totalSavings),
      transaction_count: (acceptedRequests?.length || 0) + (transactions?.length || 0),
    });
  } catch (err) {
    console.error('Impact summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions
router.get('/transactions', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('*, listings(*, users(name, address)), seller:seller_id(name, address), jobs(*, users:logistics_company_id(name))')
    .eq('buyer_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/requests
router.get('/requests', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('requests')
    .select('*, listings(*, users(name, address))')
    .eq('buyer_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// DELETE /api/requests/:id - Buyer opt-out of pending reservation
router.delete('/requests/:id', requireAuth, async (req, res) => {
  const requestId = req.params.id;
  try {
    const { data: request, error: findError } = await supabaseAdmin
      .from('requests')
      .select('id, status, buyer_id')
      .eq('id', requestId)
      .single();

    if (findError || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.buyer_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to delete this request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Cannot opt out of a request that is already accepted or completed' });
    }

    const { error: delError } = await supabaseAdmin
      .from('requests')
      .delete()
      .eq('id', requestId);

    if (delError) {
      console.error('Error deleting request:', delError);
      return res.status(400).json({ error: delError.message });
    }

    res.json({ success: true, id: requestId });
  } catch (err) {
    console.error('Delete request error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
