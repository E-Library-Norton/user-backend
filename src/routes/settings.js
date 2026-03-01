// src/routes/settings.js
const express = require("express");
const router = express.Router();
const SettingController = require("../controllers/settingController");
const { authenticate, authorize } = require("../middleware/auth");

router.get("/", authenticate, SettingController.getAll);
router.post("/", authenticate, authorize("admin", "super admin", "librarian", "administrator"), SettingController.updateBatch);

module.exports = router;
