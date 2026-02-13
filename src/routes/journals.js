// ============================================
// FILE: src/routes/journals.js (SECURITIES REMOVED)
// ============================================

const express = require("express");
const router = express.Router();
const JournalController = require("../controllers/journalController");

// Keep the upload middleware to handle multipart/form-data (files/images)
const { uploadJournalFiles } = require("../middleware/upload");

// Public routes (Previously public, kept as is)
router.get("/", JournalController.getAll);
router.get("/category/:category", JournalController.getByCategory);
router.get("/:id", JournalController.getById);
router.post("/:id/view", JournalController.incrementView);
router.post("/:id/download", JournalController.download);

/**
 * All routes below were previously protected. 
 * Authenticate, Authorize, and Validation middlewares have been removed.
 */

router.post(
  "/",
  uploadJournalFiles,
  JournalController.create
);

router.put(
  "/:id",
  uploadJournalFiles,
  JournalController.update
);

router.delete(
  "/:id",
  JournalController.delete
);

module.exports = router;