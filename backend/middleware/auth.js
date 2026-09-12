import { supabaseAdmin } from '../supabase.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Attach user to request
    req.user = user;

    // Automatically ensure user exists in public.users to prevent foreign key violations
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!existingUser) {
      const name = user.user_metadata?.name || user.email?.split('@')[0] || 'User';
      let role = user.user_metadata?.role;
      const validRoles = ['manufacturer', 'retailer', 'recycler', 'logistics'];
      if (!validRoles.includes(role)) {
        role = 'recycler';
      }
      const address = user.user_metadata?.address || null;

      await supabaseAdmin.from('users').insert({
        id: user.id,
        name,
        role,
        address,
      });
    }

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
