// routes/authors.js
const router           = require('express').Router();
const AuthorController = require('../controllers/authorController');
const { authenticate, authorize } = require('../middleware/auth');

router.get ('/',     AuthorController.getAll);
router.get ('/:id',  AuthorController.getById);
router.post('/',     authenticate, authorize('admin', 'librarian'), AuthorController.create);
router.put ('/:id',  authenticate, authorize('admin', 'librarian'), AuthorController.update);
router.delete('/:id',authenticate, authorize('admin'),              AuthorController.delete);

module.exports = router;