// routes/categories.js
// Read-only category list (categories are managed via seed/admin).

'use strict';

const express = require('express');
const { query } = require('express-validator');
const { validate } = require('../middleware/validate');
const db = require('../db/pool');

const router = express.Router();

// GET /api/categories?type=income|expense|both
router.get('/', [
  query('type').optional().isIn(['income', 'expense', 'both']),
  validate,
], async (req, res, next) => {
  try {
    const params = [];
    let where = '';
    if (req.query.type) {
      params.push(req.query.type);
      where = `WHERE type = $1 OR type = 'both'`;
    }

    const result = await db.query(
      `SELECT id, name, type, icon, color_hex FROM categories ${where} ORDER BY name`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

module.exports = router;
