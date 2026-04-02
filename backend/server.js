const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
require('dotenv').config();

const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// ── Routes ──────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/students',     require('./routes/students'));
app.use('/api/companies',    require('./routes/companies'));
app.use('/api/drives',       require('./routes/drives'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/offers',       require('./routes/offers'));
app.use('/api/analytics',    require('./routes/analytics'));

// ── Health check ────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// ── 404 handler ─────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// ── Global error handler ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
});

// ── Start ───────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 CPMS API running on http://localhost:${PORT}`));

module.exports = app;
