# SFD Rider Hub — Backend API

Express.js + Neon PostgreSQL backend for the SFD Rider Hub finance tracker.

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Runtime    | Node.js 18+                         |
| Framework  | Express 4                           |
| Database   | Neon PostgreSQL (serverless)        |
| DB Driver  | node-postgres (`pg`)                |
| Validation | express-validator                   |
| Security   | helmet, cors, express-rate-limit    |

---

## Project Structure

```
sfd-rider-hub/
├── server.js              ← Entry point (Express app + routes mount)
├── .env.example           ← Copy to .env and fill in values
├── package.json
│
├── db/
│   ├── pool.js            ← Neon connection pool (pg.Pool)
│   ├── migrate.js         ← Creates all tables (run once)
│   └── seed.js            ← Populates demo data
│
├── routes/
│   ├── transactions.js    ← Full CRUD + summary + daily chart data
│   ├── wallets.js         ← E-wallet CRUD
│   ├── riders.js          ← Rider profile
│   └── categories.js      ← Category list
│
├── middleware/
│   ├── validate.js        ← express-validator error formatter
│   └── errorHandler.js    ← Global error handler
│
└── public/
    └── index.html         ← Place your sfd-rider-hub.html here
```

---

## 1. Neon Database Setup

### A. Create a Neon project

1. Go to **[https://console.neon.tech](https://console.neon.tech)**
2. Sign up / log in (free tier available)
3. Click **"New Project"**
4. Name it: `sfd-rider-hub`
5. Region: choose closest to you (e.g. `ap-southeast-1` for Philippines)
6. Click **Create Project**

### B. Get your connection string

1. In your Neon project dashboard, click **"Connection Details"**
2. Select **"Connection string"** tab
3. Copy the string — it looks like:
   ```
   postgresql://erwin:AbCdEfGh@ep-cool-forest-123456.ap-southeast-1.aws.neon.tech/sfd_rider_hub?sslmode=require
   ```
4. Paste it into your `.env` file as `DATABASE_URL`

> **Neon Free Tier Notes:**
> - 0.5 GB storage, 1 compute unit
> - Compute auto-suspends after 5 min of inactivity (cold start ~1s)
> - Perfect for development and low-traffic production use

---

## 2. Local Setup

### A. Clone / download and install dependencies

```bash
# Install all dependencies
npm install

# Or for production only
npm install --omit=dev
```

### B. Configure environment

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your values
nano .env   # or use VS Code, vim, etc.
```

Your `.env` must have at minimum:
```env
DATABASE_URL=postgresql://your_user:your_password@your-neon-host/sfd_rider_hub?sslmode=require
PORT=3000
NODE_ENV=development
```

### C. Run migrations (creates tables)

```bash
npm run db:migrate
```

Expected output:
```
🚀 Running SFD Rider Hub migrations on Neon PostgreSQL…

  [1/12] CREATE TABLE IF NOT EXISTS riders… ✓
  [2/12] CREATE TABLE IF NOT EXISTS wallets… ✓
  ...
✅ All migrations applied successfully.
```

### D. Seed demo data

```bash
npm run db:seed
```

This inserts:
- 1 demo rider (Erwin Reyes)
- 4 wallets (GCash, Maribank, ShopeePay, Cash)
- 9 categories
- 15 transactions across July 2024

### E. Start the server

```bash
# Development (auto-reload with nodemon)
npm run dev

# Production
npm start
```

Server starts at: **http://localhost:3000**

---

## 3. Connect the Frontend

Copy your `sfd-rider-hub.html` into the `public/` folder and rename it `index.html`:

```bash
cp path/to/sfd-rider-hub.html public/index.html
```

Then open **http://localhost:3000** — it will serve the HTML and the API together.

---

## 4. API Reference

### Health check
```
GET /health
```
Returns DB connection status and Neon server time.

---

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/transactions?rider_id=1` | List with filters + pagination |
| GET    | `/api/transactions/summary?rider_id=1&month=2024-07` | Income, expenses, net, savings rate |
| GET    | `/api/transactions/daily?rider_id=1&month=2024-07` | Daily chart data |
| GET    | `/api/transactions/:id` | Single transaction |
| POST   | `/api/transactions` | Create + update wallet balance |
| PATCH  | `/api/transactions/:id` | Update description/notes/category |
| DELETE | `/api/transactions/:id` | Delete + reverse wallet balance |

**POST body example:**
```json
{
  "rider_id":    1,
  "wallet_id":   1,
  "category_id": 1,
  "type":        "income",
  "amount":      1250.00,
  "description": "Delivery Payout",
  "source":      "SFD",
  "tx_date":     "2024-07-18"
}
```

**GET /api/transactions query params:**

| Param       | Example            | Notes                        |
|-------------|--------------------|------------------------------|
| rider_id    | `1`                | Required                     |
| type        | `income`           | `income` or `expense`        |
| wallet_id   | `2`                |                              |
| source      | `SFD`              | Partial match (ILIKE)        |
| date_from   | `2024-07-01`       | ISO date                     |
| date_to     | `2024-07-31`       | ISO date                     |
| search      | `fuel`             | Searches description+source  |
| sort        | `tx_date`          | `tx_date`, `amount`, `created_at` |
| order       | `desc`             | `asc` or `desc`              |
| page        | `1`                |                              |
| limit       | `20`               | Max 100                      |

---

### Wallets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/wallets?rider_id=1` | All wallets for rider |
| GET    | `/api/wallets/:id` | Single wallet |
| POST   | `/api/wallets` | Create wallet |
| PATCH  | `/api/wallets/:id` | Update wallet |
| DELETE | `/api/wallets/:id` | Deactivate wallet |

---

### Riders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/riders/:id` | Get rider profile |
| POST   | `/api/riders` | Create rider |
| PATCH  | `/api/riders/:id` | Update profile |

---

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/categories` | All categories |
| GET    | `/api/categories?type=income` | Filtered by type |

---

## 5. Database Schema

```sql
riders
  id, name, email, phone, avatar_url, created_at, updated_at

wallets
  id, rider_id → riders, name, wallet_type, balance,
  currency, color_class, is_active, created_at, updated_at

categories
  id, name, type (income|expense|both), icon, color_hex

transactions
  id, rider_id → riders, wallet_id → wallets,
  category_id → categories, type, amount, description,
  source, tx_date, notes, created_at, updated_at
```

**Key constraint:** Creating or deleting a transaction atomically updates `wallets.balance` in the same database transaction (BEGIN/COMMIT/ROLLBACK).

---

## 6. Deployment (Optional)

### Render.com (free tier, recommended)
1. Push to GitHub
2. New Web Service → connect repo
3. Build: `npm install`, Start: `npm start`
4. Add environment variables in Render dashboard

### Railway / Fly.io
Similar — connect repo, set `DATABASE_URL` and `PORT`.

> Neon works as the database for all of the above. No separate DB needed.

---

## 7. Common Issues

| Error | Fix |
|-------|-----|
| `DATABASE_URL is not set` | Check your `.env` file exists and has the correct key |
| `ECONNREFUSED` | Neon compute may be suspended — first request takes ~1s to wake |
| `SSL required` | Add `?sslmode=require` to your connection string |
| `relation "transactions" does not exist` | Run `npm run db:migrate` first |
| Port already in use | Change `PORT=3001` in `.env` |
