const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { protect, adminOnly } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// GET /api/companies
router.get('/', protect, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*,
              COUNT(DISTINCT d.drive_id)       AS total_drives,
              COUNT(DISTINCT o.offer_id)        AS total_offers,
              ROUND(AVG(o.ctc),2)               AS avg_ctc,
              MAX(o.ctc)                        AS max_ctc
       FROM companies c
       LEFT JOIN drives d ON c.company_id=d.company_id
       LEFT JOIN applications a ON d.drive_id=a.drive_id
       LEFT JOIN offers o ON a.application_id=o.application_id
       GROUP BY c.company_id
       ORDER BY total_offers DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/companies/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const [[company]] = await db.query('SELECT * FROM companies WHERE company_id=?', [req.params.id]);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    const [drives] = await db.query(
      `SELECT d.*, COUNT(a.application_id) AS applicants,
              SUM(a.status='Offered') AS offers_made
       FROM drives d
       LEFT JOIN applications a ON d.drive_id=a.drive_id
       WHERE d.company_id=?
       GROUP BY d.drive_id ORDER BY d.drive_date DESC`, [req.params.id]
    );

    res.json({ success: true, data: { ...company, drives } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/companies
router.post('/', protect, adminOnly, [
  body('company_name').notEmpty(),
  body('sector').notEmpty(),
  body('hr_email').isEmail()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { company_name, sector, hr_name, hr_email, website } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO companies (company_name, sector, hr_name, hr_email, website) VALUES (?,?,?,?,?)',
      [company_name, sector, hr_name, hr_email, website]
    );
    res.status(201).json({ success: true, message: 'Company registered', company_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Company already registered' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/companies/:id
router.put('/:id', protect, adminOnly, async (req, res) => {
  const { company_name, sector, hr_name, hr_email, website } = req.body;
  try {
    await db.query(
      'UPDATE companies SET company_name=?,sector=?,hr_name=?,hr_email=?,website=? WHERE company_id=?',
      [company_name, sector, hr_name, hr_email, website, req.params.id]
    );
    res.json({ success: true, message: 'Company updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/companies/:id
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM companies WHERE company_id=?', [req.params.id]);
    res.json({ success: true, message: 'Company deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
