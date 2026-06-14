// routes/transactions.js
// Full CRUD for transactions + dashboard summary aggregates.

'use strict';

const express = require('express');
const { body, query, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const db = require('../db/pool');

const router = express.Router();

// ─────────────────────────────────────────────────────────
// GET /api/transactions
// List transactions for a rider with filtering, sorting, pagination
// Query: rider_id, type, wallet_id, category_id, source,
//        date_from, date_to, search, sort, order, page, limit
// ─────────────────────────────────────────────────────────
router.get('/', [
  query('rider_id').notEmpty().isInt({ min: 1 }).withMessage('rider_id is required'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validate,
], async (req, res, next) => {
  try {
    const {
      rider_id,
      type,
      wallet_id,
      category_id,
      source,
      date_from,
      date_to,
      search,
      sort    = 'tx_date',
      order   = 'desc',
      page    = 1,
      limit   = 20,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [rider_id];
    const conditions = ['t.rider_id = $1'];

    if (type)        { params.push(type);        conditions.push(`t.type = $${params.length}`); }
    if (wallet_id)   { params.push(wallet_id);   conditions.push(`t.wallet_id = $${params.length}`); }
    if (category_id) { params.push(category_id); conditions.push(`t.category_id = $${params.length}`); }
    if (source)      { params.push(source);      conditions.push(`t.source ILIKE $${params.length}`); }
    if (date_from)   { params.push(date_from);   conditions.push(`t.tx_date >= $${params.length}`); }
    if (date_to)     { params.push(date_to);     conditions.push(`t.tx_date <= $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(t.description ILIKE $${params.length} OR t.source ILIKE $${params.length})`);
    }

    const WHERE = conditions.join(' AND ');

    // Whitelist sort columns
    const allowedSort  = ['tx_date', 'amount', 'created_at'];
    const allowedOrder = ['asc', 'desc'];
    const safeSort  = allowedSort.includes(sort)   ? sort  : 'tx_date';
    const safeOrder = allowedOrder.includes(order) ? order : 'desc';

    // Total count for pagination
    const countRes = await db.query(
      `SELECT COUNT(*) FROM transactions t WHERE ${WHERE}`,
      params
    );
    const total = parseInt(countRes.rows[0].count);

    // Fetch page
    params.push(parseInt(limit), offset);
    const dataRes = await db.query(
      `SELECT
         t.id, t.type, t.amount, t.description, t.source, t.tx_date, t.notes,
         t.created_at,
         w.name  AS wallet_name,
         w.color_class AS wallet_color,
         c.name  AS category_name,
         c.color_hex AS category_color
       FROM transactions t
       JOIN wallets    w ON w.id = t.wallet_id
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE ${WHERE}
       ORDER BY t.${safeSort} ${safeOrder}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        total,
        page:     parseInt(page),
        limit:    parseInt(limit),
        pages:    Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────
// GET /api/transactions/summary
// Aggregate totals: income, expenses, net balance, savings rate
// Query: rider_id, month (YYYY-MM), year
// ─────────────────────────────────────────────────────────
router.get('/summary', [
  query('rider_id').notEmpty().isInt({ min: 1 }),
  validate,
], async (req, res, next) => {
  try {
    const { rider_id, month, year } = req.query;

    let dateFilter = '';
    const params = [rider_id];

    if (month) {
      // e.g. month=2024-07
      params.push(month + '-01');
      params.push(month + '-31');
      dateFilter = `AND tx_date BETWEEN $2 AND $3`;
    } else if (year) {
      params.push(year);
      dateFilter = `AND EXTRACT(YEAR FROM tx_date) = $2`;
    }

    const result = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) AS total_expenses,
         COALESCE(SUM(CASE WHEN type='income'  THEN amount
                           WHEN type='expense' THEN -amount ELSE 0 END), 0) AS net_balance,
         COUNT(*) AS transaction_count,
         COUNT(CASE WHEN type='income'  THEN 1 END) AS income_count,
         COUNT(CASE WHEN type='expense' THEN 1 END) AS expense_count
       FROM transactions
       WHERE rider_id = $1 ${dateFilter}`,
      params
    );

    const row = result.rows[0];
    const income   = parseFloat(row.total_income);
    const expenses = parseFloat(row.total_expenses);
    const savings_rate = income > 0
      ? Math.round(((income - expenses) / income) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        total_income:       income,
        total_expenses:     expenses,
        net_balance:        parseFloat(row.net_balance),
        savings_rate,
        transaction_count:  parseInt(row.transaction_count),
        income_count:       parseInt(row.income_count),
        expense_count:      parseInt(row.expense_count),
      },
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────
// GET /api/transactions/daily
// Daily income vs expense for a given month (for bar chart)
// Query: rider_id, month (YYYY-MM)
// ─────────────────────────────────────────────────────────
router.get('/daily', [
  query('rider_id').notEmpty().isInt({ min: 1 }),
  query('month').notEmpty().matches(/^\d{4}-\d{2}$/),
  validate,
], async (req, res, next) => {
  try {
    const { rider_id, month } = req.query;
    const result = await db.query(
      `SELECT
         tx_date,
         COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END),0) AS income,
         COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expense
       FROM transactions
       WHERE rider_id = $1
         AND TO_CHAR(tx_date,'YYYY-MM') = $2
       GROUP BY tx_date
       ORDER BY tx_date ASC`,
      [rider_id, month]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────
// GET /api/transactions/:id
// ─────────────────────────────────────────────────────────
router.get('/:id', [
  param('id').isInt({ min: 1 }),
  validate,
], async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT t.*, w.name AS wallet_name, c.name AS category_name
       FROM transactions t
       JOIN wallets w ON w.id = t.wallet_id
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.id = $1`,
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────
// POST /api/transactions
// Create a new transaction and update wallet balance atomically
// ─────────────────────────────────────────────────────────
router.post('/', [
  body('rider_id').notEmpty().isInt({ min: 1 }),
  body('wallet_id').notEmpty().isInt({ min: 1 }),
  body('type').isIn(['income', 'expense']).withMessage('type must be income or expense'),
  body('amount').isFloat({ min: 0.01 }).withMessage('amount must be > 0'),
  body('description').trim().notEmpty().isLength({ max: 255 }),
  body('tx_date').optional().isISO8601(),
  body('source').optional().trim().isLength({ max: 100 }),
  body('category_id').optional().isInt({ min: 1 }),
  body('notes').optional().trim().isLength({ max: 1000 }),
  validate,
], async (req, res, next) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rider_id, wallet_id, category_id, type, amount, description, source, tx_date, notes } = req.body;

    // Insert transaction
    const txRes = await client.query(
      `INSERT INTO transactions
         (rider_id, wallet_id, category_id, type, amount, description, source, tx_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [rider_id, wallet_id, category_id || null, type, amount, description, source || null, tx_date || new Date(), notes || null]
    );

    // Update wallet balance (+ income, – expense)
    const delta = type === 'income' ? amount : -amount;
    await client.query(
      `UPDATE wallets SET balance = balance + $1 WHERE id = $2`,
      [delta, wallet_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Transaction created',
      data: txRes.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────
// PATCH /api/transactions/:id
// Update a transaction (description, notes, category, source)
// Amount/type changes are intentionally excluded (delete + re-create)
// ─────────────────────────────────────────────────────────
router.patch('/:id', [
  param('id').isInt({ min: 1 }),
  body('description').optional().trim().notEmpty().isLength({ max: 255 }),
  body('source').optional().trim().isLength({ max: 100 }),
  body('notes').optional().trim().isLength({ max: 1000 }),
  body('category_id').optional().isInt({ min: 1 }),
  body('tx_date').optional().isISO8601(),
  validate,
], async (req, res, next) => {
  try {
    const { description, source, notes, category_id, tx_date } = req.body;
    const result = await db.query(
      `UPDATE transactions SET
         description = COALESCE($1, description),
         source      = COALESCE($2, source),
         notes       = COALESCE($3, notes),
         category_id = COALESCE($4, category_id),
         tx_date     = COALESCE($5, tx_date)
       WHERE id = $6
       RETURNING *`,
      [description, source, notes, category_id, tx_date, req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    res.json({ success: true, message: 'Transaction updated', data: result.rows[0] });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────
// DELETE /api/transactions/:id
// Delete transaction and reverse wallet balance
// ─────────────────────────────────────────────────────────
router.delete('/:id', [
  param('id').isInt({ min: 1 }),
  validate,
], async (req, res, next) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT * FROM transactions WHERE id = $1',
      [req.params.id]
    );
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const tx = existing.rows[0];
    await client.query('DELETE FROM transactions WHERE id = $1', [req.params.id]);

    // Reverse the balance change
    const delta = tx.type === 'income' ? -tx.amount : tx.amount;
    await client.query(
      'UPDATE wallets SET balance = balance + $1 WHERE id = $2',
      [delta, tx.wallet_id]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
