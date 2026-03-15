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
    body("username").trim().notEmpty().withMessage("Username is required"),
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
    body("firstName").trim().notEmpty().withMessage("First name is required"),
    body("lastName").trim().notEmpty().withMessage("Last name is required"),
    body("studentId").optional().trim(),

    validate,
  ],

  login: [
    body("identifier").trim().notEmpty().withMessage("identifier (email / studentId) is required"),
    body("password").notEmpty().withMessage("password is required"),
    validate,
  ],
};

// Role validation rules
const userRules = {
  create: [
    body("email").trim().isEmail().withMessage("valid email is required").normalizeEmail(),
    body("password").isLength({ min: 8 }).withMessage("password must be at least 8 characters"),
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
  assignRolePermissions: [
    param("id").isInt({ min: 1 }).withMessage("valid role id is required"),
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
  queryValidation,
  idValidation,
};
