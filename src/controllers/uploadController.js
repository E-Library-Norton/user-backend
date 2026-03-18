// controllers/uploadController.js
const cloudinary             = require('../config/cloudinary');
const ResponseFormatter      = require('../utils/responseFormatter');
const Helpers                = require('../utils/helpers');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinaryUpload');
const { MAX_FILE_SIZES }     = require('../config/constants');

const URL_KEY_MAP = {
  cover:  'cover_url',
  pdf:    'pdf_url',
  avatar: 'avatar_url',
};

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
  return null;
}

class UploadController {

  // POST /api/uploads/single   field: "cover" | "pdf" | "avatar" | "file"
  static async uploadSingle(req, res, next) {
    try {
      const files     = req.files || {};
      const fieldName = ['cover', 'pdf', 'avatar', 'file'].find(f => files[f]?.[0]);
      const file      = fieldName ? files[fieldName][0] : req.file;

      if (!file) return ResponseFormatter.error(res, 'No file uploaded', 400, 'FILE_REQUIRED');

      const sizeError = validateSize(file, fieldName || 'File');
      if (sizeError) return ResponseFormatter.error(res, sizeError, 400, 'FILE_TOO_LARGE');

      const folder = FOLDER_MAP[fieldName] || (file.mimetype === 'application/pdf' ? 'books/pdfs' : 'books/covers');
      const result = await uploadToCloudinary(file, folder);

      const urlKey = URL_KEY_MAP[fieldName] || 'url';

      return ResponseFormatter.success(res, {
        [urlKey]:     result.secure_url,
        ...buildFileInfo(file, result)
      }, 'File uploaded successfully', 201);
    } catch (err) { next(err); }
  }

  // POST /api/upload/multiple   fields: "cover" + "pdf"
  static async uploadMultiple(req, res, next) {
    try {
      if (!req.files || Object.keys(req.files).length === 0) {
        return ResponseFormatter.error(res, 'No files uploaded', 400, 'FILES_REQUIRED');
      }

      const uploadedFiles = {};
      for (const field of Object.keys(req.files)) {
        const file      = req.files[field][0];
        const sizeError = validateSize(file, field);
        if (sizeError) return ResponseFormatter.error(res, sizeError, 400, 'FILE_TOO_LARGE');

        const folder         = FOLDER_MAP[field] || `uploads/${field}`;
        const result         = await uploadToCloudinary(file, folder);
        
        const urlKey = URL_KEY_MAP[field] || 'url';
        uploadedFiles[field] = {
           [urlKey]: result.secure_url,
           ...buildFileInfo(file, result)
        };
      }

      const topLevel = {};
      if (uploadedFiles.cover) topLevel.cover_url = uploadedFiles.cover.cover_url;
      if (uploadedFiles.pdf)   topLevel.pdf_url   = uploadedFiles.pdf.pdf_url;

      return ResponseFormatter.success(res, { ...topLevel, files: uploadedFiles }, 'Files uploaded successfully', 201);
    } catch (err) { next(err); }
  }

  // DELETE /api/upload/delete   body: { public_id, resource_type, file_url }
  static async deleteFile(req, res, next) {
    try {
      const { public_id, resource_type, file_url } = req.body;
      
      // Support legacy file_url deletion OR targeted public_id deletion
      if (public_id) {
         await cloudinary.uploader.destroy(public_id, {
           resource_type: resource_type || 'raw',
         });
      } else if (file_url) {
         await deleteFromCloudinary(file_url);
      } else {
         return ResponseFormatter.error(res, 'file_url or public_id is required', 400, 'FILE_IDENTIFIER_REQUIRED');
      }

      return ResponseFormatter.noContent(res, null, 'File deleted successfully');
    } catch (err) { next(err); }
  }
}

module.exports = UploadController;
