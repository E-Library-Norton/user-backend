// ============================================
// FILE: src/routes/auth.js
// ============================================

const express        = require('express');
const multer         = require('multer');
const router         = express.Router();
const AuthController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { userValidation } = require('../middleware/validation');
const { MAX_FILE_SIZES, FILE_TYPES } = require('../config/constants');

// Multer for avatar uploads (images only, max 5 MB, memory storage)
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZES.IMAGE },
  fileFilter: (_req, file, cb) => {
    const allowed = Array.isArray(FILE_TYPES.IMAGE) ? FILE_TYPES.IMAGE : [FILE_TYPES.IMAGE];
    cb(allowed.includes(file.mimetype) ? null : new Error('Only image files allowed'), allowed.includes(file.mimetype));
  },
}).single('avatar');

router.post('/register',        userValidation.register, AuthController.register);
router.post('/login',           userValidation.login,    AuthController.login);
router.post('/refresh',                                  AuthController.refresh);
router.post('/logout',          authenticate,            AuthController.logout);
router.get('/profile',          authenticate,            AuthController.getProfile);
router.put('/profile',          authenticate,            AuthController.updateProfile);
router.post('/avatar',          authenticate, avatarUpload, AuthController.uploadAvatar);
router.post('/change-password', authenticate,            AuthController.changePassword);

module.exports = router;
