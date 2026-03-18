// src/routes/users.js
const express = require("express");
const router = express.Router();

const UserController = require("../controllers/userController");
const { authenticate, authorize } = require("../middleware/auth");
const { userRules } = require("../middleware/validation");

// All user routes require a valid token
router.use(authenticate);

// Admins can manage users
router.get("/",      authorize("admin", "librarian"), UserController.getAll); // Example: librarian can view but only admin can edit
router.get("/:id",   userRules.id,     authorize("admin", "librarian"), UserController.getById);
router.post("/",     userRules.create, authorize("admin"), UserController.create);
router.patch("/:id",   userRules.update, authorize("admin"), UserController.update);
router.delete("/:id",userRules.id,     authorize("admin"), UserController.delete);

// Assign roles / direct permissions — full sync (PUT) - Admin only
router.patch("/:id/roles",       userRules.assignRoles,       authorize("admin"), UserController.assignRoles);
router.put("/:id/permissions", userRules.assignPermissions, authorize("admin"), UserController.assignPermissions);

module.exports = router;