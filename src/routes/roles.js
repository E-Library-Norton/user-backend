// src/routes/roles.js
const express = require("express");
const router  = express.Router();

const RoleController = require("../controllers/roleController");
const { authenticate, requirePermission } = require("../middleware/auth");
const { userRules } = require("../middleware/validation");

router.use(authenticate);

router.get  ("/",    requirePermission("manage_roles"), RoleController.getAll);
router.get  ("/:id", userRules.id,     requirePermission("manage_roles"), RoleController.getById);
router.post ("/",    userRules.create,  requirePermission("manage_roles"), RoleController.create);
router.put  ("/:id", userRules.update,  requirePermission("manage_roles"), RoleController.update);
router.delete("/:id", userRules.id,    requirePermission("manage_roles"), RoleController.delete);
router.post ("/:id/permissions", userRules.assignPermissions, requirePermission("manage_roles"), RoleController.assignPermissions);

module.exports = router;