// src/routes/permissions.js
const express = require("express");
const router = express.Router();

const PermissionController = require("../controllers/permissionController");
const { authenticate, authorize, requirePermission } = require("../middleware/auth");
const { permissionRules } = require("../middleware/validation");

router.use(authenticate);

router.get("/", requirePermission('manage_roles'), PermissionController.getAll);
router.get("/:id", permissionRules.id, requirePermission('manage_roles'), PermissionController.getById);
router.post("/", requirePermission('manage_roles'), permissionRules.create, PermissionController.create);
router.put("/:id", requirePermission('manage_roles'), permissionRules.update, PermissionController.update);
router.delete("/:id", requirePermission('manage_roles'), permissionRules.id, PermissionController.delete);
router.post("/:id/roles", requirePermission('manage_roles'), PermissionController.assignRoles);

module.exports = router;