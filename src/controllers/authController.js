const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const { User, Role } = require("../models");
const ResponseFormatter = require("../utils/responseFormatter");
const { ValidationError, AuthenticationError, NotFoundError } = require("../utils/errors");

class AuthController {

  // ── Generate Access Token (short-lived: 15m)
  static generateAccessToken(user) {
    const roles = (user.Roles || []).map((r) => r.name);
    return jwt.sign(
      {
        id:       user.id,
        username: user.username,
        email:    user.email,
        studentId: user.studentId,
        roles,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m" }
    );
  }

  // ── Generate Refresh Token (long-lived: 7d)
  static generateRefreshToken(user) {
    return jwt.sign(
      { id: user.id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d" }
    );
  }

  // ── POST /api/auth/register
  static async register(req, res, next) {
    try {
      const { username, email, password, firstName, lastName, studentId } = req.body;

      const existing = await User.findOne({
        where: { [Op.or]: [{ username }, { email }, { studentId }] },
      });
      if (existing) throw new ValidationError("Username, Email or Student ID already registered");

      const user = await User.create({ username, email, password, firstName, lastName, studentId });

      const studentRole = await Role.findOne({ where: { name: "student" } });
      if (studentRole) await user.addRole(studentRole);

      return ResponseFormatter.success(res, {
        user: {
          id:        user.id,
          username:  user.username,
          email:     user.email,
          studentId: user.studentId,
        },
      }, "Registration successful", 201);

    } catch (err) {
      next(err);
    }
  }

  // ── POST /api/auth/login
  static async login(req, res, next) {
    try {
      const { identifier, password } = req.body;

      const user = await User.findOne({
        where: {
          [Op.or]: [
            { username:  identifier },
            { email:     identifier },
            { studentId: identifier },
          ],
        },
        include: { association: "Roles" },
      });

      if (!user || !(await user.validatePassword(password))) {
        throw new AuthenticationError("Invalid credentials");
      }

      if (!user.isActive) {
        throw new AuthenticationError("Account is deactivated");
      }

      const accessToken  = AuthController.generateAccessToken(user);
      const refreshToken = AuthController.generateRefreshToken(user);

      return ResponseFormatter.success(res, {
        user: {
          id:        user.id,
          username:  user.username,
          email:     user.email,
          studentId: user.studentId,
          roles:     user.Roles.map((r) => r.name),
        },
        accessToken,
        refreshToken,
      }, "Login successful");

    } catch (err) {
      next(err);
    }
  }

  // ── POST /api/auth/refresh
  // Client sends refreshToken → verifies signature only → returns new accessToken
  static async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) throw new ValidationError("refreshToken is required");

      // Verify signature + expiry — no DB lookup needed
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
      } catch {
        throw new AuthenticationError("Invalid or expired refresh token");
      }

      // Still check user is active (edge case: account disabled after token issued)
      const user = await User.findByPk(decoded.id);
      if (!user)          throw new AuthenticationError("User not found");
      if (!user.isActive) throw new AuthenticationError("Account is deactivated");

      const accessToken = AuthController.generateAccessToken(user);

      return ResponseFormatter.success(res, { accessToken }, "Token refreshed");

    } catch (err) {
      next(err);
    }
  }

  // ── POST /api/auth/logout
  // Stateless: just tell the client to delete both tokens from storage
  static async logout(req, res, next) {
    try {
      return ResponseFormatter.success(res, null, "Logged out successfully");
    } catch (err) {
      next(err);
    }
  }

  // ── GET /api/auth/profile
  static async getProfile(req, res, next) {
    try {
      const user = await User.findByPk(req.user.id, {
        include: { association: "Roles", through: { attributes: [] } },
      });

      if (!user) throw new NotFoundError("User not found");

      return ResponseFormatter.success(res, {
        id:        user.id,
        username:  user.username,
        email:     user.email,
        studentId: user.studentId,
        firstName: user.firstName,
        lastName:  user.lastName,
        roles:     user.Roles.map((r) => r.name),
        createdAt: user.createdAt,
      });

    } catch (err) {
      next(err);
    }
  }

  // ── PUT /api/auth/profile
  static async updateProfile(req, res, next) {
    try {
      const { firstName, lastName, studentId } = req.body;

      const user = await User.findByPk(req.user.id);
      if (!user) throw new NotFoundError("User not found");

      await user.update({ firstName, lastName, studentId });

      return ResponseFormatter.success(res, {
        id:        user.id,
        email:     user.email,
        studentId: user.studentId,
        firstName: user.firstName,
        lastName:  user.lastName,
      }, "Profile updated successfully");

    } catch (err) {
      next(err);
    }
  }

  // ── PUT /api/auth/change-password
  static async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;

      if (newPassword !== confirmPassword) {
        throw new ValidationError("New passwords do not match");
      }

      const user = await User.findByPk(req.user.id);
      if (!user) throw new NotFoundError("User not found");

      if (!(await user.validatePassword(currentPassword))) {
        throw new ValidationError("Current password is incorrect");
      }

      await user.update({ password: newPassword });

      return ResponseFormatter.success(res, null, "Password changed successfully");

    } catch (err) {
      next(err);
    }
  }
}

module.exports = AuthController;