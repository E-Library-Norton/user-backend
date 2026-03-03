// src/routes/roles.js
const express = require("express");
const router = express.Router();

const RoleController = require("../controllers/roleController");
const { authenticate, authorize, requirePermission } = require("../middleware/auth");
const { permissionRules, userRules } = require("../middleware/validation");

router.use(authenticate);

router.get("/", requirePermission('manage_roles'), RoleController.getAll);
router.get("/:id", permissionRules.id, requirePermission('manage_roles'), RoleController.getById);
router.post("/", authenticate, requirePermission('manage_roles'), permissionRules.create, RoleController.create);
router.put("/:id", authenticate, requirePermission('manage_roles'), permissionRules.update, RoleController.update);
router.delete("/:id", authenticate, requirePermission('manage_roles'), permissionRules.id, RoleController.delete);
router.post("/:id/permissions", authenticate, requirePermission('manage_roles'), userRules.assignRolePermissions, RoleController.assignRolePermissions);

module.exports = router;