// routes/publishers.js
const router               = require('express').Router();
const PublisherController  = require('../controllers/publisherController');
const { authenticate, authorize } = require('../middleware/auth');

router.get ('/',     PublisherController.getAll);
router.get ('/:id',  PublisherController.getById);
router.post('/',     authenticate, authorize('admin', 'librarian'), PublisherController.create);
router.put ('/:id',  authenticate, authorize('admin', 'librarian'), PublisherController.update);
router.delete('/:id',authenticate, authorize('admin'),              PublisherController.delete);

module.exports = router;