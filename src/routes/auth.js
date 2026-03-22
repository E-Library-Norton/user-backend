const express          = require('express');
const multer           = require('multer');
const router           = express.Router();
const AuthController   = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { userValidation } = require('../middleware/validation');
const { MAX_FILE_SIZES, FILE_TYPES } = require('../config/constants');

// Memory-based multer for avatar (Cloudinary needs buffer)
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZES.IMAGE },
  fileFilter(_req, file, cb) {
    const allowed = Array.isArray(FILE_TYPES.IMAGE) ? FILE_TYPES.IMAGE : [FILE_TYPES.IMAGE];
    cb(allowed.includes(file.mimetype) ? null : new Error('Only image files allowed'), allowed.includes(file.mimetype));
  },
}).single('avatar');

router.post('/register',        userValidation.register, AuthController.register);
router.post('/login',           userValidation.login,    AuthController.login);
router.post('/refresh',                                  AuthController.refresh);
router.post('/logout',          authenticate,            AuthController.logout);
router.get('/me',               authenticate,            AuthController.getProfile);   // alias: current user
router.get('/profile',          authenticate,            AuthController.getProfile);
router.patch('/profile',          authenticate,            AuthController.updateProfile);
router.post('/avatar',          authenticate, avatarUpload, AuthController.uploadAvatar);
router.put('/change-password', authenticate,            AuthController.changePassword);
router.post('/forgot-password', AuthController.forgotPassword);

module.exports = router;
