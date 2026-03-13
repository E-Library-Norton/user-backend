// utils/cloudinaryUpload.js
// Shared Cloudinary upload helper.
//
// EXTENSION RULES:
//  • resource_type "raw"   (PDFs)   → extension MUST be in public_id
//                                    Cloudinary serves raw files as-is
//  • resource_type "image" (images) → extension must NOT be in public_id
//                                    Cloudinary appends it automatically;
//                                    including it causes ".jpg.jpg" double ext

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

// Field names multer uses when the client sends no filename header
const GENERIC = new Set(['file', 'pdf', 'cover', 'avatar', 'blob', 'upload', 'image']);

function getResourceType(mimetype = '') {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'raw';
}

/**
 * Build a clean public_id for Cloudinary.
 *
 * @param {string} originalName  - file.originalname from multer
 * @param {string} mimetype      - file.mimetype from multer
 * @param {string} resourceType  - "image" | "raw" | "video"
 */
function buildPublicId(originalName, mimetype, resourceType) {
  const detectedExt = path.extname(originalName).toLowerCase(); // ".pdf" | ".jpg" | ""
  const ext         = detectedExt || MIME_TO_EXT[mimetype] || '';
  const nameNoExt   = path.basename(originalName, detectedExt);

  const base = GENERIC.has(nameNoExt.toLowerCase())
    ? `upload_${Date.now().toString(36)}`  // unique fallback when no real name
    : nameNoExt;

  const sanitized = base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
    .substring(0, 80);

  // raw (PDF) → include extension so Cloudinary serves "cafe.pdf" Content-Type
  // image     → NO extension; Cloudinary appends it automatically (avoids .jpg.jpg)
  return resourceType === 'raw' ? `${sanitized}${ext}` : sanitized;
}

function uploadToCloudinary(file, folder, resourceTypeOverride) {
  return new Promise((resolve, reject) => {
    const resourceType = resourceTypeOverride || getResourceType(file.mimetype);
    const publicId     = buildPublicId(file.originalname, file.mimetype, resourceType);

    // ext string without dot, used for the `format` option on image uploads
    const detectedExt = path.extname(file.originalname).replace('.', '').toLowerCase();
    const ext         = detectedExt || (MIME_TO_EXT[file.mimetype] || '').replace('.', '');

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id:       publicId,
        resource_type:   resourceType,
        access_mode:     'public',
        unique_filename: false,   // use exact public_id, no random suffix
        overwrite:       true,    // replace on re-upload of same filename
        // For image uploads, tell Cloudinary the format so it serves it correctly
        ...(resourceType === 'image' && ext && { format: ext }),
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );

    streamifier.createReadStream(file.buffer).pipe(stream);
  });
}

module.exports = { uploadToCloudinary, buildPublicId, getResourceType, MIME_TO_EXT };
