// controllers/uploadController.js
const cloudinary             = require("../config/cloudinary");
const ResponseFormatter      = require("../utils/responseFormatter");
const Helpers                = require("../utils/helpers");
const { uploadToCloudinary } = require("../utils/cloudinaryUpload");
const { MAX_FILE_SIZES }     = require("../config/constants");

// ─── Folder map (field name → Cloudinary folder) ──────────────────────────────
const FOLDER_MAP = {
  cover:  "books/covers",
  pdf:    "books/pdfs",
  avatar: "users/avatars",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFileInfo(file, result) {
  return {
    public_id:     result.public_id,
    format:        result.format,
    resource_type: result.resource_type,
    secure_url:    result.secure_url,
    originalName:  file.originalname,
    size:          file.size,
    formattedSize: Helpers.formatFileSize(file.size),
  };
}

function validateSize(file, fieldName) {
  const maxSize = file.mimetype === "application/pdf" ? MAX_FILE_SIZES.PDF : MAX_FILE_SIZES.IMAGE;
  if (file.size > maxSize) {
    return `${fieldName} too large. Max ${maxSize / (1024 * 1024)}MB`;
  }
  return null;
}

// ─── Controller ───────────────────────────────────────────────────────────────

class UploadController {

  // POST /api/upload/single   field: "file"
  static async uploadSingle(req, res, next) {
    try {
      if (!req.file) return ResponseFormatter.error(res, "No file uploaded", 400, "FILE_REQUIRED");

      const sizeError = validateSize(req.file, "File");
      if (sizeError) return ResponseFormatter.error(res, sizeError, 400, "FILE_TOO_LARGE");

      const folder = req.file.mimetype === "application/pdf" ? "books/pdfs" : "books/covers";
      const result = await uploadToCloudinary(req.file, folder);

      return ResponseFormatter.success(res, buildFileInfo(req.file, result), "File uploaded successfully", 201);
    } catch (err) { next(err); }
  }

  // POST /api/upload/multiple   fields: "cover" + "pdf"
  static async uploadMultiple(req, res, next) {
    try {
      if (!req.files || Object.keys(req.files).length === 0) {
        return ResponseFormatter.error(res, "No files uploaded", 400, "FILES_REQUIRED");
      }

      const uploadedFiles = {};

      for (const field of Object.keys(req.files)) {
        const file      = req.files[field][0];
        const sizeError = validateSize(file, field);
        if (sizeError) return ResponseFormatter.error(res, sizeError, 400, "FILE_TOO_LARGE");

        const folder              = FOLDER_MAP[field] || `uploads/${field}`;
        const result              = await uploadToCloudinary(file, folder);
        uploadedFiles[field]      = buildFileInfo(file, result);
      }

      return ResponseFormatter.success(res, { files: uploadedFiles }, "Files uploaded successfully", 201);
    } catch (err) { next(err); }
  }

  // DELETE /api/upload/delete   body: { public_id, resource_type }
  static async deleteFile(req, res, next) {
    try {
      const { public_id, resource_type } = req.body;

      if (!public_id) return ResponseFormatter.error(res, "public_id is required", 400, "PUBLIC_ID_REQUIRED");

      await cloudinary.uploader.destroy(public_id, {
        resource_type: resource_type || "raw",
      });

      return ResponseFormatter.noContent(res, null, "File deleted successfully");
    } catch (err) { next(err); }
  }
}

module.exports = UploadController;