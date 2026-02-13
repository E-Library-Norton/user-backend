// ============================================
// FILE: src/routes/publications.js (SECURITIES REMOVED)
// ============================================

const express = require("express");
const router = express.Router();
const PublicationController = require("../controllers/publicationController");

// Keep the upload middleware to handle multipart/form-data
const { uploadPublicationFiles } = require("../middleware/upload");

// Public routes
router.get("/", PublicationController.getAll);
router.get("/:id", PublicationController.getById);
router.post("/:id/view", PublicationController.incrementView);
router.post("/:id/download", PublicationController.download);

/**
 * Administrative routes - Security layers removed.
 * No longer requires authentication or role-based checks.
 */

router.post(
  "/",
  uploadPublicationFiles,
  PublicationController.create
);

router.put(
  "/:id",
  uploadPublicationFiles,
  PublicationController.update
);

router.delete(
  "/:id",
  PublicationController.delete
);

module.exports = router;