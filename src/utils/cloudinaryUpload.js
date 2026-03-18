// utils/cloudinaryUpload.js
<<<<<<< HEAD
const cloudinary   = require('../config/cloudinary');
const streamifier  = require('streamifier');
const path         = require('path');

// ── Config ──────────────────────────────────────────────────────────────────

const FOLDER = {
  cover:  'books/covers',
  pdf:    'books/pdfs',
  avatar: 'avatars',
  file:   'uploads',
};

const RESOURCE_TYPE = {
  cover:  'image',
  pdf:    'raw',
  avatar: 'image',
  file:   'auto',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a Cloudinary public_id that preserves the original filename.
 *
 * Images/video  → NO extension in public_id (Cloudinary appends format → avoids .jpg.jpg)
 * Raw (PDF)     → KEEP extension (Cloudinary raw files need it in the URL)
 */
function buildPublicId(fieldName, originalname) {
  const ext          = path.extname(originalname).toLowerCase();
  const resourceType = RESOURCE_TYPE[fieldName] || 'auto';
  const folder       = FOLDER[fieldName]        || 'uploads';

  const base = path.basename(originalname, ext)
=======
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
>>>>>>> 5caed4a (feat: fix issues get pdf file)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
<<<<<<< HEAD
    .substring(0, 80) || 'upload';

  return resourceType === 'raw'
    ? `${folder}/${base}${ext}`   // "books/pdfs/cafe.pdf"
    : `${folder}/${base}`;        // "books/covers/cafe"  (Cloudinary appends .jpg)
}

/**
 * Upload a file buffer to Cloudinary.
 * Returns the Cloudinary upload result (result.secure_url is the stored URL).
 */
function uploadToCloudinary(file, fieldName) {
  const resourceType = RESOURCE_TYPE[fieldName] || 'auto';
  const publicId     = buildPublicId(fieldName, file.originalname);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id:     publicId,
        resource_type: resourceType,
        type:          'upload',
        access_mode:   'public',
        overwrite:     true,
        invalidate:    true,   // clear CDN cache on overwrite
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
=======
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

>>>>>>> 5caed4a (feat: fix issues get pdf file)
    streamifier.createReadStream(file.buffer).pipe(stream);
  });
}

<<<<<<< HEAD
/**
 * Delete a file from Cloudinary by its stored URL.
 */
async function deleteFromCloudinary(storedUrl) {
  if (!storedUrl) return;
  try {
    const match = storedUrl.match(
      /res\.cloudinary\.com\/[^/]+\/(raw|image|video)\/upload(?:\/v\d+)?\/(.+)$/
    );
    if (!match) return;
    const resourceType = match[1];
    const publicId     = match[2].replace(/\.[^.]+$/, '');  // strip format extension
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch {
    // ignore — old/invalid URL
  }
}

/**
 * Build a download URL with fl_attachment:filename so the browser triggers
 * "Save As" with the original filename.
 * Works for public raw files without needing a signed URL.
 */
function buildDownloadUrl(storedUrl, filename) {
  if (!storedUrl) return storedUrl;
  const safeName = (filename || 'file')
    .replace(/\.pdf$/i, '')
    .replace(/[^\w\-]/g, '_')
    .replace(/_+/g, '_');
  // Insert fl_attachment transformation after /upload/
  return storedUrl.replace(
    /\/(raw|image|video)\/upload\//,
    `/$1/upload/fl_attachment:${safeName}/`
  );
}

module.exports = { uploadToCloudinary, deleteFromCloudinary, buildDownloadUrl };
=======
module.exports = { uploadToCloudinary, buildPublicId, getResourceType, MIME_TO_EXT };
>>>>>>> 5caed4a (feat: fix issues get pdf file)
