// src/controllers/roleController.js
const { Role, Permission } = require("../models");
const ResponseFormatter = require("../utils/responseFormatter");

// // Roles that cannot be deleted
// const PROTECTED_ROLES = ["admin", "librarian", "student"];

class RoleController {
  // ── GET /api/roles ────
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

  // ── POST /api/roles ───
  static async create(req, res, next) {
    try {
      const { name, description, permissionIds = [] } = req.body;

      const existing = await Role.findOne({ where: { name } });
      if (existing) throw new ConflictError(`Role '${name}' already exists`);

      const role = await Role.create({ name, description });

      if (permissionIds.length > 0) {
        const perms = await Permission.findAll({ where: { id: permissionIds } });
        await role.setPermissions(perms);
      }

      const created = await Role.findByPk(role.id, {
        include: [{ association: "Permissions", through: { attributes: [] } }],
      });

      return ResponseFormatter.created(res, created, "Role created");
    } catch (err) {
      next(err);
    }
  }

  // ── PUT /api/roles/:id 
  static async update(req, res, next) {
    try {
      const role = await Role.findByPk(req.params.id);
      if (!role) throw new NotFoundError("Role not found");

      const { name, description, permissionIds } = req.body;

      if (name && name !== role.name) {
        const existing = await Role.findOne({ where: { name } });
        if (existing) throw new ConflictError(`Role name '${name}' already taken`);
      }

      await role.update({ name, description });

      if (permissionIds !== undefined) {
        const perms = await Permission.findAll({ where: { id: permissionIds } });
        await role.setPermissions(perms);
      }

      const updated = await Role.findByPk(role.id, {
        include: [{ association: "Permissions", through: { attributes: [] } }],
      });

      return ResponseFormatter.success(res, updated, "Role updated");
    } catch (err) {
      next(err);
    }
  }

  // ── DELETE /api/roles/:id ────────────────────────────────────────────────────
  static async delete(req, res, next) {
    try {
      const role = await Role.findByPk(req.params.id);
      if (!role) throw new NotFoundError("Role not found");

    //   if (PROTECTED_ROLES.includes(role.name)) {
    //     throw new ValidationError(`Cannot delete protected role: ${role.name}`);
    //   }

      await role.destroy();
      return ResponseFormatter.success(res, null, "Role deleted");
    } catch (err) {
      next(err);
    }
  }

  // ── POST /api/roles/:id/permissions ─────────────────────────────────────────
  static async assignPermissions(req, res, next) {
    try {
      const role = await Role.findByPk(req.params.id);
      if (!role) throw new NotFoundError("Role not found");

      const perms = await Permission.findAll({ where: { id: req.body.permissionIds } });
      await role.setPermissions(perms);

      return ResponseFormatter.success(res, null, "Permissions assigned to role");
    } catch (err) {
      next(err);
    }
  }
}

module.exports = RoleController;