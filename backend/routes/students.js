const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../config/db');
const { protect, adminOnly } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// GET /api/students  — list all with department info
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { dept, placed, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = [];
    let params = [];

    if (dept)   { where.push('d.dept_code = ?'); params.push(dept); }
    if (placed !== undefined) { where.push('s.placed = ?'); params.push(placed === 'true' ? 1 : 0); }
    if (search) { where.push('(s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_id LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [rows] = await db.query(
      `SELECT s.student_id, s.first_name, s.last_name, s.email, s.phone,
              s.cgpa, s.backlogs, s.year_of_passing, s.placed, s.created_at,
              d.dept_code, d.dept_name,
              GROUP_CONCAT(sk.skill_name ORDER BY sk.skill_name SEPARATOR ', ') AS skills
       FROM students s
       JOIN departments d ON s.department_id = d.department_id
       LEFT JOIN skills sk ON s.student_id = sk.student_id
       ${whereStr}
       GROUP BY s.student_id
       ORDER BY s.cgpa DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM students s JOIN departments d ON s.department_id=d.department_id ${whereStr}`,
      params
    );

    res.json({ success: true, data: rows, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/students/stats
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const [[counts]] = await db.query(
      `SELECT COUNT(*) AS total,
              SUM(placed=1) AS placed,
              SUM(placed=0) AS unplaced,
              ROUND(AVG(cgpa),2) AS avg_cgpa
       FROM students`
    );
    const [deptStats] = await db.query(
      `SELECT d.dept_code, COUNT(*) AS total, SUM(s.placed) AS placed
       FROM students s JOIN departments d ON s.department_id=d.department_id
       GROUP BY d.dept_code ORDER BY total DESC`
    );
    res.json({ success: true, data: { ...counts, deptStats } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/students/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.*, d.dept_code, d.dept_name,
              GROUP_CONCAT(sk.skill_name SEPARATOR ', ') AS skills
       FROM students s
       JOIN departments d ON s.department_id=d.department_id
       LEFT JOIN skills sk ON s.student_id=sk.student_id
       WHERE s.student_id=?
       GROUP BY s.student_id`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Student not found' });
    const { password_hash, ...student } = rows[0];
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/students
router.post('/', protect, adminOnly, [
  body('student_id').notEmpty(),
  body('first_name').notEmpty(),
  body('last_name').notEmpty(),
  body('email').isEmail(),
  body('cgpa').isFloat({ min: 0, max: 10 }),
  body('department_id').isInt(),
  body('year_of_passing').isInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { student_id, first_name, last_name, email, phone, department_id, cgpa, backlogs = 0, year_of_passing, skills = [], password } = req.body;
  const hash = await bcrypt.hash(password || student_id, 10);

  try {
    await db.query(
      `INSERT INTO students (student_id, first_name, last_name, email, phone, department_id, cgpa, backlogs, year_of_passing, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [student_id, first_name, last_name, email, phone, department_id, cgpa, backlogs, year_of_passing, hash]
    );

    if (skills.length) {
      const skillRows = skills.map(s => [student_id, s.name || s, s.proficiency || 'Intermediate']);
      await db.query('INSERT INTO skills (student_id, skill_name, proficiency) VALUES ?', [skillRows]);
    }

    res.status(201).json({ success: true, message: 'Student created', student_id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Student ID or email already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/students/:id
router.put('/:id', protect, adminOnly, async (req, res) => {
  const { first_name, last_name, email, phone, cgpa, backlogs, placed } = req.body;
  try {
    await db.query(
      `UPDATE students SET first_name=?, last_name=?, email=?, phone=?, cgpa=?, backlogs=?, placed=?, updated_at=NOW()
       WHERE student_id=?`,
      [first_name, last_name, email, phone, cgpa, backlogs, placed, req.params.id]
    );
    res.json({ success: true, message: 'Student updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/students/:id
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM students WHERE student_id=?', [req.params.id]);
    res.json({ success: true, message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/students/:id/applications
router.get('/:id/applications', protect, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.*, c.company_name, c.sector, d.role, d.ctc_min, d.ctc_max, d.drive_date
       FROM applications a
       JOIN drives d ON a.drive_id=d.drive_id
       JOIN companies c ON d.company_id=c.company_id
       WHERE a.student_id=?
       ORDER BY a.applied_at DESC`, [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
