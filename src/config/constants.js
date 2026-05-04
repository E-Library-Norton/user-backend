// ============================================
// FILE: src/config/constants.js
// ============================================

module.exports = {

  FILE_TYPES: {
    PDF: "application/pdf",
    IMAGE: ["image/jpeg", "image/png", "image/webp", "image/jpg"],
  },

  MAX_FILE_SIZES: {
    PDF: 50 * 1024 * 1024, // 50MB
    IMAGE: 5 * 1024 * 1024, // 5MB
  },

  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  },

  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
  },
};
