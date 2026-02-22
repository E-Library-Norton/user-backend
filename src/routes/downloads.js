// routes/downloads.js
const router               = require('express').Router();
const DownloadController   = require('../controllers/downloadController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/my',    authenticate,                              DownloadController.getMyDownloads);
router.get('/stats', authenticate, authorize('admin'),          DownloadController.getStats);
router.get('/',      authenticate, authorize('admin', 'librarian'), DownloadController.getAll);

module.exports = router;