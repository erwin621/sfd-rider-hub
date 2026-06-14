# Site CMS — Network Operations Management System

A mobile-first web application for managing field site visits, connectivity checks, and financial reporting for government/school internet installations across Metro Manila NCR.

Built from the `New_CMS.xlsx` spreadsheet — all columns, formulas, and business logic are preserved.

---

## Tech Stack

| Layer      | Technology                            |
|------------|---------------------------------------|
| Framework  | React 18 + Vite 5                     |
| Styling    | Tailwind CSS 3                        |
| Routing    | React Router v6                       |
| Database   | Supabase (PostgreSQL)                 |
| Charts     | Recharts                              |
| Icons      | Lucide React                          |
| Date utils | date-fns                              |

---

## Project Structure

```
cms-app/
├── src/
│   ├── App.jsx              # Root layout (sidebar + routing)
│   ├── main.jsx             # Entry point
│   ├── index.css            # Tailwind directives
│   │
│   ├── components/
│   │   └── ui.jsx           # Shared UI: CodeChip, Modal, StatCard, Btn, inputs…
│   │
│   ├── data/
│   │   └── mockData.js      # All spreadsheet data (217 sites, 22 visits, 18 watchlist)
│   │
│   ├── hooks/
│   │   └── useData.js       # Supabase CRUD hooks (auto-falls back to mock data)
│   │
│   ├── lib/
│   │   └── supabase.js      # Supabase client
│   │
│   └── pages/
│       ├── Dashboard.jsx    # KPI cards + daily visits + city chart + recent visits
│       ├── Visits.jsx       # Full CRUD visit log with search + filtering
│       ├── Sites.jsx        # Master site registry + watchlist
│       ├── Reports.jsx      # Financial summary + income charts + check rates
│       └── Settings.jsx     # Expense config + user management + DB setup
│
├── supabase/
│   ├── schema.sql           # Full PostgreSQL schema + views + triggers
│   └── seed.sql             # All spreadsheet data as INSERT statements
│
├── .env.example             # Required environment variables
├── package.json
├── tailwind.config.js
└── vite.config.js
```

---

## Installation

### 1. Clone & install

```bash
git clone <your-repo>
cd cms-app
npm install
```

### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the **SQL Editor**, run `supabase/schema.sql` (creates all tables, views, and triggers)
3. Then run `supabase/seed.sql` (imports all spreadsheet data: sites, visits, watchlist, technicians)
4. Copy your **Project URL** and **anon key** from Settings → API

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run

```bash
npm run dev
# → http://localhost:5173
```

> **No Supabase?** The app runs in **mock mode** automatically when env vars are missing — all spreadsheet data is available locally via `src/data/mockData.js`.

### 5. Build for production

```bash
npm run build
# Output: dist/
```

Deploy the `dist/` folder to Vercel, Netlify, Cloudflare Pages, or any static host.

---

## Spreadsheet → App Mapping

| Sheet            | App Location                          | Notes                                              |
|------------------|---------------------------------------|----------------------------------------------------|
| `DB`             | **Visits page** (full CRUD table)     | All 217 rows mapped; Power/Conn/HW/Cable checks    |
| `UsersDB`        | **Settings → Users**                  | username/role management                           |
| `MAIN`           | **Dashboard** + **Reports**           | KPIs, financial summary, daily chart               |
| `Master`         | **Sites → All Sites tab**             | Last-visit tracking, recency color coding          |
| `NEW`            | **Sites → Watchlist tab**             | Issues, OFFLINE/DEFECTIVE labels with resolve flow |
| `RAWDATA`        | **Sites → All Sites tab**             | Full site registry by city                         |
| City sheets      | **Filters** on Visits & Sites         | Caloocan, Manila, QC, Valenzuela… as dropdowns     |

### Business Logic

| Rule                          | Implementation                                         |
|-------------------------------|--------------------------------------------------------|
| Net Income                    | `Total Income − Cash Advance − Motor Allowance`        |
| Connectivity pass rate        | `visits where connectivity_check = true / total * 100` |
| Daily income                  | Aggregated per `visit_date`, shown in Reports chart    |
| Watchlist                     | Unresolved items; marking resolved removes from list   |
| Average income/visit          | `total_income / visit_count`                           |
| Gas allowance                 | Tracked separately (not deducted from net in formula)  |

---

## Features

- **Dashboard** — KPI cards, daily visit trend line, city breakdown bar chart, recent visits feed, watchlist alert panel
- **Visits Log** — filterable & searchable table (code, site name, city, tech, check status), full Add / Edit / Delete with modal form
- **Sites** — master registry with last-visit recency coloring; Watchlist tab with issue badges and one-click resolve
- **Reports** — financial summary card (gradient), daily income + visit stacked chart, city income breakdown with progress bars, connectivity stacked bar by city, technician breakdown
- **Settings** — period + expense configuration with live net-income preview, user management

---

## Deployment to Vercel

```bash
npm i -g vercel
vercel deploy
```

Set environment variables in the Vercel dashboard under **Settings → Environment Variables**.

---

## Database Views (available via Supabase)

```sql
SELECT * FROM daily_summary;   -- income + visit count per day
SELECT * FROM city_summary;    -- income + visits per locality
SELECT * FROM tech_summary;    -- visits + income per technician
```

---

## License

Internal use — Azimuth / NCR Network Operations
