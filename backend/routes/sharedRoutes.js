import express from 'express';
import { supabaseAdmin } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Get / Create profile
router.post('/users/me', requireAuth, async (req, res) => {
  const { name, role, address, lat, long } = req.body;
  const { data, error } = await supabaseAdmin
    .from('users')
    .upsert(
      { id: req.user.id, name, role, address: address || null, lat: lat || null, long: long || null },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.get('/users/me', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin.from('users').select('*').eq('id', req.user.id).single();
  if (error) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 14;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(3, Math.round(R * c));
}

// Get listings with decay computed
router.get('/listings', async (req, res) => {
  const { material_type, max_distance_km, buyer_lat, buyer_long, min_quantity } = req.query;
  
  let query = supabaseAdmin
    .from('listings')
    .select('*, users(name, address, lat, long)')
    .order('created_at', { ascending: false });

  if (material_type && material_type !== 'All') query = query.eq('material_type', material_type);
  if (min_quantity) query = query.gte('quantity', min_quantity);
  query = query.eq('status', 'open');

  const { data: listings, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Photo fallbacks based on material
  const defaultPhotos = {
    Cardboard: '/images/cardboard-bales.jpg',
    Plastic: '/images/blue-drums.jpg',
    Pallets: '/images/wood-pallets.jpg',
    Glass: '/images/blue-drums.jpg',
    Metal: '/images/film-bales.jpg'
  };

  // Compute current_price and distance based on decay
  const now = Date.now() / 1000;
  const bLat = parseFloat(buyer_lat) || 13.0358;
  const bLong = parseFloat(buyer_long) || 77.5972;

  const processed = (listings || []).map(listing => {
    const elapsed = now - (new Date(listing.created_at).getTime() / 1000);
    const window = listing.decay_window_seconds || 7200;
    const listPrice = parseFloat(listing.list_price || 10);
    const floorPrice = parseFloat(listing.price_floor || listPrice * 0.7);
    
    let current_price = listPrice - (elapsed / window) * (listPrice - floorPrice);
    if (current_price < floorPrice) current_price = floorPrice;
    if (current_price > listPrice) current_price = listPrice;

    const pLat = listing.pickup_lat || listing.users?.lat || 13.0285;
    const pLong = listing.pickup_long || listing.users?.long || 77.5197;
    const distance = getDistanceKm(pLat, pLong, bLat, bLong);
    const decay_pct = Math.min(100, Math.max(0, Math.round((elapsed / window) * 100)));

    const photo_url = listing.photo_url || defaultPhotos[listing.material_type] || '/images/cardboard-bales.jpg';
    const users = listing.users || { name: 'Verified Seller', address: 'Industrial Zone, Bengaluru' };

    return { 
      ...listing, 
      current_price, 
      distance, 
      decay_pct,
      photo_url,
      users
    };
  });

  res.json(processed);
});

router.get('/listings/:id', async (req, res) => {
  const { data: listing, error } = await supabaseAdmin
    .from('listings')
    .select('*, users!inner(name, address)')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Not found' });

  const now = Date.now() / 1000;
  const elapsed = now - (new Date(listing.created_at).getTime() / 1000);
  const window = listing.decay_window_seconds;
  const listPrice = parseFloat(listing.list_price);
  const floorPrice = parseFloat(listing.price_floor);
  
  let current_price = listPrice - (elapsed / window) * (listPrice - floorPrice);
  if (current_price < floorPrice) current_price = floorPrice;
  if (current_price > listPrice) current_price = listPrice;

  res.json({ ...listing, current_price });
});

router.get('/bulk-lots', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('bulk_lots')
    .select('*, bulk_lot_items(id, quantity, seller_id, listing_id, pickup_lat, pickup_long, listings(material_type, sub_grade), users:seller_id(name))')
    .eq('status', 'open');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/bulk-lots/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('bulk_lots').select('*').eq('id', req.params.id).single();
  if (error) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

export default router;
