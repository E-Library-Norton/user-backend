const multer = require('multer');
const { MAX_FILE_SIZES, FILE_TYPES } = require('../config/constants');

// Use memory storage for Cloudinary
const storage = multer.memoryStorage();

// File filter — validates MIME type per field name
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    cover: FILE_TYPES.IMAGE,           // array of image mimetypes
    profiles: [FILE_TYPES.PDF],        // ["application/pdf"]
    file: FILE_TYPES.IMAGE,            // for single upload
  };

  const allowed = allowedTypes[file.fieldname];

  if (
    allowed &&
    (Array.isArray(allowed)
      ? allowed.includes(file.mimetype)
      : allowed === file.mimetype)
  ) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for field "${file.fieldname}"`), false);
  }
};

// Use limits.fileSize (PDF limit is the largest at 10 MB).
// Per-type image size check (5 MB) is enforced in controllers
// after the file is fully buffered.
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZES.PDF },
});

module.exports = {
  uploadSingle: upload.single('file'),

  uploadMulti: upload.fields([
    { name: 'cover', maxCount: 1 },
    { name: 'profiles', maxCount: 1 },
  ]),
};