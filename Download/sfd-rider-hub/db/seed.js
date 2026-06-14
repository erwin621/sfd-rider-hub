// db/seed.js
// Populates Neon DB with a demo rider and realistic transactions.
// Usage: npm run db:seed

'use strict';

require('dotenv').config();
const { pool } = require('./pool');

async function seed() {
  console.log('🌱 Seeding SFD Rider Hub database…\n');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── 1. Clear existing data (dev only) ───────────
    await client.query('TRUNCATE transactions, wallets, categories, riders RESTART IDENTITY CASCADE');
    console.log('  [1] Cleared existing data ✓');

    // ── 2. Categories ────────────────────────────────
    const categories = [
      { name: 'Delivery',  type: 'income',  icon: 'truck',      color: '#2F7BFF' },
      { name: 'Payout',    type: 'income',  icon: 'banknote',   color: '#16A34A' },
      { name: 'Salary',    type: 'income',  icon: 'wallet',     color: '#16A34A' },
      { name: 'Bonus',     type: 'income',  icon: 'star',       color: '#F59E0B' },
      { name: 'Fuel',      type: 'expense', icon: 'fuel',       color: '#DC2626' },
      { name: 'Food',      type: 'expense', icon: 'utensils',   color: '#FF7B2F' },
      { name: 'Transport', type: 'expense', icon: 'car',        color: '#8B5CF6' },
      { name: 'Supplies',  type: 'expense', icon: 'package',    color: '#64748B' },
      { name: 'Others',    type: 'both',    icon: 'more-horizontal', color: '#94A3B8' },
    ];

    const catResult = await client.query(
      `INSERT INTO categories (name, type, icon, color_hex)
       SELECT name, type, icon, color_hex
       FROM jsonb_to_recordset($1::jsonb)
         AS t(name text, type text, icon text, color_hex text)
       RETURNING id, name`,
      [JSON.stringify(categories.map(c => ({ ...c, color_hex: c.color })))]
    );
    const catMap = Object.fromEntries(catResult.rows.map(r => [r.name, r.id]));
    console.log(`  [2] Inserted ${catResult.rowCount} categories ✓`);

    // ── 3. Demo rider ────────────────────────────────
    const riderRes = await client.query(
      `INSERT INTO riders (name, email, phone)
       VALUES ($1, $2, $3) RETURNING id`,
      ['Erwin Reyes', 'erwin@sfdrider.ph', '+63-917-000-0001']
    );
    const riderId = riderRes.rows[0].id;
    console.log(`  [3] Created rider id=${riderId} ✓`);

    // ── 4. Wallets ───────────────────────────────────
    const wallets = [
      { name: 'GCash',     type: 'ewallet', balance: 12500.00, color: 'gcash'    },
      { name: 'Maribank',  type: 'bank',    balance: 9800.00,  color: 'maribank' },
      { name: 'ShopeePay', type: 'ewallet', balance: 5100.00,  color: 'shopee'   },
      { name: 'Cash',      type: 'cash',    balance: 10150.00, color: 'cash'     },
    ];

    const walletRes = await client.query(
      `INSERT INTO wallets (rider_id, name, wallet_type, balance, color_class)
       SELECT $1, name, wallet_type, balance, color_class
       FROM jsonb_to_recordset($2::jsonb)
         AS t(name text, wallet_type text, balance numeric, color_class text)
       RETURNING id, name`,
      [riderId, JSON.stringify(wallets.map(w => ({ name: w.name, wallet_type: w.type, balance: w.balance, color_class: w.color })))]
    );
    const walletMap = Object.fromEntries(walletRes.rows.map(r => [r.name, r.id]));
    console.log(`  [4] Inserted ${walletRes.rowCount} wallets ✓`);

    // ── 5. Transactions ──────────────────────────────
    const txRows = [
      // July 2024
      { type:'income',  amount:4500.00, desc:'Client Payment',     wallet:'Maribank',  source:'Field Tech Job', cat:'Payout',   date:'2024-07-17' },
      { type:'expense', amount:580.00,  desc:'Fuel',                wallet:'Cash',      source:'SFD',            cat:'Fuel',     date:'2024-07-16' },
      { type:'income',  amount:2100.00, desc:'Shopee Order',        wallet:'ShopeePay', source:'SFD',            cat:'Delivery', date:'2024-07-15' },
      { type:'income',  amount:980.00,  desc:'Payout',              wallet:'GCash',     source:'Lalamove',       cat:'Payout',   date:'2024-07-15' },
      { type:'expense', amount:350.00,  desc:'Lunch',               wallet:'Cash',      source:'Personal',       cat:'Food',     date:'2024-07-14' },
      { type:'income',  amount:3200.00, desc:'Morning Deliveries',  wallet:'GCash',     source:'SFD',            cat:'Delivery', date:'2024-07-14' },
      { type:'expense', amount:150.00,  desc:'Load / Prepaid',      wallet:'Cash',      source:'Globe',          cat:'Others',   date:'2024-07-13' },
      { type:'income',  amount:1750.00, desc:'Afternoon Deliveries',wallet:'GCash',     source:'SFD',            cat:'Delivery', date:'2024-07-13' },
      { type:'expense', amount:820.00,  desc:'Motorcycle Oil Change',wallet:'Cash',     source:'Shop',           cat:'Supplies', date:'2024-07-12' },
      { type:'income',  amount:5500.00, desc:'Weekly SFD Payout',   wallet:'GCash',     source:'SFD',            cat:'Payout',   date:'2024-07-12' },
      { type:'income',  amount:1200.00, desc:'Lalamove Trip',       wallet:'GCash',     source:'Lalamove',       cat:'Delivery', date:'2024-07-11' },
      { type:'expense', amount:200.00,  desc:'Snacks',              wallet:'Cash',      source:'Personal',       cat:'Food',     date:'2024-07-11' },
      { type:'income',  amount:2800.00, desc:'Full Day SFD',        wallet:'GCash',     source:'SFD',            cat:'Delivery', date:'2024-07-10' },
      { type:'expense', amount:600.00,  desc:'Fuel',                wallet:'Cash',      source:'SFD',            cat:'Fuel',     date:'2024-07-09' },
      { type:'income',  amount:4200.00, desc:'Shopee Payout',       wallet:'ShopeePay', source:'Shopee',         cat:'Payout',   date:'2024-07-08' },
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
    console.log(`  [5] Inserted ${txRows.length} transactions ✓`);

    await client.query('COMMIT');
    console.log('\n✅ Database seeded successfully.\n');
    console.log('  Demo credentials:');
    console.log('  Email : erwin@sfdrider.ph');
    console.log('  Rider ID:', riderId);
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
