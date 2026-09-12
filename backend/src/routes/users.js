const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { requireAuth } = require('../middleware/auth');

const VALID_ROLES = ['manufacturer', 'retailer', 'recycler', 'logistics'];

/**
 * POST /api/users/me
 * Create or upsert the authenticated user's profile.
 */
router.post('/me', requireAuth, async (req, res) => {
  try {
    const { name, role, address, lat, long } = req.body;

    if (!name || !role) {
      return res.status(400).json({ error: 'name and role are required' });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`,
      });
    }

    const { data, error } = await supabase
      .from('users')
      .upsert(
        {
          id: req.user.id,
          name,
          role,
          address: address || null,
          lat: lat ?? null,
          long: long ?? null,
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Upsert user error:', error);
      return res.status(500).json({ error: 'Failed to create/update profile' });
    }

    return res.status(201).json(data);
  } catch (err) {
    console.error('POST /api/users/me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/users/me
 * Return the authenticated user's profile.
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('GET /api/users/me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/users/:id/ratings
 * Return all ratings for a user plus the computed average.
 */
router.get('/:id/ratings', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: ratings, error } = await supabase
      .from('ratings')
      .select('*')
      .eq('ratee_id', id);

    if (error) {
      console.error('Fetch ratings error:', error);
      return res.status(500).json({ error: 'Failed to fetch ratings' });
    }

    const count = ratings.length;
    const average =
      count > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / count
        : 0;

    return res.status(200).json({
      ratings,
      average: Math.round(average * 100) / 100,
      count,
    });
  } catch (err) {
    console.error('GET /api/users/:id/ratings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
