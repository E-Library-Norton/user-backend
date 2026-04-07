// src/routes/users.js
const express = require("express");
const router = express.Router();
const multer = require('multer');

const UserController = require("../controllers/userController");
const { authenticate, authorize } = require("../middleware/auth");
const { userRules } = require("../middleware/validation");

// Memory-based multer for avatar uploads
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
}).single('avatar');

// ── Public: anyone can fetch a user's avatar (returns signed R2 redirect) ────
router.get("/:id/avatar", UserController.getAvatarById);

// All remaining user routes require a valid token
router.use(authenticate);

// Admins can manage users
router.get("/",      authorize("admin", "librarian"), UserController.getAll); // Example: librarian can view but only admin can edit
router.get("/:id",   userRules.id,     authorize("admin", "librarian"), UserController.getById);
router.post("/",     userRules.create, authorize("admin"), UserController.create);
router.patch("/:id",   userRules.update, authorize("admin"), UserController.update);
router.delete("/:id",userRules.id,     authorize("admin"), UserController.delete);

// Upload/replace a user's avatar — admin only, multipart/form-data field: avatar
router.post("/:id/avatar", authorize("admin"), avatarUpload, UserController.uploadAvatarById);

// Assign roles / direct permissions — full sync (PUT) - Admin only
router.patch("/:id/roles",       userRules.assignRoles,       authorize("admin"), UserController.assignRoles);
router.put("/:id/permissions", userRules.assignPermissions, authorize("admin"), UserController.assignPermissions);

module.exports = router;