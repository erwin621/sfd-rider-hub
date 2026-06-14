// db/seed.js
// Populates Neon DB with demo rider and realistic transactions.
// Dates are always generated relative to TODAY so the dashboard
// always shows real data regardless of when you run it.
// Usage: npm run db:seed

'use strict';

require('dotenv').config();
const { pool } = require('./pool');

// ── Date helpers ─────────────────────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

async function seed() {
  console.log('🌱 Seeding SFD Rider Hub database…\n');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── 1. Clear existing data ───────────────────────────
    await client.query('TRUNCATE transactions, wallets, categories, riders RESTART IDENTITY CASCADE');
    console.log('  [1] Cleared existing data ✓');

    // ── 2. Categories ────────────────────────────────────
    const categories = [
      { name: 'Delivery',  type: 'income',  icon: 'truck',           color_hex: '#2F7BFF' },
      { name: 'Payout',    type: 'income',  icon: 'banknote',        color_hex: '#16A34A' },
      { name: 'Salary',    type: 'income',  icon: 'wallet',          color_hex: '#16A34A' },
      { name: 'Bonus',     type: 'income',  icon: 'star',            color_hex: '#F59E0B' },
      { name: 'Fuel',      type: 'expense', icon: 'fuel',            color_hex: '#DC2626' },
      { name: 'Food',      type: 'expense', icon: 'utensils',        color_hex: '#FF7B2F' },
      { name: 'Transport', type: 'expense', icon: 'car',             color_hex: '#8B5CF6' },
      { name: 'Supplies',  type: 'expense', icon: 'package',         color_hex: '#64748B' },
      { name: 'Others',    type: 'both',    icon: 'more-horizontal', color_hex: '#94A3B8' },
    ];

    const catResult = await client.query(
      `INSERT INTO categories (name, type, icon, color_hex)
       SELECT name, type, icon, color_hex
       FROM jsonb_to_recordset($1::jsonb)
         AS t(name text, type text, icon text, color_hex text)
       RETURNING id, name`,
      [JSON.stringify(categories)]
    );
    const catMap = Object.fromEntries(catResult.rows.map(r => [r.name, r.id]));
    console.log(`  [2] Inserted ${catResult.rowCount} categories ✓`);

    // ── 3. Demo rider ────────────────────────────────────
    const riderRes = await client.query(
      `INSERT INTO riders (name, email, phone)
       VALUES ($1, $2, $3) RETURNING id`,
      ['Erwin Reyes', 'erwin@sfdrider.ph', '+63-917-000-0001']
    );
    const riderId = riderRes.rows[0].id;
    console.log(`  [3] Created rider id=${riderId} ✓`);

    // ── 4. Wallets ───────────────────────────────────────
    const wallets = [
      { name: 'GCash',     wallet_type: 'ewallet', balance: 12500.00, color_class: 'gcash'    },
      { name: 'Maribank',  wallet_type: 'bank',    balance:  9800.00, color_class: 'maribank' },
      { name: 'ShopeePay', wallet_type: 'ewallet', balance:  5100.00, color_class: 'shopee'   },
      { name: 'Cash',      wallet_type: 'cash',    balance: 10150.00, color_class: 'cash'     },
    ];

    const walletRes = await client.query(
      `INSERT INTO wallets (rider_id, name, wallet_type, balance, color_class)
       SELECT $1, name, wallet_type, balance, color_class
       FROM jsonb_to_recordset($2::jsonb)
         AS t(name text, wallet_type text, balance numeric, color_class text)
       RETURNING id, name`,
      [riderId, JSON.stringify(wallets)]
    );
    const walletMap = Object.fromEntries(walletRes.rows.map(r => [r.name, r.id]));
    console.log(`  [4] Inserted ${walletRes.rowCount} wallets ✓`);

    // ── 5. Transactions — dates relative to TODAY ────────
    // This ensures the dashboard always shows data for the current month.
    const txRows = [
      // This week (most recent)
      { type:'income',  amount:4500.00, desc:'Client Payment',      wallet:'Maribank',  source:'Field Tech Job', cat:'Payout',   date: daysAgo(0) },
      { type:'expense', amount:580.00,  desc:'Fuel',                wallet:'Cash',      source:'SFD',            cat:'Fuel',     date: daysAgo(1) },
      { type:'income',  amount:2100.00, desc:'Shopee Order Payout', wallet:'ShopeePay', source:'SFD',            cat:'Delivery', date: daysAgo(2) },
      { type:'income',  amount:980.00,  desc:'Lalamove Payout',     wallet:'GCash',     source:'Lalamove',       cat:'Payout',   date: daysAgo(2) },
      { type:'expense', amount:350.00,  desc:'Lunch',               wallet:'Cash',      source:'Personal',       cat:'Food',     date: daysAgo(3) },
      { type:'income',  amount:3200.00, desc:'Morning Deliveries',  wallet:'GCash',     source:'SFD',            cat:'Delivery', date: daysAgo(3) },
      // Last week
      { type:'expense', amount:150.00,  desc:'Load / Prepaid',      wallet:'Cash',      source:'Globe',          cat:'Others',   date: daysAgo(7) },
      { type:'income',  amount:1750.00, desc:'Afternoon Deliveries',wallet:'GCash',     source:'SFD',            cat:'Delivery', date: daysAgo(7) },
      { type:'expense', amount:820.00,  desc:'Motorcycle Oil Change',wallet:'Cash',     source:'Shop',           cat:'Supplies', date: daysAgo(8) },
      { type:'income',  amount:5500.00, desc:'Weekly SFD Payout',   wallet:'GCash',     source:'SFD',            cat:'Payout',   date: daysAgo(9) },
      { type:'income',  amount:1200.00, desc:'Lalamove Trip',       wallet:'GCash',     source:'Lalamove',       cat:'Delivery', date: daysAgo(10) },
      { type:'expense', amount:200.00,  desc:'Snacks & Drinks',     wallet:'Cash',      source:'Personal',       cat:'Food',     date: daysAgo(11) },
      { type:'income',  amount:2800.00, desc:'Full Day SFD Run',    wallet:'GCash',     source:'SFD',            cat:'Delivery', date: daysAgo(12) },
      { type:'expense', amount:600.00,  desc:'Fuel Refill',         wallet:'Cash',      source:'SFD',            cat:'Fuel',     date: daysAgo(13) },
      { type:'income',  amount:4200.00, desc:'Shopee Payout',       wallet:'ShopeePay', source:'Shopee',         cat:'Payout',   date: daysAgo(14) },
    ];

    for (const tx of txRows) {
      await client.query(
        `INSERT INTO transactions
           (rider_id, wallet_id, category_id, type, amount, description, source, tx_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          riderId,
          walletMap[tx.wallet],
          catMap[tx.cat] || null,
          tx.type,
          tx.amount,
          tx.desc,
          tx.source,
          tx.date,
        ]
      );
    }
    console.log(`  [5] Inserted ${txRows.length} transactions (dates: ${daysAgo(14)} → ${daysAgo(0)}) ✓`);

    await client.query('COMMIT');
    console.log('\n✅ Database seeded successfully.\n');
    console.log('  Rider ID :', riderId);
    console.log('  Email    : erwin@sfdrider.ph');
    console.log('  Date range:', daysAgo(14), '→', daysAgo(0));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Seed failed, rolled back.\n', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
