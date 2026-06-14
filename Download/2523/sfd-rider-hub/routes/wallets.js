// routes/wallets.js
// CRUD for e-wallets + balance read endpoints.

'use strict';

const express = require('express');
const { body, query, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const db = require('../db/pool');

const router = express.Router();

// GET /api/wallets?rider_id=1
router.get('/', [
  query('rider_id').notEmpty().isInt({ min: 1 }),
  validate,
], async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, name, wallet_type, balance, currency, color_class, is_active, updated_at
       FROM wallets
       WHERE rider_id = $1 AND is_active = TRUE
       ORDER BY name ASC`,
      [req.query.rider_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// GET /api/wallets/:id
router.get('/:id', [
  param('id').isInt({ min: 1 }),
  validate,
], async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM wallets WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/wallets
router.post('/', [
  body('rider_id').notEmpty().isInt({ min: 1 }),
  body('name').trim().notEmpty().isLength({ max: 80 }),
  body('wallet_type').optional().isIn(['ewallet', 'bank', 'cash']),
  body('balance').optional().isFloat({ min: 0 }),
  body('color_class').optional().trim().isLength({ max: 30 }),
  validate,
], async (req, res, next) => {
  try {
    const { rider_id, name, wallet_type = 'ewallet', balance = 0, color_class } = req.body;
    const result = await db.query(
      `INSERT INTO wallets (rider_id, name, wallet_type, balance, color_class)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [rider_id, name, wallet_type, balance, color_class || null]
    );
    res.status(201).json({ success: true, message: 'Wallet created', data: result.rows[0] });
  } catch (err) { next(err); }
});

// PATCH /api/wallets/:id
router.patch('/:id', [
  param('id').isInt({ min: 1 }),
  body('name').optional().trim().notEmpty().isLength({ max: 80 }),
  body('color_class').optional().trim().isLength({ max: 30 }),
  body('is_active').optional().isBoolean(),
  validate,
], async (req, res, next) => {
  try {
    const { name, color_class, is_active } = req.body;
    const result = await db.query(
      `UPDATE wallets SET
         name        = COALESCE($1, name),
         color_class = COALESCE($2, color_class),
         is_active   = COALESCE($3, is_active)
       WHERE id = $4 RETURNING *`,
      [name, color_class, is_active, req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }
    res.json({ success: true, message: 'Wallet updated', data: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/wallets/:id  (soft delete)
router.delete('/:id', [
  param('id').isInt({ min: 1 }),
  validate,
], async (req, res, next) => {
  try {
    // Check for linked transactions first
    const check = await db.query(
      'SELECT COUNT(*) FROM transactions WHERE wallet_id = $1',
      [req.params.id]
    );
    if (parseInt(check.rows[0].count) > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete a wallet that has transactions. Deactivate it instead.',
      });
    }
    await db.query('UPDATE wallets SET is_active = FALSE WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Wallet deactivated' });
  } catch (err) { next(err); }
});

module.exports = router;
