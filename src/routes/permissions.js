// src/routes/permissions.js
const express = require("express");
const router = express.Router();
const PermissionController = require("../controllers/permissionController");
const { authenticate, authorize } = require("../middleware/auth");
const { permissionRules } = require("../middleware/validation");

router.use(authenticate);

// Only admins can manage permissions
router.get("/",      authorize("admin"),   PermissionController.getAll);
router.get("/:id",   permissionRules.id,   authorize("admin"),   PermissionController.getById);
router.post("/",     authorize("admin"), permissionRules.create, PermissionController.create);
router.put("/:id",   authorize("admin"), permissionRules.update, PermissionController.update);
router.delete("/:id",authorize("admin"), permissionRules.id,     PermissionController.delete);
router.put("/:id/roles",  authorize("admin"), permissionRules.assignRoles, PermissionController.assignRoles);

module.exports = router;