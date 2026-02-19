// Hard-coded mock users for authentication
const USERS = {
  netrunnerX: { id: 'netrunnerX', name: 'Net Runner', role: 'admin' },
  reliefAdmin: { id: 'reliefAdmin', name: 'Relief Admin', role: 'admin' },
  citizen1: { id: 'citizen1', name: 'Citizen One', role: 'contributor' },
  volunteer1: { id: 'volunteer1', name: 'Volunteer One', role: 'contributor' },
};

function authMiddleware(req, res, next) {
  const userId = req.headers['x-user-id'] || 'citizen1';
  const user = USERS[userId];

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Unknown user' });
  }

  req.user = user;
  next();
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly, USERS };
