// ============================================
// FILE: src/middleware/validation.js
// ============================================

const { body, param, query, validationResult } = require("express-validator");
const ResponseFormatter = require("../utils/responseFormatter");


const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return ResponseFormatter.validationError(res, errors.array());
  }

  next();
};

// User validation rules
const userValidation = {
  register: [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("firstName").trim().notEmpty().withMessage("First name is required"),
    body("lastName").trim().notEmpty().withMessage("Last name is required"),
    body("studentId").optional().trim(),

    validate,
  ],

  login: [
    body("identifier").trim().notEmpty().withMessage("identifier (email / username / studentId) is required"),
    body("password").notEmpty().withMessage("password is required"),
    validate,
  ],
};

// Role validation rules
const userRules = {
  create: [
    body("username").trim().notEmpty().withMessage("username is required"),
    body("email").trim().isEmail().withMessage("valid email is required").normalizeEmail(),
    body("password").isLength({ min: 6 }).withMessage("password must be at least 6 characters"),
    body("roleIds").optional().isArray().withMessage("roleIds must be an array"),
    validate,
  ],

  update: [
    param("id").isInt({ min: 1 }).withMessage("valid user id is required"),
    body("firstName").optional().trim(),
    body("lastName").optional().trim(),
    body("studentId").optional().trim(),
    body("isActive").optional().isBoolean().withMessage("isActive must be boolean"),
    body("roleIds").optional().isArray().withMessage("roleIds must be an array"),
    validate,
  ],

  id: [
    param("id").isInt({ min: 1 }).withMessage("valid user id is required"),
    validate,
  ],

  assignRoles: [
    param("id").isInt({ min: 1 }).withMessage("valid user id is required"),
    body("roleIds").isArray({ min: 0 }).withMessage("roleIds must be an array"),
      validate,
  ],

  assignPermissions: [
    param("id").isInt({ min: 1 }).withMessage("valid user id is required"),
    body("permissionIds").isArray({ min: 0 }).withMessage("permissionIds must be an array"),
    validate,
  ],
};

// Permission validation rules
const permissionRules = {
  create: [
    body("name").trim().notEmpty().withMessage("name is required"),
    body("description").optional().trim(),
    validate,
  ],

  update: [
    param("id").isInt({ min: 1 }).withMessage("valid permission id is required"),
    body("name").optional().trim().notEmpty().withMessage("name cannot be empty"),
    body("description").optional().trim(),
    validate,
  ],

  id: [
    param("id").isInt({ min: 1 }).withMessage("valid permission id is required"),
    validate,
  ],
};

// Thesis validation rules
const thesisValidation = {
  create: [
    body("title")
      .trim()
      .notEmpty()
      .withMessage("Title is required")
      .isLength({ max: 500 })
      .withMessage("Title too long"),
    body("author").trim().notEmpty().withMessage("Author is required"),
    body("university").trim().notEmpty().withMessage("University is required"),
    body("year")
      .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
      .withMessage("Valid year is required"),
    body("category").trim().notEmpty().withMessage("Category is required"),
    body("tags").optional(),
    validate,
  ],

  update: [
    param("id").isInt().withMessage("Valid ID is required"),
    body("title")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Title too long"),
    body("year")
      .optional()
      .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
      .withMessage("Valid year is required"),
    validate,
  ],
};

// Publication validation rules
const publicationValidation = {
  create: [
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("author").trim().notEmpty().withMessage("Author is required"),
    body("year")
      .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
      .withMessage("Valid year is required"),
    body("category").trim().notEmpty().withMessage("Category is required"),
    validate,
  ],

  update: [param("id").isInt().withMessage("Valid ID is required"), validate],
};

// Journal validation rules
const journalValidation = {
  create: [
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("author").trim().notEmpty().withMessage("Author is required"),
    body("year")
      .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
      .withMessage("Valid year is required"),
    body("issn")
      .optional()
      .matches(/^\d{4}-\d{3}[\dX]$/)
      .withMessage("Invalid ISSN format (should be XXXX-XXXX)"),
    validate,
  ],

  update: [param("id").isInt().withMessage("Valid ID is required"), validate],
};


// Query validation
const queryValidation = {
  pagination: [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    validate,
  ],

  search: [
    query("q")
      .optional()
      .trim()
      .isLength({ min: 2 })
      .withMessage("Search query must be at least 2 characters"),
    validate,
  ],
};

// ID parameter validation
const idValidation = [
  param("id").isInt({ min: 1 }).withMessage("Valid ID is required"),
  validate,
];

module.exports = {
  validate,
  userValidation,
  userRules,
  permissionRules,
  thesisValidation,
  publicationValidation,
  journalValidation,
  queryValidation,
  idValidation,
};
