const express = require("express");
const router = express.Router();
const UploadController = require("../controllers/uploadController");
const { authenticate, authorize } = require("../middleware/auth");
const { uploadSingle, uploadMulti } = require("../middleware/upload");

// Single upload
router.post(
  "/single",
  authenticate,
  authorize("admin", "librarian"),
  uploadSingle,
  UploadController.uploadSingle
);

// Multiple upload
router.post(
  "/multiple",
  authenticate,
  authorize("admin", "librarian"),
  uploadMulti,
  UploadController.uploadMultiple
);

// Delete file
router.post(
  "/delete",
  authenticate,
  authorize("admin", "librarian"),
  UploadController.deleteFile
);

module.exports = router;