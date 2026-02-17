// src/routes/permissions.js
const express = require("express");
const router  = express.Router();

const PermissionController = require("../controllers/permissionController");
const { authenticate, requirePermission } = require("../middleware/auth");
const { permissionRules } = require("../middleware/validation");

router.use(authenticate);

router.get  ("/",    requirePermission("manage_permissions"), PermissionController.getAll);
router.get  ("/:id", permissionRules.id,     requirePermission("manage_permissions"), PermissionController.getById);
router.post ("/",    permissionRules.create,  requirePermission("manage_permissions"), PermissionController.create);
router.put  ("/:id", permissionRules.update,  requirePermission("manage_permissions"), PermissionController.update);
router.delete("/:id", permissionRules.id,    requirePermission("manage_permissions"), PermissionController.delete);

module.exports = router;