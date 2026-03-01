// src/routes/permissions.js
const express = require("express");
const router = express.Router();

const PermissionController = require("../controllers/permissionController");
const { authenticate, authorize } = require("../middleware/auth");
const { permissionRules } = require("../middleware/validation");

router.get("/", PermissionController.getAll);
router.get("/:id", permissionRules.id, PermissionController.getById);
router.post("/", authenticate, authorize('admin'), permissionRules.create, PermissionController.create);
router.put("/:id", authenticate, authorize('admin'), permissionRules.update, PermissionController.update);
router.delete("/:id", authenticate, authorize('admin'), permissionRules.id, PermissionController.delete);
router.post("/:id/roles", authenticate, authorize('admin'), PermissionController.assignRoles);

module.exports = router;