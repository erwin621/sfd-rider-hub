# FieldOps — Field Service Management System

A clean, full-stack field service management app built with **Node.js + Express** on the backend and a beautiful single-page **HTML/CSS/JS** frontend. Supports both a cloud **Supabase** database and a local JSON fallback for development.

---

## Features

- **Admin Portal** — batch upload sites, view all tickets with filters, cancel or re-open tickets, live stats dashboard
- **Tech Portal** — claim open jobs, submit photo/video proof, add completion notes, view completed and cancelled history
- **Telegram Notifications** — proof photos/videos sent directly to a Telegram group on job completion
- **Dual-mode DB** — runs on local `database.json` with zero config, or connects to Supabase for production

---

## Quick Start (Local Mode — No Supabase Required)

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open in browser
open http://localhost:3000
```

That is it. No database setup needed. Data is stored in `database.json`.

**Demo credentials**

| Role | Username / Name | Password / PIN |
|------|-----------------|----------------|
| Admin | `admin` | `admin123` |
| Admin | `supervisor` | `super456` |
| Tech | Tech Juan | `1234` |
| Tech | Tech Pedro | `5678` |
| Tech | Tech Maria | `9012` |

---

## Production Setup (Supabase + Telegram)

1. Copy `.env.example` to `.env` and fill in your credentials:

   ```bash
   cp .env.example .env
   ```

2. Follow the full step-by-step database setup guide:

   ```
   docs/SUPABASE_SETUP.md
   ```

3. If you hit a SQL policy error during setup, refer to:

   ```
   docs/STEP9_FIX.md
   ```

4. Start the server:

   ```bash
   npm start
   ```

---

## Project Structure

```
fieldops/
├── public/
│   └── index.html        ← Frontend (single-page app)
├── docs/
│   ├── SUPABASE_SETUP.md ← Full Supabase setup guide (Steps 1–20)
│   └── STEP9_FIX.md      ← Fix for RLS policy UUID type error
├── uploads/              ← Local proof file storage (auto-created)
├── server.js             ← Express backend (all API routes)
├── database.json         ← Local JSON database (auto-created)
├── package.json
├── .env.example          ← Copy to .env and fill in credentials
└── .gitignore
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets/open` | All unassigned open tickets |
| GET | `/api/tickets/all` | All tickets — admin view |
| GET | `/api/tickets/ongoing?technician_id=X` | Tech's active jobs |
| GET | `/api/tickets/completed?technician_id=X` | Tech's completed jobs |
| GET | `/api/tickets/cancelled?technician_id=X` | Tech's cancelled jobs |
| POST | `/api/tickets/claim` | Claim an open ticket |
| POST | `/api/tickets/submit` | Submit proof + mark complete |
| POST | `/api/tickets/cancel` | Cancel an open or ongoing ticket |
| POST | `/api/tickets/reopen` | Re-open a cancelled ticket (admin) |
| POST | `/api/admin/batch-upload` | Batch create tickets from site list |

---

## Development

```bash
# Auto-restart on file changes
npm run dev
```

Requires `nodemon` (included as a dev dependency).

---

## Tech Stack

- **Backend** — Node.js, Express, Multer, Axios
- **Database** — Supabase (PostgreSQL) or local JSON fallback
- **Frontend** — Vanilla HTML/CSS/JS, Figtree + Fira Code fonts
- **Notifications** — Telegram Bot API
- **Auth** — Frontend PIN auth + Supabase Auth (production)
