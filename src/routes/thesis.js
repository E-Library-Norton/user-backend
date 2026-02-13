// ============================================
// FILE: src/routes/thesis.js (SECURITIES REMOVED)
// ============================================

const express = require("express");
const router = express.Router();
const ThesisController = require("../controllers/thesisController");

// We keep the upload middleware because it handles the multipart/form-data (files)
// but we remove authenticate, authorize, and validation middleware.
const { uploadThesisFiles } = require("../middleware/upload");

// All routes are now public and unvalidated
router.get("/", ThesisController.getAll);
router.get("/:id", ThesisController.getById);
router.post("/:id/view", ThesisController.incrementView);
router.post("/:id/download", ThesisController.download);

// File uploads still require the upload middleware to parse the request body
router.post(
  "/",
  uploadThesisFiles,
  ThesisController.create
);

router.put(
  "/:id",
  uploadThesisFiles,
  ThesisController.update
);

router.delete(
  "/:id",
  ThesisController.delete
);

module.exports = router;