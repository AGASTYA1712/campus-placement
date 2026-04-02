const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const { body, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');

const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/login  (admin)
router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { email, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM admins WHERE email = ?', [email]);
    if (!rows.length) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const admin = rows[0];
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = signToken({ id: admin.admin_id, email: admin.email, role: admin.role, type: 'admin' });
    res.json({ success: true, token, user: { id: admin.admin_id, name: admin.name, email: admin.email, role: admin.role } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/student-login
router.post('/student-login', [
  body('student_id').notEmpty(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { student_id, password } = req.body;
  try {
    const [rows] = await db.query(
      `SELECT s.*, d.dept_code FROM students s
       JOIN departments d ON s.department_id = d.department_id
       WHERE s.student_id = ?`, [student_id]);
    if (!rows.length) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const student = rows[0];
    const match = await bcrypt.compare(password, student.password_hash);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = signToken({ id: student.student_id, role: 'student', type: 'student' });
    const { password_hash, ...safe } = student;
    res.json({ success: true, token, user: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
