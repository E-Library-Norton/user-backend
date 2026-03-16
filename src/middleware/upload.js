const multer = require('multer');
const { MAX_FILE_SIZES, FILE_TYPES } = require('../config/constants');

const fileFilter = (_req, file, cb) => {
  const allowedTypes = {
    cover:  FILE_TYPES.IMAGE,
    pdf:    [FILE_TYPES.PDF],
    avatar: FILE_TYPES.IMAGE,
    file:   [...FILE_TYPES.IMAGE, FILE_TYPES.PDF],
  };
  const allowed = allowedTypes[file.fieldname];
  if (allowed && (Array.isArray(allowed) ? allowed.includes(file.mimetype) : allowed === file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for field "${file.fieldname}"`), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZES.PDF },
});

module.exports = {
  uploadSingle: upload.fields([
    { name: 'cover',  maxCount: 1 },
    { name: 'pdf',    maxCount: 1 },
    { name: 'file',   maxCount: 1 },
  ]),
  uploadMulti: upload.fields([
    { name: 'cover', maxCount: 1 },
    { name: 'pdf',   maxCount: 1 },
  ]),
};
