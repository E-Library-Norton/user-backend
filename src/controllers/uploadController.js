const ResponseFormatter = require("../utils/responseFormatter");
const Helpers = require("../utils/helpers");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");
const { MAX_FILE_SIZES } = require("../config/constants");

class UploadController {
  // Helper to upload to Cloudinary
  static uploadToCloudinary(file, folder = "uploads") {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: "auto" },
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
      streamifier.createReadStream(file.buffer).pipe(stream);
    });
  }

  // Single file upload
  static async uploadSingle(req, res, next) {
    try {
      if (!req.file) {
        return ResponseFormatter.error(
          res,
          "No file uploaded",
          400,
          "FILE_REQUIRED"
        );
      }

      if (req.file.size > MAX_FILE_SIZES.IMAGE) {
        return ResponseFormatter.error(
          res,
          `Image too large. Max size is ${MAX_FILE_SIZES.IMAGE / (1024 * 1024)}MB`,
          400,
          "FILE_TOO_LARGE"
        );
      }

      const result = await UploadController.uploadToCloudinary(req.file);

      const fileInfo = {
        url: result.secure_url,
        public_id: result.public_id,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        formattedSize: Helpers.formatFileSize(req.file.size),
      };

      return ResponseFormatter.success(
        res,
        fileInfo,
        "File uploaded successfully",
        201
      );
    } catch (error) {
      next(error);
    }
  }

  // Multiple files upload
  static async uploadMultiple(req, res, next) {
    try {
      if (!req.files || Object.keys(req.files).length === 0) {
        return ResponseFormatter.error(
          res,
          "No files uploaded",
          400,
          "FILES_REQUIRED"
        );
      }

      const uploadedFiles = {};

      for (const field in req.files) {
        const file = req.files[field][0];
        const result = await UploadController.uploadToCloudinary(file, `uploads/${field}`);
        uploadedFiles[field] = {
          url: result.secure_url,
          public_id: result.public_id,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          formattedSize: Helpers.formatFileSize(file.size),
        };
      }

      return ResponseFormatter.success(
        res,
        { files: uploadedFiles },
        "Files uploaded successfully",
        201
      );
    } catch (error) {
      next(error);
    }
  }

  // Delete uploaded file
  static async deleteFile(req, res, next) {
    try {
      const { public_id } = req.body;

      if (!public_id) {
        return ResponseFormatter.error(
          res,
          "public_id is required",
          400,
          "PUBLIC_ID_REQUIRED"
        );
      }

      await cloudinary.uploader.destroy(public_id);

      return ResponseFormatter.noContent(
        res,
        null,
        "File deleted successfully"
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UploadController;