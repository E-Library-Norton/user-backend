// controllers/uploadController.js
<<<<<<< HEAD
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
=======
const cloudinary             = require('../config/cloudinary');
const ResponseFormatter      = require('../utils/responseFormatter');
const Helpers                = require('../utils/helpers');
const { uploadToCloudinary } = require('../utils/cloudinaryUpload');
const { MAX_FILE_SIZES }     = require('../config/constants');

const FOLDER_MAP = {
  cover:  'books/covers',
  pdf:    'books/pdfs',
  avatar: 'users/avatars',
};

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
  const maxSize = file.mimetype === 'application/pdf' ? MAX_FILE_SIZES.PDF : MAX_FILE_SIZES.IMAGE;
  if (file.size > maxSize) {
    return `${fieldName} too large. Max ${maxSize / (1024 * 1024)}MB`;
  }
>>>>>>> 5caed4a (feat: fix issues get pdf file)
  return null;
}

class UploadController {

<<<<<<< HEAD
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
=======
  // POST /api/upload/single   field: "file"
  static async uploadSingle(req, res, next) {
    try {
      if (!req.file) return ResponseFormatter.error(res, 'No file uploaded', 400, 'FILE_REQUIRED');

      const sizeError = validateSize(req.file, 'File');
      if (sizeError) return ResponseFormatter.error(res, sizeError, 400, 'FILE_TOO_LARGE');

      const folder = req.file.mimetype === 'application/pdf' ? 'books/pdfs' : 'books/covers';
      const result = await uploadToCloudinary(req.file, folder);

      return ResponseFormatter.success(res, buildFileInfo(req.file, result), 'File uploaded successfully', 201);
    } catch (err) { next(err); }
  }

  // POST /api/upload/multiple   fields: "cover" + "pdf"
>>>>>>> 5caed4a (feat: fix issues get pdf file)
  static async uploadMultiple(req, res, next) {
    try {
      if (!req.files || Object.keys(req.files).length === 0) {
        return ResponseFormatter.error(res, 'No files uploaded', 400, 'FILES_REQUIRED');
      }

<<<<<<< HEAD
      const results = {};
=======
      const uploadedFiles = {};
>>>>>>> 5caed4a (feat: fix issues get pdf file)
      for (const field of Object.keys(req.files)) {
        const file      = req.files[field][0];
        const sizeError = validateSize(file, field);
        if (sizeError) return ResponseFormatter.error(res, sizeError, 400, 'FILE_TOO_LARGE');

<<<<<<< HEAD
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
=======
        const folder         = FOLDER_MAP[field] || `uploads/${field}`;
        const result         = await uploadToCloudinary(file, folder);
        uploadedFiles[field] = buildFileInfo(file, result);
      }

      return ResponseFormatter.success(res, { files: uploadedFiles }, 'Files uploaded successfully', 201);
    } catch (err) { next(err); }
  }

  // DELETE /api/upload/delete   body: { public_id, resource_type }
  static async deleteFile(req, res, next) {
    try {
      const { public_id, resource_type } = req.body;
      if (!public_id) return ResponseFormatter.error(res, 'public_id is required', 400, 'PUBLIC_ID_REQUIRED');

      await cloudinary.uploader.destroy(public_id, {
        resource_type: resource_type || 'raw',
      });
>>>>>>> 5caed4a (feat: fix issues get pdf file)

      return ResponseFormatter.noContent(res, null, 'File deleted successfully');
    } catch (err) { next(err); }
  }
}

module.exports = UploadController;
