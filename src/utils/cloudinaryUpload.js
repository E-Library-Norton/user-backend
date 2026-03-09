// utils/cloudinaryUpload.js
// Single shared helper for all Cloudinary uploads.
// PDFs → resource_type "raw" (preserves binary; "image" would rasterize to PNG/JPG).
// public_id = sanitized original filename + extension.

const path        = require('path');
const streamifier = require('streamifier');
const cloudinary  = require('../config/cloudinary');

const MIME_TO_EXT = {
  'application/pdf': '.pdf',
  'image/jpeg':      '.jpg',
  'image/png':       '.png',
  'image/gif':       '.gif',
  'image/webp':      '.webp',
  'image/svg+xml':   '.svg',
};

function getResourceType(mimetype = '') {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'raw';
}

// Generic names multer sets when the client omits the filename header
const GENERIC_NAMES = new Set(['file', 'pdf', 'cover', 'avatar', 'blob', 'upload', 'image']);

function buildPublicId(originalName, mimetype) {
  const detectedExt = path.extname(originalName).toLowerCase();
  const ext         = detectedExt || MIME_TO_EXT[mimetype] || '';
  const nameNoExt   = path.basename(originalName, detectedExt);

  const base = GENERIC_NAMES.has(nameNoExt.toLowerCase())
    ? `upload_${Date.now().toString(36)}`   // unique fallback when no real name
    : nameNoExt;

  const sanitized = base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
    .substring(0, 80);

  return `${sanitized}${ext}`;  // "cafe.pdf" | "cover.jpg"
}

function uploadToCloudinary(file, folder, resourceTypeOverride) {
  return new Promise((resolve, reject) => {
    const resourceType = resourceTypeOverride || getResourceType(file.mimetype);
    const publicId     = buildPublicId(file.originalname, file.mimetype);

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id:       publicId,
        resource_type:   resourceType,
        access_mode:     'public',  // no signed URL required
        unique_filename: false,     // use our exact public_id
        overwrite:       true,      // replace on re-upload of same name
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );

    streamifier.createReadStream(file.buffer).pipe(stream);
  });
}

module.exports = { uploadToCloudinary, buildPublicId, getResourceType, MIME_TO_EXT };
