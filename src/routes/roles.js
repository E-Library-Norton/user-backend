// src/routes/roles.js
const express = require("express");
const router = express.Router();

const RoleController = require("../controllers/roleController");
const { authenticate, authorize } = require("../middleware/auth");
const { roleRules } = require("../middleware/validation");

router.use(authenticate);

// Only admins can manage roles
router.get("/",      authorize("admin"),   RoleController.getAll);
router.get("/:id",   roleRules.id,   authorize("admin"),   RoleController.getById);
router.post("/",     authorize("admin"), roleRules.create, RoleController.create);
router.put("/:id",   authorize("admin"), roleRules.update, RoleController.update);
router.delete("/:id",authorize("admin"), roleRules.id,     RoleController.delete);
router.put("/:id/permissions", authorize("admin"), roleRules.assignPermissions, RoleController.assignRolePermissions);

module.exports = router;