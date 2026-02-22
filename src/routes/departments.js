// routes/departments.js
const router                = require('express').Router();
const DepartmentController  = require('../controllers/departmentController');
const { authenticate, authorize } = require('../middleware/auth');

router.get ('/',     DepartmentController.getAll);
router.get ('/:id',  DepartmentController.getById);
router.post('/',     authenticate, authorize('admin', 'librarian'), DepartmentController.create);
router.put ('/:id',  authenticate, authorize('admin', 'librarian'), DepartmentController.update);
router.delete('/:id',authenticate, authorize('admin'),              DepartmentController.delete);

module.exports = router;