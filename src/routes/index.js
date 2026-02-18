// ============================================
// FILE: src/routes/index.js
// ============================================

const express = require("express");
const router = express.Router();

// Import all route modules
const authRoutes = require("./auth");
// const userRoutes = require("./users");
// const roleRoutes = require("./roles");
// const permissionRoutes = require("./permissions");
const thesisRoutes = require("./thesis");
const journalsRoutes = require("./journals");
const categoriesRoutes = require("./categories");
const searchRoutes = require("./search");
const statsRoutes = require("./stats");

// Mount routes
router.use("/auth", authRoutes);
// router.use("/users", userRoutes);
// router.use("/roles", roleRoutes);
// router.use("/permissions", permissionRoutes);
router.use("/thesis", thesisRoutes);
router.use("/journals", journalsRoutes);
router.use("/categories", categoriesRoutes);
router.use("/search", searchRoutes);
router.use("/stats", statsRoutes);

// API info endpoint
router.get("/", (req, res) => {
  res.json({
    name: "E-Library API",
    version: "1.0.0",
    endpoints: {
      // auth: "/api/auth",
      // users: "/api/users",
      // roles: "/api/roles",
      // permissions: "/api/permissions",
      thesis: "/api/thesis",
      journals: "/api/journals",
      categories: "/api/categories",
      search: "/api/search",
      stats: "/api/stats",
    },
  });
});

module.exports = router;
