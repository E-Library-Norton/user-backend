// src/controllers/roleController.js
const { Role, Permission } = require("../models");
const ResponseFormatter = require("../utils/responseFormatter");
const { NotFoundError, ConflictError } = require("../utils/errors");


class RoleController {
  // ── GET /api/roles 
  static async getAll(req, res, next) {
    try {
      const roles = await Role.findAll({
        include: [{ association: "Permissions", through: { attributes: [] } }],
        order: [["name", "ASC"]],
      });
      return ResponseFormatter.success(res, roles);
    } catch (err) {
      next(err);
    }
  }

  // ── GET /api/roles/:id 
  static async getById(req, res, next) {
    try {
      const role = await Role.findByPk(req.params.id, {
        include: [{ association: "Permissions", through: { attributes: [] } }],
      });
      if (!role) throw new NotFoundError("Role not found");
      return ResponseFormatter.success(res, role);
    } catch (err) {
      next(err);
    }
  }

  // ── POST /api/roles 
  static async create(req, res, next) {
    try {
      const { name, description, } = req.body;

      const existing = await Role.findOne({ where: { name } });
      if (existing) throw new ConflictError(`Role '${name}' already exists`);

      const role = await Role.create({ name, description });

      return ResponseFormatter.success(res, role, "Role created successfully", 201);
    } catch (err) {
      next(err);
    }
  }

  // ── PUT /api/roles/:id 
  static async update(req, res, next) {
    try {
      const role = await Role.findByPk(req.params.id);
      if (!role) throw new NotFoundError("Role not found");

      const { name, description, } = req.body;

      if (name && name !== role.name) {
        const existing = await Role.findOne({ where: { name } });
        if (existing) throw new ConflictError(`Role name '${name}' already taken`);
      }

      await role.update({ name, description });

      return ResponseFormatter.success(res, role, "Role updated successfully");
    } catch (err) {
      next(err);
    }
  }

  // ── DELETE /api/roles/:id 
  static async delete(req, res, next) {
    try {
      const role = await Role.findByPk(req.params.id);
      if (!role) throw new NotFoundError("Role not found");
      await role.destroy();
      return ResponseFormatter.noContent(res, null, "Role deleted successfully");
    } catch (err) {
      next(err);
    }
  }

  // ── POST /api/roles/:id/permissions 
  static async assignRolePermissions(req, res, next) {
    try {
      const role = await Role.findByPk(req.params.id);
      if (!role) throw new NotFoundError("Role not found");

      const perms = await Permission.findAll({ where: { id: req.body.permissionIds } });
      await role.setPermissions(perms);

      return ResponseFormatter.success(res, null, "Role assigned to permissions successfully");
    } catch (err) {
      next(err);
    }
  }
}

module.exports = RoleController;