// src/routes/users.js
const express = require("express");
const router  = express.Router();

const UserController = require("../controllers/userController");
const { authenticate, requirePermission, authorize } = require("../middleware/auth");
const { userRules } = require("../middleware/validation");

// All user routes require a valid token
router.get  ("/",       UserController.getAll);
router.use(authenticate);

router.get  ("/:id", userRules.id,   requirePermission("view_users"),   UserController.getById);
router.post ("/",    userRules.create, requirePermission("create_users"), UserController.create);
router.put  ("/:id", userRules.update, requirePermission("update_users"), UserController.update);
router.delete("/:id", userRules.id,  requirePermission("delete_users"), UserController.delete);

// Assign roles / direct permissions — admin only
router.post("/:id/roles",       userRules.assignRoles,       authorize("admin"), UserController.assignRoles);
router.post("/:id/permissions", userRules.assignPermissions, authorize("admin"), UserController.assignPermissions);

module.exports = router;