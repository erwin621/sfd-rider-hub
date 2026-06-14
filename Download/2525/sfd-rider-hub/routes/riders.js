// routes/riders.js
// Rider profile management.

'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const db = require('../db/pool');

const router = express.Router();

// GET /api/riders/:id
router.get('/:id', [
  param('id').isInt({ min: 1 }),
  validate,
], async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, phone, avatar_url, created_at FROM riders WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Rider not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/riders
router.post('/', [
  body('name').trim().notEmpty().isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').optional().trim().isLength({ max: 30 }),
  validate,
], async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;
    const result = await db.query(
      `INSERT INTO riders (name, email, phone) VALUES ($1,$2,$3)
       RETURNING id, name, email, phone, created_at`,
      [name, email, phone || null]
    );
    res.status(201).json({ success: true, message: 'Rider created', data: result.rows[0] });
  } catch (err) { next(err); }
});

// PATCH /api/riders/:id
router.patch('/:id', [
  param('id').isInt({ min: 1 }),
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('phone').optional().trim().isLength({ max: 30 }),
  body('avatar_url').optional().isURL(),
  validate,
], async (req, res, next) => {
  try {
    const { name, phone, avatar_url } = req.body;
    const result = await db.query(
      `UPDATE riders SET
         name       = COALESCE($1, name),
         phone      = COALESCE($2, phone),
         avatar_url = COALESCE($3, avatar_url)
       WHERE id = $4
       RETURNING id, name, email, phone, avatar_url`,
      [name, phone, avatar_url, req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Rider not found' });
    }
    res.json({ success: true, message: 'Profile updated', data: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
