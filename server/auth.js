'use strict';
const jwt = require('jsonwebtoken');

const JWT_SECRET     = process.env.JWT_SECRET     || 'goals-jwt-secret-change-me';
const SSO_JWT_SECRET = process.env.SSO_JWT_SECRET || JWT_SECRET;

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireCoach(req, res, next) {
  if (!['coach', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Coach access required' });
  }
  next();
}

function signLocal(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, displayName: user.display_name, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function verifySsoToken(token) {
  try { return jwt.verify(token, SSO_JWT_SECRET); } catch { return null; }
}

module.exports = { authMiddleware, requireCoach, signLocal, verifySsoToken, JWT_SECRET };
