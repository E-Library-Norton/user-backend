const dotenv = require("dotenv");
dotenv.config({ path: ['.env.local', '.env'] });

const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const morgan  = require("morgan");
const { sequelize } = require("./config/database");

const app = express();

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://elibrary-user.vercel.app',
  'https://elibrary-dashboard.vercel.app',
  'https://frontend-admin-dev.vercel.app',
  'https://frontend.samnangchan.shop',
  'https://admin-elibrary.samnangchan.shop'
];

app.get("/", (req, res) => {
  res.status(200).json({ success: true, message: "E-Library API is running" });
});

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/uploads', express.static('uploads'));

// ── Routes
app.use('/api', require('./routes'));

// ── 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: `Route ${req.originalUrl} not found` },
  });
});

// ── Global error handler
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: {
      code:    err.code    || "INTERNAL_SERVER_ERROR",
      message: err.message || "Internal server error",
      details: err.details || null,
    },
  });
});

const PORT = process.env.PORT || 5005;

// Render free-tier databases go to sleep after inactivity.
// The first connection attempt wakes them up but may drop immediately.
// This retry loop waits 3 seconds and tries again automatically.
async function connectWithRetry(retries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await sequelize.authenticate();
      console.log("Database connected successfully!");
      await sequelize.sync({ alter: true });
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
      return;
    } catch (err) {
      console.warn(`DB connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt < retries) {
        console.log(`Retrying in ${delayMs / 1000}s...`);
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        console.error("Could not connect to database after several retries. Exiting.");
        process.exit(1);
      }
    }
  }
}

connectWithRetry();
