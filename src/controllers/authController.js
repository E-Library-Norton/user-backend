const jwt        = require("jsonwebtoken");
const path       = require("path");
const { Op }     = require("sequelize");
const { User, Role } = require("../models");
const ResponseFormatter = require("../utils/responseFormatter");
const { ValidationError, AuthenticationError, NotFoundError } = require("../utils/errors");
<<<<<<< HEAD
const cloudinary   = require("../config/cloudinary");
const streamifier  = require("streamifier");
=======
const { logActivity } = require("../utils/activityLogger");
>>>>>>> 2583949b3258be8c076203b25f1f09d42f3d2e15

class AuthController {

  // ── Generate Access Token (short-lived: 1d)
  static generateAccessToken(user) {
    const roles = (user.Roles || []).map((r) => r.name);
    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        studentId: user.studentId,
        roles,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "30d" }
    );
  }

  // ── Generate Refresh Token (long-lived: 7d)
  static generateRefreshToken(user) {
    return jwt.sign(
      { id: user.id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "60d" }
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
          id: user.id,
          username: user.username,
          email: user.email,
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
            { username: identifier },
            { email: identifier },
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

      const accessToken = AuthController.generateAccessToken(user);
      const refreshToken = AuthController.generateRefreshToken(user);

      // Log activity
      logActivity({
        userId: user.id,
        action: 'login',
        targetId: user.id,
        targetName: user.username,
        targetType: 'user'
      });

      return ResponseFormatter.success(res, {
        user: {
          id: user.id,
          avatar: user.avatar || '',
          username: user.username,
          email: user.email,
          studentId: user.studentId,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.Roles.map((r) => r.name),
        },
        accessToken,
        refreshToken,
      }, "Login successful");

    } catch (err) {
<<<<<<< HEAD
=======
      console.log("Error ", err);
>>>>>>> 2583949b3258be8c076203b25f1f09d42f3d2e15
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
      if (!user) throw new AuthenticationError("User not found");
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
        id: user.id,
        avatar: user.avatar,
        username: user.username,
        email: user.email,
        studentId: user.studentId,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.Roles.map((r) => r.name),
        createdAt: user.createdAt,
      });

    } catch (err) {
      next(err);
    }
  }

  // ── PUT /api/auth/profile
  static async updateProfile(req, res, next) {
    try {
      const { avatar, firstName, lastName, studentId } = req.body;

      const user = await User.findByPk(req.user.id);
      if (!user) throw new NotFoundError("User not found");

      await user.update({ avatar, firstName, lastName, studentId });

      return ResponseFormatter.success(res, {
        id: user.id,
        avatar: user.avatar,
        email: user.email,
        studentId: user.studentId,
        firstName: user.firstName,
        lastName: user.lastName,
      }, "Profile updated successfully");

    } catch (err) {
      next(err);
    }
  }

  // ── POST /api/auth/avatar  (any authenticated user)
  // Accepts the image file and uploads directly to Cloudinary avatars/ folder.
  static async uploadAvatar(req, res, next) {
    try {
      if (!req.file) {
        throw new ValidationError("No image file provided");
      }

      const user = await User.findByPk(req.user.id);
      if (!user) throw new NotFoundError("User not found");

      // Build a clean public_id from the username
      const sanitized = user.username
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .toLowerCase()
        .substring(0, 50);
      const publicId = `${sanitized}_${Date.now().toString(36)}`;
      const ext      = path.extname(req.file.originalname).replace(".", "").toLowerCase();

      // Upload to Cloudinary → avatars/ folder
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "avatars", public_id: publicId, resource_type: "image", format: ext || "jpg" },
          (err, r) => (err ? reject(err) : resolve(r))
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

      // Save the secure URL to the user record
      await user.update({ avatar: result.secure_url });

      return ResponseFormatter.success(res, {
        avatar: result.secure_url,
        public_id: result.public_id,
      }, "Avatar updated successfully");

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