// controllers/uploadController.js
const ResponseFormatter  = require('../utils/responseFormatter');
const Helpers            = require('../utils/helpers');
const { MAX_FILE_SIZES } = require('../config/constants');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinaryUpload');

const URL_KEY_MAP = {
  cover:  'cover_url',
  pdf:    'pdf_url',
  avatar: 'avatar_url',
};

function validateSize(file, fieldName) {
  const max = file.mimetype === 'application/pdf' ? MAX_FILE_SIZES.PDF : MAX_FILE_SIZES.IMAGE;
  if (file.size > max) return `${fieldName} too large. Max ${max / (1024 * 1024)}MB`;
  return null;
}

class UploadController {

  // POST /api/uploads/single   field: "cover" | "pdf" | "file"
  static async uploadSingle(req, res, next) {
    try {
      const files     = req.files || {};
      const fieldName = ['cover', 'pdf', 'avatar', 'file'].find(f => files[f]?.[0]);
      const file      = fieldName ? files[fieldName][0] : null;

      if (!file) return ResponseFormatter.error(res, 'No file uploaded', 400, 'FILE_REQUIRED');

      const sizeError = validateSize(file, fieldName);
      if (sizeError) return ResponseFormatter.error(res, sizeError, 400, 'FILE_TOO_LARGE');

      const result  = await uploadToCloudinary(file, fieldName);
      const urlKey  = URL_KEY_MAP[fieldName] || 'url';

      return ResponseFormatter.success(res, {
        [urlKey]:     result.secure_url,
        originalName: file.originalname,
        size:         file.size,
        formattedSize: Helpers.formatFileSize(file.size),
      }, 'File uploaded successfully', 201);
    } catch (err) { next(err); }
  }

  // POST /api/uploads/multiple   fields: "cover" + "pdf"
  static async uploadMultiple(req, res, next) {
    try {
      if (!req.files || Object.keys(req.files).length === 0) {
        return ResponseFormatter.error(res, 'No files uploaded', 400, 'FILES_REQUIRED');
      }

      const results = {};
      for (const field of Object.keys(req.files)) {
        const file      = req.files[field][0];
        const sizeError = validateSize(file, field);
        if (sizeError) return ResponseFormatter.error(res, sizeError, 400, 'FILE_TOO_LARGE');

        const result = await uploadToCloudinary(file, field);
        const urlKey = URL_KEY_MAP[field] || 'url';
        results[field] = {
          [urlKey]:     result.secure_url,
          originalName: file.originalname,
          size:         file.size,
          formattedSize: Helpers.formatFileSize(file.size),
        };
      }

      const topLevel = {};
      if (results.cover) topLevel.cover_url = results.cover.cover_url;
      if (results.pdf)   topLevel.pdf_url   = results.pdf.pdf_url;

      return ResponseFormatter.success(res, { ...topLevel, files: results }, 'Files uploaded successfully', 201);
    } catch (err) { next(err); }
  }

  // DELETE /api/uploads/delete   body: { file_url }
  static async deleteFile(req, res, next) {
    try {
      const { file_url } = req.body;
      if (!file_url) return ResponseFormatter.error(res, 'file_url is required', 400, 'FILE_URL_REQUIRED');

      await deleteFromCloudinary(file_url);

      return ResponseFormatter.noContent(res, null, 'File deleted successfully');
    } catch (err) { next(err); }
  }
}

module.exports = UploadController;
