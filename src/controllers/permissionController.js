// src/controllers/permissionController.js
const { Permission, Role, sequelize } = require("../models");
const { Op } = require("sequelize");
const ResponseFormatter = require("../utils/responseFormatter");
const { NotFoundError, ConflictError } = require("../utils/errors");
const { logActivity } = require("../utils/activityLogger");

class PermissionController {
  // ── GET /api/permissions 
  static async getAll(req, res, next) {
    try {
      const { search } = req.query;
      const where = {};

      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const permissions = await Permission.findAll({
        where,
        include: [{ association: "Roles", through: { attributes: [] } }],
        order: [["name", "ASC"]],
      });
      return ResponseFormatter.success(res, { permissions });
    } catch (err) {
      next(err);
    }
  }

  // ── GET /api/permissions/:id 
  static async getById(req, res, next) {
    try {
      const permission = await Permission.findByPk(req.params.id, {
        include: [{ association: "Roles", through: { attributes: [] } }],
      });
      if (!permission) throw new NotFoundError("Permission not found");
      return ResponseFormatter.success(res, permission);
    } catch (err) {
      next(err);
    }
  }

  // ── POST /api/permissions 
  static async create(req, res, next) {
    try {
      const { name, description } = req.body;

      const existing = await Permission.findOne({ where: { name } });
      if (existing) throw new ConflictError(`Permission '${name}' already exists`);

      const permission = await Permission.create({ name, description });

      await logActivity({
        userId: req.user.id,
        action: "created",
        targetType: "permission",
        targetId: permission.id,
        targetName: permission.name,
        ipAddress: req.ip,
        userAgent: req.get("user-agent")
      });

      return ResponseFormatter.success(res, permission, "Permission created successfully", 201);
    } catch (err) {
      next(err);
    }
  }

  // ── PUT /api/permissions/:id 
  static async update(req, res, next) {
    try {
      const permission = await Permission.findByPk(req.params.id);
      if (!permission) throw new NotFoundError("Permission not found");

      const { name, description } = req.body;

      if (name && name !== permission.name) {
        const existing = await Permission.findOne({ where: { name } });
        if (existing) throw new ConflictError(`Permission name '${name}' already taken`);
      }

      await permission.update({ name, description });

      await logActivity({
        userId: req.user.id,
        action: "updated",
        targetType: "permission",
        targetId: permission.id,
        targetName: permission.name,
        ipAddress: req.ip,
        userAgent: req.get("user-agent")
      });

      return ResponseFormatter.success(res, permission, "Permission updated successfully");
    } catch (err) {
      next(err);
    }
  }

  // ── DELETE /api/permissions/:id 
  static async delete(req, res, next) {
    try {
      const permission = await Permission.findByPk(req.params.id);
      if (!permission) throw new NotFoundError("Permission not found");

      await permission.destroy();

      await logActivity({
        userId: req.user.id,
        action: "deleted",
        targetType: "permission",
        targetId: permission.id,
        targetName: permission.name,
        ipAddress: req.ip,
        userAgent: req.get("user-agent")
      });

      return ResponseFormatter.noContent(res, null, "Permission deleted successfully");
    } catch (err) {
      next(err);
    }
  }

  // ── POST /api/permissions/:id/roles
  static async assignRoles(req, res, next) {
    try {
      const permission = await Permission.findByPk(req.params.id);
      if (!permission) throw new NotFoundError("Permission not found");

      const { role_ids = [] } = req.body;
      const roles = await Role.findAll({ where: { id: role_ids } });
      await permission.setRoles(roles);

      return ResponseFormatter.success(res, null, "Roles assigned to permission successfully");
    } catch (err) {
      next(err);
    }
  }
}

module.exports = PermissionController;