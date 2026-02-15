const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { sequelize } = require("./config/database");

const app = express();

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "E-Library API is running 🚀",
  });
});


// Middleware
app.use(helmet());
// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  })
);
// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Logging
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
// Static files
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/thesis", require("./routes/thesis"));
app.use("/api/publications", require("./routes/publications"));
app.use("/api/journals", require("./routes/journals"));
app.use("/api/audios", require("./routes/audios"));
app.use("/api/videos", require("./routes/videos"));
app.use("/api/search", require("./routes/search"));
app.use("/api/stats", require("./routes/stats"));
app.use("/api/upload", require("./routes/upload"));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || "INTERNAL_SERVER_ERROR",
      message: err.message || "Internal server error",
      details: err.details || null,
    },
  });
});

// Start server
const PORT = process.env.PORT || 5005;

sequelize
  .authenticate()
  .then(() => {
    console.log("Database connected successfully!");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
  });