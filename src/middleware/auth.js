// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const ResponseFormatter = require('../utils/responseFormatter');

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

    // 2. Only hit DB if token is valid
    const user = await User.findByPk(decoded.id, {
      include: [
        { association: 'Roles', through: { attributes: [] } },
        { association: 'Permissions', through: { attributes: [] } },
      ],
      // ✅ Only select columns you actually need
      attributes: ['id', 'username', 'email', 'studentId', 'firstName', 'lastName', 'isActive'],
    });

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
    const userRoles = (req.user.Roles || []).map((r) => r.name);
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));
    if (!hasRole) return ResponseFormatter.forbidden(res, 'You do not have permission');
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

module.exports = { authenticate, authorize, requirePermission, optionalAuth };