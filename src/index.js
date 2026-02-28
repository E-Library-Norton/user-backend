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

// ── RBAC routes 
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/permissions', require('./routes/permissions'));

// ── Library routes 
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/books', require('./routes/books'));
app.use('/api/authors', require('./routes/authors'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/publishers', require('./routes/publishers'));
app.use('/api/material-types', require('./routes/materialTypes'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/downloads', require('./routes/downloads'));

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