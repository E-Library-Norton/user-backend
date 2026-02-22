// routes/materialTypes.js
const router                  = require('express').Router();
const MaterialTypeController  = require('../controllers/materialTypeController');
const { authenticate, authorize } = require('../middleware/auth');

router.get ('/',     MaterialTypeController.getAll);
router.get ('/:id',  MaterialTypeController.getById);
router.post('/',     authenticate, authorize('admin', 'librarian'), MaterialTypeController.create);
router.put ('/:id',  authenticate, authorize('admin', 'librarian'), MaterialTypeController.update);
router.delete('/:id',authenticate, authorize('admin'),              MaterialTypeController.delete);

module.exports = router;