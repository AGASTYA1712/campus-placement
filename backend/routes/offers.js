const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { protect, adminOnly } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// ======================== OFFERS ========================

// GET /api/offers
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT o.*,
              CONCAT(s.first_name,' ',s.last_name) AS student_name,
              s.student_id, dep.dept_code,
              c.company_name, c.sector, d.role
       FROM offers o
       JOIN applications a ON o.application_id=a.application_id
       JOIN students s     ON a.student_id=s.student_id
       JOIN departments dep ON s.department_id=dep.department_id
       JOIN drives d       ON a.drive_id=d.drive_id
       JOIN companies c    ON d.company_id=c.company_id
       ORDER BY o.ctc DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/offers/stats
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const [[stats]] = await db.query(
      `SELECT COUNT(*) AS total_offers,
              SUM(accepted=1) AS accepted,
              ROUND(AVG(ctc),2) AS avg_ctc,
              MAX(ctc) AS max_ctc,
              MIN(ctc) AS min_ctc
       FROM offers`
    );
    const [bySector] = await db.query(
      `SELECT c.sector, COUNT(*) AS count, ROUND(AVG(o.ctc),2) AS avg_ctc
       FROM offers o
       JOIN applications a ON o.application_id=a.application_id
       JOIN drives d ON a.drive_id=d.drive_id
       JOIN companies c ON d.company_id=c.company_id
       GROUP BY c.sector ORDER BY avg_ctc DESC`
    );
    res.json({ success: true, data: { ...stats, bySector } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/offers
router.post('/', protect, adminOnly, [
  body('application_id').isInt(),
  body('ctc').isFloat({ min: 0 }),
  body('offer_date').isDate()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { application_id, ctc, offer_date, joining_date, offer_letter_url } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO offers (application_id, ctc, offer_date, joining_date, offer_letter_url) VALUES (?,?,?,?,?)',
      [application_id, ctc, offer_date, joining_date, offer_letter_url]
    );

    // update application status
    await db.query("UPDATE applications SET status='Offered' WHERE application_id=?", [application_id]);
    // mark student as placed
    const [[app]] = await db.query('SELECT student_id FROM applications WHERE application_id=?', [application_id]);
    await db.query('UPDATE students SET placed=1 WHERE student_id=?', [app.student_id]);

    res.status(201).json({ success: true, message: 'Offer created', offer_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Offer already exists for this application' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/offers/:id/accept
router.put('/:id/accept', protect, async (req, res) => {
  try {
    await db.query('UPDATE offers SET accepted=1 WHERE offer_id=?', [req.params.id]);
    res.json({ success: true, message: 'Offer accepted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======================== INTERVIEWS ========================

// GET /api/offers/interviews/:application_id
router.get('/interviews/:application_id', protect, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM interviews WHERE application_id=? ORDER BY round_no',
      [req.params.application_id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/offers/interviews
router.post('/interviews', protect, adminOnly, [
  body('application_id').isInt(),
  body('round_no').isInt({ min: 1 }),
  body('type').notEmpty(),
  body('interview_date').isDate()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { application_id, round_no, type, interview_date, score, result = 'Pending', notes } = req.body;
  try {
    const [res2] = await db.query(
      'INSERT INTO interviews (application_id, round_no, type, interview_date, score, result, notes) VALUES (?,?,?,?,?,?,?)',
      [application_id, round_no, type, interview_date, score, result, notes]
    );
    res.status(201).json({ success: true, message: 'Interview round added', interview_id: res2.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/offers/interviews/:id
router.put('/interviews/:id', protect, adminOnly, async (req, res) => {
  const { score, result, notes } = req.body;
  try {
    await db.query(
      'UPDATE interviews SET score=?, result=?, notes=? WHERE interview_id=?',
      [score, result, notes, req.params.id]
    );
    res.json({ success: true, message: 'Interview updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
