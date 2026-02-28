// src/controllers/userController.js
const { User, Role, Permission } = require("../models");
const ResponseFormatter = require("../utils/responseFormatter");
const Logger = require("../utils/logger");
const { PAGINATION } = require("../config/constants");
const { ValidationError, NotFoundError, ConflictError } = require("../utils/errors");

class UserController {
  // ── GET /api/users 
  static async getAll(req, res, next) {
    try {
      const page = Math.max(parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE, 1);
      const limit = Math.min(parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
      const offset = (page - 1) * limit;

      const { count, rows: users } = await User.findAndCountAll({
        include: [{ association: "Roles", through: { attributes: [] } }],
        limit,
        offset,
        order: [["created_at", "DESC"]],
      });

      return ResponseFormatter.success(res, {
        users,
        pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
      });
    } catch (err) {
      next(err);
    }
  }

  // ── GET /api/users/:id 
  static async getById(req, res, next) {
    try {
      const user = await User.findByPk(req.params.id, {
        include: [
          { association: "Roles", through: { attributes: [] } },
          { association: "Permissions", through: { attributes: [] } },
        ],
      });
      if (!user) throw new NotFoundError("User not found");

      const { roles, permissions } = await user.getRolesAndPermissions();
      return ResponseFormatter.success(res, { ...user.toJSON(), roles, permissions });
    } catch (err) {
      next(err);
    }
  }

  // ── POST /api/users  (admin creates a user directly) 
  static async create(req, res, next) {
    try {
      const {  username, email, password, firstName, lastName, studentId, roleIds = [] } = req.body;

      const takenUsername = await User.findOne({ where: { username } });
      if (takenUsername) throw new ConflictError("Username already taken");

      const takenStudentId = await User.findOne({ where: { studentId } });
      if (takenStudentId) throw new ConflictError("Student ID already registered");

      const takenEmail = await User.findOne({ where: { email } });
      if (takenEmail) throw new ConflictError("Email already registered");

      const user = await User.create({ username, email, password, firstName, lastName, studentId });

      if (roleIds.length > 0) {
        const roles = await Role.findAll({ where: { id: roleIds } });
        await user.setRoles(roles);
      }

      Logger.info(`Admin created user: ${username}`);

      const created = await User.findByPk(user.id, {
        include: [{ association: "Roles", through: { attributes: [] } }],
      });

      return ResponseFormatter.success(res, created, "User created successfully", 201);
    } catch (err) {
      next(err);
    }
  }

  // ── PUT /api/users/:id 
  static async update(req, res, next) {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) throw new NotFoundError("User not found");

      const { avatar,firstName, lastName, studentId, isActive, roleIds } = req.body;
      await user.update({ avatar,firstName, lastName, studentId, isActive });

      if (roleIds !== undefined) {
        const roles = await Role.findAll({ where: { id: roleIds } });
        await user.setRoles(roles);
      }

      const updated = await User.findByPk(user.id, {
        include: [{ association: "Roles", through: { attributes: [] } }],
      });

      return ResponseFormatter.success(res, updated, "User updated successfully");
    } catch (err) {
      next(err);
    }
  }

  // ── DELETE /api/users/:id  (soft delete) 
  static async delete(req, res, next) {
    try {
      if (Number(req.params.id) === Number(req.user.id)) {
        throw new ValidationError("You cannot delete your own account");
      }

      const user = await User.findByPk(req.params.id);
      if (!user) throw new NotFoundError("User not found");

      await user.update({ isDeleted: true, isActive: false });

      Logger.info(`Soft-deleted user ${user.username} by admin ${req.user.id}`);
      return ResponseFormatter.noContent(res, null, "User deleted successfully");
    } catch (err) {
      next(err);
    }
  }

  // ── POST /api/users/:id/roles 
  static async assignRoles(req, res, next) {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) throw new NotFoundError("User not found");

      const roles = await Role.findAll({ where: { id: req.body.roleIds } });
      await user.setRoles(roles);

      return ResponseFormatter.success(res, null, "Roles assigned successfully");
    } catch (err) {
      next(err);
    }
  }

  // ── POST /api/users/:id/permissions 
  static async assignPermissions(req, res, next) {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) throw new NotFoundError("User not found");

      const perms = await Permission.findAll({ where: { id: req.body.permissionIds } });
      await user.setPermissions(perms);

      return ResponseFormatter.success(res, null, "Permissions assigned successfully");
    } catch (err) {
      next(err);
    }
  }
}

module.exports = UserController;