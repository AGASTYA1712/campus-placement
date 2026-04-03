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

// POST /api/auth/register-student  (Public)
router.post('/register-student', [
  body('student_id').notEmpty(),
  body('first_name').notEmpty(),
  body('last_name').notEmpty(),
  body('email').isEmail(),
  body('department_id').isInt(),
  body('cgpa').isFloat({ min: 0, max: 10 }),
  body('year_of_passing').isInt(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { student_id, first_name, last_name, email, phone, department_id, cgpa, year_of_passing, password } = req.body;
  const hash = await bcrypt.hash(password, 10);

  try {
    const [existing] = await db.query('SELECT * FROM students WHERE student_id = ? OR email = ?', [student_id, email]);
    if (existing.length) return res.status(400).json({ success: false, message: 'Student ID or Email already exists' });

    await db.query(
      `INSERT INTO students (student_id, first_name, last_name, email, phone, department_id, cgpa, year_of_passing, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [student_id, first_name, last_name, email, phone, department_id, cgpa, year_of_passing, hash]
    );

    res.status(201).json({ success: true, message: 'Student registered successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/register-admin  (Public with secret code)
router.post('/register-admin', [
  body('name').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('admin_code').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { name, email, password, admin_code } = req.body;
  const secretCode = process.env.ADMIN_REGISTRATION_CODE || 'CPMS_2024_ADMIN';

  if (admin_code !== secretCode) {
    return res.status(401).json({ success: false, message: 'Invalid admin registration code' });
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    const [existing] = await db.query('SELECT * FROM admins WHERE email = ?', [email]);
    if (existing.length) return res.status(400).json({ success: false, message: 'Email already exists' });

    await db.query(
      'INSERT INTO admins (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hash, 'coordinator']
    );

    res.status(201).json({ success: true, message: 'Admin registered successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  try {
    if (req.user.type === 'student') {
      const [[student]] = await db.query(
        'SELECT s.*, d.dept_code, d.dept_name FROM students s JOIN departments d ON s.department_id = d.department_id WHERE s.student_id = ?',
        [req.user.id]
      );
      if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
      const { password_hash, ...safe } = student;
      return res.json({ success: true, user: { ...safe, role: 'student' } });
    } else {
      const [[admin]] = await db.query('SELECT * FROM admins WHERE admin_id = ?', [req.user.id]);
      if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });
      const { password_hash, ...safe } = admin;
      return res.json({ success: true, user: { ...safe, role: admin.role || 'coordinator' } });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
