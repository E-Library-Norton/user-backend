// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const ResponseFormatter = require('../utils/responseFormatter');

// ── 30s user cache — avoids hitting DB on every request ─────────────────────
const _userCache = new Map(); // userId → { user, ts }
const USER_CACHE_TTL = 30_000; // 30 seconds

function getCachedUser(userId) {
  const entry = _userCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.ts > USER_CACHE_TTL) { _userCache.delete(userId); return null; }
  return entry.user;
}
function setCachedUser(userId, user) {
  if (_userCache.size > 2000) { // cap at 2k entries
    _userCache.delete(_userCache.keys().next().value);
  }
  _userCache.set(userId, { user, ts: Date.now() });
}
/** Call this after role/status changes so the next request gets fresh data */
function invalidateUserCache(userId) { _userCache.delete(userId); }


// ── authenticate ──────────────────────────────────────────────────────────────
// Optimized: verify JWT first (sync, ~0ms) before hitting DB
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return ResponseFormatter.unauthorized(res, 'Authentication required');
    }

    const token = authHeader.replace('Bearer ', '');

    // 1. Verify JWT signature FIRST (sync, no DB) — rejects tampered/expired tokens instantly
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch {
      return ResponseFormatter.unauthorized(res, 'Invalid or expired token');
    }

    // 2. Only hit DB if token is valid — use 30s cache to avoid DB on every request
    let user = getCachedUser(decoded.id);
    if (!user) {
      user = await User.findByPk(decoded.id, {
        include: [
          { association: 'Roles', through: { attributes: [] } },
          { association: 'Permissions', through: { attributes: [] } },
        ],
        attributes: ['id', 'avatar', 'username', 'email', 'studentId', 'firstName', 'lastName', 'isActive'],
      });
      if (user?.isActive) setCachedUser(decoded.id, user);
    }

    if (!user?.isActive) {
      return ResponseFormatter.unauthorized(res, 'Invalid authentication');
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    return ResponseFormatter.unauthorized(res, 'Invalid or expired token');
  }
};

// ── authorize ─────────────────────────────────────────────────────────────────
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) return ResponseFormatter.unauthorized(res, 'Authentication required');
    // Normalize all role names to lowercase and trim for comparison
    const userRoles = (req.user.Roles || []).map((r) => r.name.toLowerCase().trim());
    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase().trim());

    const hasRole = normalizedAllowed.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return ResponseFormatter.forbidden(res, 'You do not have permission');
    }
    next();
  };
};

// ── requirePermission ─────────────────────────────────────────────────────────
const requirePermission = (permissionName) => {
  return async (req, res, next) => {
    if (!req.user) return ResponseFormatter.unauthorized(res, 'Authentication required');
    // user already has Roles + Permissions loaded from authenticate middleware
    const hasPermission = await req.user.hasPermission(permissionName);
    if (!hasPermission) return ResponseFormatter.forbidden(res, `Permission required: ${permissionName}`);
    next();
  };
};

// ── optionalAuth ──────────────────────────────────────────────────────────────
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user = await User.findByPk(decoded.id, {
        attributes: ['id', 'username', 'email', 'isActive'],
      });
      if (user?.isActive) req.user = user;
    }
  } catch { /* silent */ }
  next();
};

// ── authenticateStream ─────────────────────────────────────────────────────────
// Like authenticate, but also accepts token from ?token= query param.
// Use on stream/download routes so URLs can be opened directly in browser.
// Use this for stream/download endpoints that must be openable directly in a
// browser (iframe, <a href>, PDF viewer) where custom headers cannot be sent.
const authenticateStream = async (req, res, next) => {
  try {
    const token =
      req.query.token ||
      req.header('Authorization')?.replace('Bearer ', '');

    if (!token) return ResponseFormatter.unauthorized(res, 'Authentication required');

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch {
      return ResponseFormatter.unauthorized(res, 'Invalid or expired token');
    }

    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'username', 'email', 'studentId', 'isActive'],
    });

    if (!user?.isActive) return ResponseFormatter.unauthorized(res, 'Invalid authentication');

    req.user = user;
    next();
  } catch {
    return ResponseFormatter.unauthorized(res, 'Invalid or expired token');
  }
};

module.exports = { authenticate, authorize, requirePermission, optionalAuth, authenticateStream, invalidateUserCache };