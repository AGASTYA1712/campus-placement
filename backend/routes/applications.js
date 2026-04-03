const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { protect, adminOnly } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// GET /api/applications
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { status, drive_id } = req.query;
    let where = [];
    let params = [];
    if (status)   { where.push('a.status=?');   params.push(status);   }
    if (drive_id) { where.push('a.drive_id=?'); params.push(drive_id); }
    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [rows] = await db.query(
      `SELECT a.*,
              CONCAT(s.first_name,' ',s.last_name) AS student_name,
              s.cgpa, s.email AS student_email,
              dep.dept_code,
              c.company_name, d.role, d.ctc_min, d.ctc_max, d.drive_date
       FROM applications a
       JOIN students s  ON a.student_id=s.student_id
       JOIN departments dep ON s.department_id=dep.department_id
       JOIN drives d    ON a.drive_id=d.drive_id
       JOIN companies c ON d.company_id=c.company_id
       ${whereStr}
       ORDER BY a.applied_at DESC`, params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/applications/me — student's own apps
router.get('/me', protect, async (req, res) => {
  try {
    const studentId = req.user.id;
    const [rows] = await db.query(
      `SELECT a.*, c.company_name, c.sector, d.role, d.ctc_min, d.ctc_max, d.drive_date
       FROM applications a
       JOIN drives d ON a.drive_id=d.drive_id
       JOIN companies c ON d.company_id=c.company_id
       WHERE a.student_id=?
       ORDER BY a.applied_at DESC`, [studentId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/applications  — student applies
router.post('/', protect, [
  body('drive_id').isInt(),
  body('student_id').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { student_id, drive_id } = req.body;
  try {
    // eligibility check
    const [[drive]] = await db.query('SELECT * FROM drives WHERE drive_id=?', [drive_id]);
    if (!drive) return res.status(404).json({ success: false, message: 'Drive not found' });

    const [[student]] = await db.query(
      'SELECT s.*, d.dept_code FROM students s JOIN departments d ON s.department_id=d.department_id WHERE s.student_id=?',
      [student_id]
    );
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    if (student.cgpa < drive.min_cgpa)
      return res.status(400).json({ success: false, message: `Minimum CGPA required: ${drive.min_cgpa}` });
    if (student.backlogs > drive.max_backlogs)
      return res.status(400).json({ success: false, message: `Maximum backlogs allowed: ${drive.max_backlogs}` });

    const depts = JSON.parse(drive.dept_eligible || '[]');
    if (depts.length && !depts.includes(student.dept_code))
      return res.status(400).json({ success: false, message: 'Your department is not eligible for this drive' });

    const [result] = await db.query(
      'INSERT INTO applications (student_id, drive_id) VALUES (?,?)',
      [student_id, drive_id]
    );
    res.status(201).json({ success: true, message: 'Application submitted', application_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Already applied to this drive' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/applications/:id/status  — admin updates status
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  const { status, remarks } = req.body;
  const validStatuses = ['Applied','Shortlisted','Interview','Offered','Rejected','Withdrawn'];
  if (!validStatuses.includes(status))
    return res.status(400).json({ success: false, message: 'Invalid status' });

  try {
    await db.query(
      'UPDATE applications SET status=?, remarks=?, updated_at=NOW() WHERE application_id=?',
      [status, remarks, req.params.id]
    );

    // auto-update student placed flag if offered
    if (status === 'Offered') {
      const [[app]] = await db.query('SELECT student_id FROM applications WHERE application_id=?', [req.params.id]);
      await db.query('UPDATE students SET placed=1, updated_at=NOW() WHERE student_id=?', [app.student_id]);
    }

    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/applications/pipeline  — kanban summary
router.get('/pipeline', protect, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.status, COUNT(*) AS count FROM applications a GROUP BY a.status`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
