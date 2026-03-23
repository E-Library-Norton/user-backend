// routes/editors.js
const router           = require('express').Router();
const EditorController = require('../controllers/editorController');
const { authenticate, authorize } = require('../middleware/auth');

router.get   ('/',     EditorController.getAll);
router.get   ('/:id',  EditorController.getById);
router.post  ('/',     authenticate, authorize('admin', 'librarian'), EditorController.create);
router.put   ('/:id',  authenticate, authorize('admin', 'librarian'), EditorController.update);
router.delete('/:id',  authenticate, authorize('admin'),              EditorController.delete);

module.exports = router;
