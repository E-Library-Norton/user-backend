// src/routes/permissions.js
const express = require("express");
const router  = express.Router();

const PermissionController = require("../controllers/permissionController");
const { permissionRules } = require("../middleware/validation");

router.get  ("/",    PermissionController.getAll);
router.get  ("/:id", permissionRules.id,     PermissionController.getById);
router.post ("/",    permissionRules.create,  PermissionController.create);
router.put  ("/:id", permissionRules.update,  PermissionController.update);
router.delete("/:id", permissionRules.id,    PermissionController.delete);

module.exports = router;