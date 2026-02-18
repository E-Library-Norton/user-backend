// src/routes/roles.js
const express = require("express");
const router  = express.Router();

const RoleController = require("../controllers/roleController");
const { permissionRules, userRules } = require("../middleware/validation");

router.get  ("/",    RoleController.getAll);
router.get  ("/:id", permissionRules.id,     RoleController.getById);
router.post ("/",    permissionRules.create,  RoleController.create);
router.put  ("/:id", permissionRules.update,  RoleController.update);
router.delete("/:id", permissionRules.id,    RoleController.delete);
router.post ("/:id/permissions", userRules.assignRolePermissions, RoleController.assignRolePermissions);

module.exports = router;