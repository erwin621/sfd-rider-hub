require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Middleware — declared ONCE, before routes
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// GET /api/dashboard — accepts optional ?start= &end= for timeframe filtering
app.get('/api/dashboard', async (req, res) => {
    try {
        const { start, end } = req.query;

        const { data: accounts, error: accError } = await supabase.from('accounts').select('*');
        if (accError) throw accError;

        let txQuery = supabase.from('transactions').select('type, amount');
        let recentQuery = supabase.from('transactions')
            .select('id, type, amount, description, created_at, account_id, accounts(name)')
            .order('created_at', { ascending: false })
            .limit(5);

        if (start && end) {
            txQuery   = txQuery.gte('created_at', start).lte('created_at', end);
            recentQuery = recentQuery.gte('created_at', start).lte('created_at', end);
        }

        const { data: allTx,  error: txError }     = await txQuery;
        const { data: recent, error: recentError } = await recentQuery;

        if (txError)     throw txError;
        if (recentError) throw recentError;

        let totalBalance = 0;
        (accounts || []).forEach(acc => { totalBalance += parseFloat(acc.balance) || 0; });

        let income = 0, expense = 0;
        (allTx || []).forEach(tx => {
            if (tx.type === 'income')  income  += parseFloat(tx.amount) || 0;
            else                       expense += parseFloat(tx.amount) || 0;
        });

        const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

        res.json({
            summary: { totalBalance, income, expense, savingsRate },
            accounts: accounts || [],
            recentTransactions: recent || []
        });
    } catch (e) {
        console.error('Dashboard Error:', e);
        res.status(500).json({ error: e.message || 'Failed to load dashboard' });
    }
});

// GET /api/transactions — accepts optional ?start= &end=
app.get('/api/transactions', async (req, res) => {
    try {
        const { start, end } = req.query;
        let query = supabase
            .from('transactions')
            .select('*, accounts(name)')
            .order('created_at', { ascending: false });

        if (start && end) {
            query = query.gte('created_at', start).lte('created_at', end);
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        console.error('Transactions Error:', e);
        res.status(500).json({ error: e.message || 'Failed to load transactions' });
    }
});

// POST /api/transactions
app.post('/api/transactions', async (req, res) => {
    try {
        const { account_id, type, amount, description } = req.body;

        if (!account_id || !type || !amount) {
            return res.status(400).json({ error: 'Missing required fields: account_id, type, amount' });
        }
        if (!['income', 'expense'].includes(type)) {
            return res.status(400).json({ error: 'type must be "income" or "expense"' });
        }
        if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            return res.status(400).json({ error: 'amount must be a positive number' });
        }

        const { data, error } = await supabase
            .from('transactions')
            .insert([{ account_id, type, amount: parseFloat(amount), description }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (e) {
        console.error('Create Transaction Error:', e);
        res.status(500).json({ error: e.message || 'Failed to create transaction' });
    }
});

// PUT /api/transactions/:id
app.put('/api/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { account_id, type, amount, description } = req.body;

        if (!account_id || !type || !amount) {
            return res.status(400).json({ error: 'Missing required fields: account_id, type, amount' });
        }
        if (!['income', 'expense'].includes(type)) {
            return res.status(400).json({ error: 'type must be "income" or "expense"' });
        }
        if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            return res.status(400).json({ error: 'amount must be a positive number' });
        }

        const { data, error } = await supabase
            .from('transactions')
            .update({ account_id, type, amount: parseFloat(amount), description })
            .eq('id', id)
            .select();

        if (error) throw error;
        if (!data || data.length === 0) return res.status(404).json({ error: 'Transaction not found' });
        res.json(data[0]);
    } catch (e) {
        console.error('Update Transaction Error:', e);
        res.status(500).json({ error: e.message || 'Failed to update transaction' });
    }
});

// Use PORT from .env (falls back to 3000)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Finance Tracker running on http://localhost:${PORT}`));
