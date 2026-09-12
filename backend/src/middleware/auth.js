const supabase = require('../supabaseClient');

/**
 * Express middleware: extracts Bearer token, verifies via Supabase Auth,
 * and attaches the authenticated user to req.user.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Fetch the full user profile from our users table
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    // Attach auth user and profile (profile may be null if not yet created)
    req.user = user;
    req.profile = profile || null;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Optional auth — attaches user if token present, but doesn't block.
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    req.profile = null;
    return next();
  }

  // Delegate to requireAuth but catch failures gracefully
  return requireAuth(req, res, next);
}

module.exports = { requireAuth, optionalAuth };
