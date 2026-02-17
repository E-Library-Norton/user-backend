// src/controllers/permissionController.js
const { Permission } = require("../models");
const ResponseFormatter = require("../utils/responseFormatter");

class PermissionController {
  // ── GET /api/permissions ─────────────────────────────────────────────────────
  static async getAll(req, res, next) {
    try {
      const permissions = await Permission.findAll({ order: [["name", "ASC"]] });
      return ResponseFormatter.success(res, permissions);
    } catch (err) {
      next(err);
    }
  }

  // ── GET /api/permissions/:id ─────────────────────────────────────────────────
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

  // ── POST /api/permissions ────────────────────────────────────────────────────
  static async create(req, res, next) {
    try {
      const { name, description } = req.body;

      const existing = await Permission.findOne({ where: { name } });
      if (existing) throw new ConflictError(`Permission '${name}' already exists`);

      const permission = await Permission.create({ name, description });
      return ResponseFormatter.created(res, permission, "Permission created");
    } catch (err) {
      next(err);
    }
  }

  // ── PUT /api/permissions/:id ─────────────────────────────────────────────────
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
      return ResponseFormatter.success(res, permission, "Permission updated");
    } catch (err) {
      next(err);
    }
  }

  // ── DELETE /api/permissions/:id ──────────────────────────────────────────────
  static async delete(req, res, next) {
    try {
      const permission = await Permission.findByPk(req.params.id);
      if (!permission) throw new NotFoundError("Permission not found");

      await permission.destroy();
      return ResponseFormatter.success(res, null, "Permission deleted");
    } catch (err) {
      next(err);
    }
  }
}

module.exports = PermissionController;