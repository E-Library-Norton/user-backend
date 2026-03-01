// src/routes/roles.js
const express = require("express");
const router = express.Router();

const RoleController = require("../controllers/roleController");
const { authenticate, authorize } = require("../middleware/auth");
const { permissionRules, userRules } = require("../middleware/validation");

router.get("/", RoleController.getAll);
router.get("/:id", permissionRules.id, RoleController.getById);
router.post("/", authenticate, authorize('admin'), permissionRules.create, RoleController.create);
router.put("/:id", authenticate, authorize('admin'), permissionRules.update, RoleController.update);
router.delete("/:id", authenticate, authorize('admin'), permissionRules.id, RoleController.delete);
router.post("/:id/permissions", authenticate, authorize('admin'), userRules.assignRolePermissions, RoleController.assignRolePermissions);

module.exports = router;