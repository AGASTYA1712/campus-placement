const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { protect, adminOnly } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// GET /api/drives
router.get('/', protect, async (req, res) => {
  try {
    const { status } = req.query;
    let where = status ? 'WHERE d.status=?' : '';
    const params = status ? [status] : [];

    const [rows] = await db.query(
      `SELECT d.*, c.company_name, c.sector, c.hr_email,
              COUNT(DISTINCT a.application_id) AS applicants,
              SUM(a.status='Offered')           AS offers_made
       FROM drives d
       JOIN companies c ON d.company_id=c.company_id
       LEFT JOIN applications a ON d.drive_id=a.drive_id
       ${where}
       GROUP BY d.drive_id
       ORDER BY d.drive_date DESC`, params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/drives/:id/eligible-students
router.get('/:id/eligible', protect, adminOnly, async (req, res) => {
  try {
    const [[drive]] = await db.query('SELECT * FROM drives WHERE drive_id=?', [req.params.id]);
    if (!drive) return res.status(404).json({ success: false, message: 'Drive not found' });

    const depts = JSON.parse(drive.dept_eligible || '[]');
    const deptFilter = depts.length
      ? `AND d.dept_code IN (${depts.map(() => '?').join(',')})`
      : '';

    const [rows] = await db.query(
      `SELECT s.student_id, s.first_name, s.last_name, s.email,
              s.cgpa, s.backlogs, d.dept_code
       FROM students s
       JOIN departments d ON s.department_id=d.department_id
       WHERE s.cgpa >= ? AND s.backlogs <= ? AND s.placed=0 ${deptFilter}
         AND s.student_id NOT IN (
           SELECT student_id FROM applications WHERE drive_id=?
         )`,
      [drive.min_cgpa, drive.max_backlogs, ...depts, drive.drive_id]
    );
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/drives
router.post('/', protect, adminOnly, [
  body('company_id').isInt(),
  body('role').notEmpty(),
  body('ctc_min').isFloat({ min: 0 }),
  body('ctc_max').isFloat({ min: 0 }),
  body('drive_date').isDate()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { company_id, role, ctc_min, ctc_max, min_cgpa=6.5, max_backlogs=0, drive_date, registration_deadline, dept_eligible=[], description } = req.body;
  try {
    const [result] = await db.query(
      `INSERT INTO drives (company_id, role, ctc_min, ctc_max, min_cgpa, max_backlogs, drive_date, registration_deadline, dept_eligible, description)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [company_id, role, ctc_min, ctc_max, min_cgpa, max_backlogs, drive_date, registration_deadline, JSON.stringify(dept_eligible), description]
    );
    res.status(201).json({ success: true, message: 'Drive created', drive_id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/drives/:id  (update status)
router.put('/:id', protect, adminOnly, async (req, res) => {
  const { role, ctc_min, ctc_max, min_cgpa, max_backlogs, drive_date, status, dept_eligible, description } = req.body;
  try {
    await db.query(
      `UPDATE drives SET role=?,ctc_min=?,ctc_max=?,min_cgpa=?,max_backlogs=?,drive_date=?,status=?,dept_eligible=?,description=?
       WHERE drive_id=?`,
      [role, ctc_min, ctc_max, min_cgpa, max_backlogs, drive_date, status, JSON.stringify(dept_eligible), description, req.params.id]
    );
    res.json({ success: true, message: 'Drive updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
