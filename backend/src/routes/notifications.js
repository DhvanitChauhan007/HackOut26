const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /api/notifications
 * Fetch all notifications for the authenticated user, newest first.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch notifications error:', error);
      return res.status(500).json({ error: 'Failed to fetch notifications' });
    }

    return res.status(200).json(notifications);
  } catch (err) {
    console.error('GET /api/notifications error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read. Only the notification owner can do this.
 */
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Update only if the notification belongs to the current user
    const { data: updated, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error || !updated) {
      return res.status(404).json({ error: 'Notification not found or access denied' });
    }

    return res.status(200).json(updated);
  } catch (err) {
    console.error('PATCH /api/notifications/:id/read error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
