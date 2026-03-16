// utils/cloudinaryUpload.js
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
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
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
    streamifier.createReadStream(file.buffer).pipe(stream);
  });
}

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
