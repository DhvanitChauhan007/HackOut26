const supabase = require('../supabaseClient');

/**
 * Create a notification row. Supabase Realtime handles push to the frontend.
 */
async function createNotification(userId, message, type = 'general') {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    message,
    type,
    read: false,
  });

  if (error) {
    console.error('Notification insert error:', error);
  }
}

module.exports = { createNotification };
