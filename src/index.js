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

// CORS
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://elibrary-user.vercel.app',
    'https://elibrary-dashboard.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/uploads', express.static('uploads'));

// ── Central API Router
app.use('/api', require('./routes'));

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

// 404 Handler for all other routes - Must be the LAST middleware
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.originalUrl} not found`
    }
  });
});

const http = require("http");
const { initSocket } = require("./socket");

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Start server
const PORT = process.env.PORT || 5005;

sequelize
  .authenticate()
  .then(() => {
    console.log("Database connected successfully!");
    // Only use alter: true in development environment and if explicitly needed
    // For now, let's sync without alter to ensure fast startup
    return sequelize.sync();
  })
  .then(() => {
    console.log("Database synced successfully!");
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
    // Even if DB fails, we should ideally let the server start or retry
    // But for now, we'll log it clearly
  });