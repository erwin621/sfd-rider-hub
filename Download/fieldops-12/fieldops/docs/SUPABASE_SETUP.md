# FieldOps — Complete Supabase Setup Guide

> **What this guide covers:** Creating your Supabase project from scratch, building all database tables, configuring authentication, setting up file storage, securing data with Row Level Security, and wiring everything to your Node.js backend — with exact click-by-click instructions at every step.

---

## Prerequisites

Before starting, make sure you have:

- A web browser (Chrome or Firefox recommended)
- Your FieldOps `server.js` file ready
- Node.js installed on your computer
- About **20–30 minutes** of uninterrupted time

---

## Part 1 — Create Your Supabase Account and Project

### Step 1 · Sign Up or Log In

1. Open your browser and go to **https://supabase.com**
2. Click the **"Start your project"** button in the top-right corner
3. Sign up using **GitHub** (recommended) or your email address
4. If using email, check your inbox for a confirmation email and click the link inside

---

### Step 2 · Create a New Project

1. After logging in, you will land on the **Dashboard** page
2. Click the green **"New project"** button
3. You will see a form — fill it in as follows:

   | Field | What to enter |
   |-------|--------------|
   | **Organization** | Select your personal org or create a new one |
   | **Project name** | `fieldops` (or any name you like) |
   | **Database Password** | Click "Generate a password" — **copy and save this password somewhere safe** |
   | **Region** | Choose the region closest to your users (e.g., Southeast Asia → Singapore) |
   | **Pricing plan** | Free tier is sufficient |

4. Click **"Create new project"**
5. Wait **1–3 minutes** while Supabase provisions your database. You will see a loading spinner. Do not close the tab.
6. When done, you will see your project dashboard with a green "Project is ready" message

---

## Part 2 — Build the Database Tables

You will run SQL commands in the Supabase **SQL Editor**. This is the built-in tool for running database queries.

### How to open the SQL Editor

1. In your project dashboard, look at the **left sidebar**
2. Click the **"SQL Editor"** icon (it looks like a terminal `>_` symbol)
3. Click **"New query"** in the top-left of the SQL Editor panel
4. You are now ready to paste and run SQL

> **How to run a query:** Paste the SQL into the editor, then click the **"Run"** button (or press `Ctrl+Enter` / `Cmd+Enter`). You will see a green "Success" message at the bottom if it worked, or a red error message if something went wrong.

---

### Step 3 · Create the `users` Table

This table stores the profile and role of every person in the system (admins and technicians). It is linked to Supabase's built-in authentication.

**In the SQL Editor, paste and run this entire block:**

```sql
-- ─────────────────────────────────────────────
-- TABLE: users
-- Stores profile data for every authenticated user
-- ─────────────────────────────────────────────
CREATE TABLE public.users (
    id            UUID        NOT NULL PRIMARY KEY,
    role          TEXT        NOT NULL CHECK (role IN ('admin', 'technician')),
    display_name  TEXT        NOT NULL,
    tech_code     TEXT        UNIQUE,
    pin           TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_id_fkey
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE  public.users         IS 'App-level user profiles linked to Supabase Auth';
COMMENT ON COLUMN public.users.tech_code IS 'Unique code used for technician login, e.g. Tech_Juan';
COMMENT ON COLUMN public.users.pin      IS 'Hashed PIN for technician login';
```

After clicking **Run**, you should see:

```
Success. No rows returned
```

---

### Step 4 · Create the `tickets` Table

This is the main table. It stores every service ticket that gets created through the batch upload.

**Paste and run this block:**

```sql
-- ─────────────────────────────────────────────
-- TABLE: tickets
-- Every field service ticket lives here
-- ─────────────────────────────────────────────
CREATE TABLE public.tickets (
    id                   UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id            TEXT        NOT NULL UNIQUE,
    site_id              TEXT        NOT NULL,
    site_name            TEXT        NOT NULL,
    locality             TEXT,
    address              TEXT,
    coordinates          TEXT,
    status               TEXT        NOT NULL DEFAULT 'OPEN'
                                     CHECK (status IN ('OPEN', 'ON_GOING', 'COMPLETED', 'CANCELLED')),
    priority             TEXT        NOT NULL DEFAULT 'LOW'
                                     CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
    assigned_to          UUID        REFERENCES public.users(id) ON DELETE SET NULL,
    proof_url            TEXT[]      NOT NULL DEFAULT '{}',
    notes                TEXT        DEFAULT '',
    cancellation_reason  TEXT,
    cancelled_by         TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed_at           TIMESTAMPTZ,
    completed_at         TIMESTAMPTZ,
    cancelled_at         TIMESTAMPTZ,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.tickets IS 'Field service tickets created by admins and worked by technicians';

-- Auto-update the updated_at column on every change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER tickets_set_updated_at
    BEFORE UPDATE ON public.tickets
    FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Indexes for fast filtering
CREATE INDEX idx_tickets_status      ON public.tickets(status);
CREATE INDEX idx_tickets_priority    ON public.tickets(priority);
CREATE INDEX idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX idx_tickets_site_id     ON public.tickets(site_id);
```

**Verify it worked:**
1. In the left sidebar, click **"Table Editor"**
2. You should see **tickets** listed under "Tables"
3. Click on it — you will see an empty table with all the columns listed above

---

### Step 5 · Create the `ticket_proofs` Table

This table stores metadata about every photo or video that technicians upload as proof of work.

**Paste and run this block:**

```sql
-- ─────────────────────────────────────────────
-- TABLE: ticket_proofs
-- Records every proof file uploaded per ticket
-- ─────────────────────────────────────────────
CREATE TABLE public.ticket_proofs (
    id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id    UUID        NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    file_url     TEXT        NOT NULL,
    file_type    TEXT        CHECK (file_type IN ('image', 'video')),
    file_name    TEXT,
    uploaded_by  UUID        REFERENCES public.users(id) ON DELETE SET NULL,
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.ticket_proofs IS 'Proof files (photos/videos) submitted by technicians on job completion';

CREATE INDEX idx_proofs_ticket_id ON public.ticket_proofs(ticket_id);
```

---

### Step 6 · Create the Auto-Profile Trigger

When a new user registers through Supabase Auth, this trigger automatically creates their profile row in the `public.users` table.

**Paste and run this block:**

```sql
-- ─────────────────────────────────────────────
-- TRIGGER: auto-create user profile on sign-up
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, role, display_name, tech_code)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'role',         'technician'),
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
        NEW.raw_user_meta_data->>'tech_code'
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_new_user();
```

---

## Part 3 — Create Your Users (Admin & Technicians)

### Step 7 · Create Users via the Auth Dashboard

1. In the left sidebar, click **"Authentication"** (the person icon)
2. Click **"Users"** in the sub-menu
3. Click the **"Add user"** button → select **"Create new user"**

**Create the Admin user:**

| Field | Value |
|-------|-------|
| Email | `admin@fieldops.com` |
| Password | `Admin@1234` (or any strong password) |
| Auto Confirm User | ✅ Turn ON |

Click **"Create user"**. You will see the user appear in the list. Copy their **UUID** (the long string like `a1b2c3d4-...`).

---

**Create Technician users** — repeat the same steps for each:

| Name | Email | Password |
|------|-------|----------|
| Tech Juan | `juan@fieldops.com` | `Juan@1234` |
| Tech Pedro | `pedro@fieldops.com` | `Pedro@1234` |
| Tech Maria | `maria@fieldops.com` | `Maria@1234` |

After creating all four users, go to **SQL Editor → New query** and run the following. **Replace each `'PASTE-UUID-HERE'` with the actual UUID you copied from the Auth dashboard.**

```sql
-- ─────────────────────────────────────────────
-- Set roles and display names for your users
-- Replace each UUID with the real value from
-- Authentication > Users in your dashboard
-- ─────────────────────────────────────────────

-- Admin
UPDATE public.users
SET role = 'admin', display_name = 'Administrator', tech_code = NULL
WHERE id = 'PASTE-ADMIN-UUID-HERE';

-- Tech Juan
UPDATE public.users
SET role = 'technician', display_name = 'Tech Juan', tech_code = 'Tech_Juan'
WHERE id = 'PASTE-JUAN-UUID-HERE';

-- Tech Pedro
UPDATE public.users
SET role = 'technician', display_name = 'Tech Pedro', tech_code = 'Tech_Pedro'
WHERE id = 'PASTE-PEDRO-UUID-HERE';

-- Tech Maria
UPDATE public.users
SET role = 'technician', display_name = 'Tech Maria', tech_code = 'Tech_Maria'
WHERE id = 'PASTE-MARIA-UUID-HERE';
```

**Verify it worked:** Run this query — you should see all 4 rows:

```sql
SELECT id, role, display_name, tech_code FROM public.users;
```

---

## Part 4 — Row Level Security (RLS)

Row Level Security makes sure users can only see and change data they are allowed to. Without this, anyone with your API key could read or edit everything.

### Step 8 · Enable RLS on All Tables

**Paste and run this block:**

```sql
-- Enable RLS on all app tables
ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_proofs ENABLE ROW LEVEL SECURITY;
```

---

### Step 9 · Add Security Policies

These rules define exactly who can read, create, update, and delete each record.

**Paste and run this entire block at once:**

```sql
-- ═══════════════════════════════════════
-- POLICIES: users table
-- ═══════════════════════════════════════

-- Any logged-in user can read their own profile
CREATE POLICY "users: read own profile"
ON public.users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Admins can read ALL user profiles
CREATE POLICY "users: admins read all"
ON public.users FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Users can update only their own profile
CREATE POLICY "users: update own profile"
ON public.users FOR UPDATE
TO authenticated
USING (auth.uid() = id);


-- ═══════════════════════════════════════
-- POLICIES: tickets table
-- ═══════════════════════════════════════

-- All logged-in users can read all tickets
CREATE POLICY "tickets: read all"
ON public.tickets FOR SELECT
TO authenticated
USING (TRUE);

-- Only admins can create tickets
CREATE POLICY "tickets: admins insert"
ON public.tickets FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Only admins can delete tickets
CREATE POLICY "tickets: admins delete"
ON public.tickets FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Admins can update anything; techs can only update their assigned ticket
CREATE POLICY "tickets: update rules"
ON public.tickets FOR UPDATE
TO authenticated
USING (
    -- Admins can update any ticket
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    )
    OR
    -- Technicians can update only their own assigned ticket
    assigned_to = auth.uid()
    OR
    -- Any tech can claim an unassigned OPEN ticket
    (status = 'OPEN' AND assigned_to IS NULL)
);


-- ═══════════════════════════════════════
-- POLICIES: ticket_proofs table
-- ═══════════════════════════════════════

-- All logged-in users can view proof files
CREATE POLICY "proofs: read all"
ON public.ticket_proofs FOR SELECT
TO authenticated
USING (TRUE);

-- Only the assigned technician can upload proof for their ticket
CREATE POLICY "proofs: tech inserts own"
ON public.ticket_proofs FOR INSERT
TO authenticated
WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.tickets
        WHERE id = ticket_id
          AND assigned_to = auth.uid()
    )
);

-- Admins can insert proofs too (for testing/correction)
CREATE POLICY "proofs: admins insert"
ON public.ticket_proofs FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    )
);
```

**Verify:** Run this to confirm all policies exist:

```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

You should see **11 rows** covering users, tickets, and ticket_proofs.

---

## Part 5 — Set Up File Storage

This is where technician photos and videos are stored.

### Step 10 · Create the Storage Bucket

1. In the left sidebar, click **"Storage"** (the folder icon)
2. Click **"New bucket"**
3. Fill in the form:

   | Field | Value |
   |-------|-------|
   | **Name** | `proofs` |
   | **Public bucket** | ✅ Turn ON (so file URLs work without extra tokens) |
   | **File size limit** | `50 MB` |
   | **Allowed MIME types** | `image/jpeg, image/png, image/webp, image/heic, video/mp4, video/quicktime` |

4. Click **"Create bucket"**

---

### Step 11 · Add Storage Policies

1. Click on your **"proofs"** bucket
2. Click the **"Policies"** tab
3. Click **"New policy"** → select **"Create a policy from scratch"**

**Add Policy 1 — Authenticated users can upload:**

| Field | Value |
|-------|-------|
| Policy name | `Authenticated users can upload` |
| Allowed operation | INSERT |
| Target roles | `authenticated` |
| USING expression | *(leave blank)* |
| WITH CHECK expression | `bucket_id = 'proofs'` |

Click **"Review"** then **"Save policy"**.

**Add Policy 2 — Anyone can view files:**

| Field | Value |
|-------|-------|
| Policy name | `Public read access` |
| Allowed operation | SELECT |
| Target roles | `public` |
| USING expression | `bucket_id = 'proofs'` |

Click **"Review"** then **"Save policy"**.

Alternatively, run both policies as SQL in the SQL Editor:

```sql
-- Allow authenticated users to upload proof files
CREATE POLICY "storage: authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'proofs');

-- Allow public read access to all proof files
CREATE POLICY "storage: public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'proofs');
```

---

## Part 6 — Get Your Credentials

### Step 12 · Copy Your API Keys

1. In the left sidebar, click **"Project Settings"** (the gear icon at the bottom)
2. Click **"API"** in the Settings sub-menu
3. You will see three things you need — copy all three:

```
Project URL:
https://xxxxxxxxxxxx.supabase.co
(Copy this — it is your SUPABASE_URL)

anon / public key:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
(Safe to use in the browser or frontend)

service_role key:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
(⚠️ KEEP SECRET — use only in server.js, never in frontend)
```

> **Important:** The `service_role` key bypasses all Row Level Security. It must only be used in your backend `server.js`, never in any file that runs in the browser.

---

### Step 13 · Create Your `.env` File

In your project folder (the same folder as `server.js`), create a new file called **`.env`** (with the dot at the start). Open it in a text editor and paste this:

```
# Supabase
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-service-role-key...

# Telegram (keep your existing values)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-chat-id

# Server
PORT=3000
```

Replace each placeholder with the real values you copied in Step 12.

> **Never commit `.env` to Git.** Add `.env` to your `.gitignore` file to protect your secrets.

---

## Part 7 — Update Your Backend

### Step 14 · Install Required Packages

Open your terminal, navigate to your project folder, and run:

```bash
npm install @supabase/supabase-js dotenv
```

---

### Step 15 · Add These Lines to the Top of `server.js`

Find the very top of your `server.js` file and add these two lines **before anything else**:

```javascript
require('dotenv').config();                          // loads .env file
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client (service role = bypasses RLS, for server use only)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);
```

---

### Step 16 · Replace the DB Helper Functions

Find the section in `server.js` that reads and writes `database.json` — it looks like this:

```javascript
function readDB() { ... }
function writeDB(data) { ... }
```

Replace both functions with these Supabase versions:

```javascript
// ─── Supabase helper: get all tickets ─────────────────
async function getAllTickets() {
    const { data, error } = await supabase
        .from('tickets')
        .select('*, assigned_user:users(display_name, tech_code)')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

// ─── Supabase helper: get user by tech_code ────────────
async function getUserByTechCode(techCode) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('tech_code', techCode)
        .single();
    if (error) throw error;
    return data;
}
```

---

### Step 17 · Replace Each API Endpoint

Below are the Supabase versions of each endpoint. Replace the matching sections in your `server.js` one by one.

---

**GET `/api/tickets/open`**

```javascript
app.get('/api/tickets/open', async (req, res) => {
    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('status', 'OPEN')
        .is('assigned_to', null)
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});
```

---

**GET `/api/tickets/all`**

```javascript
app.get('/api/tickets/all', async (req, res) => {
    const { data, error } = await supabase
        .from('tickets')
        .select('*, assigned_user:users(display_name)')
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});
```

---

**GET `/api/tickets/ongoing`**

```javascript
app.get('/api/tickets/ongoing', async (req, res) => {
    const { technician_id } = req.query;
    if (!technician_id) return res.status(400).json({ error: 'Missing technician_id' });

    const user = await getUserByTechCode(technician_id).catch(() => null);
    if (!user) return res.status(404).json({ error: 'Technician not found' });

    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('status', 'ON_GOING')
        .eq('assigned_to', user.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});
```

---

**GET `/api/tickets/completed`**

```javascript
app.get('/api/tickets/completed', async (req, res) => {
    const { technician_id } = req.query;
    if (!technician_id) return res.status(400).json({ error: 'Missing technician_id' });

    const user = await getUserByTechCode(technician_id).catch(() => null);
    if (!user) return res.status(404).json({ error: 'Technician not found' });

    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('status', 'COMPLETED')
        .eq('assigned_to', user.id)
        .order('completed_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});
```

---

**GET `/api/tickets/cancelled`**

```javascript
app.get('/api/tickets/cancelled', async (req, res) => {
    const { technician_id } = req.query;
    if (!technician_id) return res.status(400).json({ error: 'Missing technician_id' });

    const user = await getUserByTechCode(technician_id).catch(() => null);
    if (!user) return res.status(404).json({ error: 'Technician not found' });

    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('status', 'CANCELLED')
        .or(`assigned_to.eq.${user.id},cancelled_by.eq.${user.tech_code}`)
        .order('cancelled_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});
```

---

**POST `/api/tickets/claim`**

```javascript
app.post('/api/tickets/claim', async (req, res) => {
    const { ticket_id, technician_id } = req.body;
    if (!ticket_id || !technician_id)
        return res.status(400).json({ error: 'Missing ticket_id or technician_id' });

    const user = await getUserByTechCode(technician_id).catch(() => null);
    if (!user) return res.status(404).json({ error: 'Technician not found' });

    // Check ticket is still OPEN
    const { data: ticket } = await supabase
        .from('tickets').select('status').eq('ticket_id', ticket_id).single();
    if (!ticket || ticket.status !== 'OPEN')
        return res.status(409).json({ error: 'Ticket is no longer available' });

    const { error } = await supabase
        .from('tickets')
        .update({ status: 'ON_GOING', assigned_to: user.id, claimed_at: new Date().toISOString() })
        .eq('ticket_id', ticket_id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: `Ticket ${ticket_id} claimed by ${user.display_name}` });
});
```

---

**POST `/api/tickets/submit`**

```javascript
app.post('/api/tickets/submit', upload.array('proof', 5), async (req, res) => {
    const { ticket_id, technician_id, notes } = req.body;
    if (!ticket_id || !technician_id || !req.files?.length)
        return res.status(400).json({ error: 'Missing ticket_id, technician_id, or proof files' });

    const user = await getUserByTechCode(technician_id).catch(() => null);
    if (!user) return res.status(404).json({ error: 'Technician not found' });

    const proofUrls = [];

    // Upload each file to Supabase Storage
    for (const file of req.files) {
        const filePath = `${ticket_id}/${Date.now()}-${file.originalname}`;
        const fileBuffer = require('fs').readFileSync(file.path);

        const { error: uploadError } = await supabase.storage
            .from('proofs')
            .upload(filePath, fileBuffer, { contentType: file.mimetype, upsert: true });

        if (uploadError) {
            console.error('Storage upload error:', uploadError.message);
            continue;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('proofs')
            .getPublicUrl(filePath);

        proofUrls.push(publicUrl);

        // Save proof metadata
        await supabase.from('ticket_proofs').insert({
            ticket_id: (await supabase.from('tickets').select('id').eq('ticket_id', ticket_id).single()).data?.id,
            file_url: publicUrl,
            file_type: file.mimetype.startsWith('video') ? 'video' : 'image',
            file_name: file.originalname,
            uploaded_by: user.id
        });
    }

    // Mark ticket as completed
    const { error } = await supabase
        .from('tickets')
        .update({
            status: 'COMPLETED',
            proof_url: proofUrls,
            notes: notes || '',
            completed_at: new Date().toISOString()
        })
        .eq('ticket_id', ticket_id);

    if (error) return res.status(500).json({ error: error.message });

    // Send Telegram notification (existing logic stays the same)
    // ...

    res.json({ message: 'Job submitted and marked as Completed.' });
});
```

---

**POST `/api/tickets/cancel`**

```javascript
app.post('/api/tickets/cancel', async (req, res) => {
    const { ticket_id, cancelled_by, reason } = req.body;
    if (!ticket_id || !reason)
        return res.status(400).json({ error: 'Missing ticket_id or reason' });

    const { error } = await supabase
        .from('tickets')
        .update({
            status: 'CANCELLED',
            cancellation_reason: reason,
            cancelled_by: cancelled_by || 'unknown',
            cancelled_at: new Date().toISOString(),
            assigned_to: null
        })
        .eq('ticket_id', ticket_id)
        .in('status', ['OPEN', 'ON_GOING']);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: `Ticket ${ticket_id} cancelled.` });
});
```

---

**POST `/api/tickets/reopen`**

```javascript
app.post('/api/tickets/reopen', async (req, res) => {
    const { ticket_id } = req.body;
    if (!ticket_id) return res.status(400).json({ error: 'Missing ticket_id' });

    const { error } = await supabase
        .from('tickets')
        .update({
            status: 'OPEN',
            assigned_to: null,
            cancellation_reason: null,
            cancelled_by: null,
            cancelled_at: null,
            claimed_at: null
        })
        .eq('ticket_id', ticket_id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: `Ticket ${ticket_id} re-opened.` });
});
```

---

**POST `/api/admin/batch-upload`**

```javascript
app.post('/api/admin/batch-upload', async (req, res) => {
    const { sites } = req.body;
    if (!Array.isArray(sites) || !sites.length)
        return res.status(400).json({ error: 'sites array required' });

    let created = 0, escalated = 0, skipped = 0;

    for (const site of sites) {
        if (!site.site_id || !site.site_name) { skipped++; continue; }

        // Check if an OPEN ticket already exists for this site
        const { data: existing } = await supabase
            .from('tickets')
            .select('id, priority')
            .eq('site_id', site.site_id)
            .eq('status', 'OPEN')
            .maybeSingle();

        if (existing) {
            if (existing.priority !== 'HIGH') {
                await supabase.from('tickets')
                    .update({ priority: 'HIGH' })
                    .eq('id', existing.id);
                escalated++;
            } else {
                skipped++;
            }
        } else {
            const ticketId = `TKT-${Date.now().toString().slice(-4)}-${Math.floor(1000 + Math.random() * 9000)}`;
            const { error } = await supabase.from('tickets').insert({
                ticket_id:   ticketId,
                site_id:     site.site_id,
                site_name:   site.site_name,
                locality:    site.locality    || '',
                address:     site.address     || '',
                coordinates: site.coordinates || '',
                status:      'OPEN',
                priority:    (site.priority || 'LOW').toUpperCase()
            });
            if (!error) created++;
            else { console.error('Insert error:', error.message); skipped++; }
        }
    }

    res.json({
        message: `Done — Created: ${created} · Escalated to HIGH: ${escalated} · Skipped: ${skipped}`
    });
});
```

---

## Part 8 — Test Your Setup

### Step 18 · Start the Server

```bash
node server.js
```

You should see:

```
FieldOps running on http://localhost:3000
```

---

### Step 19 · Test Each Endpoint

Open a new terminal and run these `curl` commands one by one to verify everything works:

```bash
# 1. Check open tickets (should return empty array [])
curl http://localhost:3000/api/tickets/open

# 2. Create a test ticket via batch upload
curl -X POST http://localhost:3000/api/admin/batch-upload \
  -H "Content-Type: application/json" \
  -d '{"sites":[{"site_id":"SITE-TEST","site_name":"Test Site","locality":"Manila","address":"123 Test St","coordinates":"14.5995, 120.9842","priority":"MEDIUM"}]}'

# 3. Verify the ticket was created
curl http://localhost:3000/api/tickets/open

# 4. Check all tickets (admin view)
curl http://localhost:3000/api/tickets/all
```

Each command should return JSON without error messages.

---

### Step 20 · Verify Data in Supabase

1. Go to your Supabase dashboard
2. Click **"Table Editor"** in the left sidebar
3. Click on the **tickets** table
4. You should see the test ticket you created in Step 19

---

## Part 9 — Troubleshooting

### Error: `relation "public.users" does not exist`
You skipped Part 2. Go back and run the SQL in Steps 3–6 in order.

### Error: `new row violates row-level security policy`
Your `.env` file is using the **anon key** instead of the **service_role key**. The server must use `SUPABASE_SERVICE_KEY` (service_role), not the anon key.

### Error: `invalid input value for enum` or check constraint violation
You are passing a status or priority value that is not in the allowed list. Allowed values are:
- **status:** `OPEN`, `ON_GOING`, `COMPLETED`, `CANCELLED`
- **priority:** `HIGH`, `MEDIUM`, `LOW`

### Error: `SUPABASE_URL is not defined`
Your `.env` file is either missing, in the wrong folder, or `require('dotenv').config()` is not at the top of `server.js`.

### Storage upload returns `Error: The resource already exists`
Add `upsert: true` to your storage upload call (already included in the code above).

### Technician cannot see their completed/cancelled jobs
Check that the `tech_code` column in `public.users` exactly matches what is stored in the `assigned_to` or `cancelled_by` field. They are case-sensitive (`Tech_Juan` ≠ `tech_juan`).

---

## Quick Reference Card

| What you need | Where to find it |
|---------------|-----------------|
| `SUPABASE_URL` | Project Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Project Settings → API → service_role key |
| `SUPABASE_ANON_KEY` | Project Settings → API → anon/public key |
| Auth user UUIDs | Authentication → Users → click a user → copy UUID |
| Storage bucket URL | Storage → proofs → bucket URL |
| SQL Editor | Left sidebar → `>_` icon |
| Table Editor | Left sidebar → table icon |

---

## Database Structure Summary

```
auth.users  ← Supabase built-in authentication
     │
     └──► public.users
               │  id, role, display_name, tech_code, pin
               │
               ├──► public.tickets
               │         id, ticket_id, site_id, site_name
               │         locality, address, coordinates
               │         status, priority
               │         assigned_to → users.id
               │         proof_url[], notes
               │         cancellation_reason, cancelled_by
               │         created_at, claimed_at, completed_at,
               │         cancelled_at, updated_at
               │
               └──► public.ticket_proofs
                         id, ticket_id → tickets.id
                         file_url (Supabase Storage public URL)
                         file_type (image / video)
                         file_name, uploaded_by → users.id
                         uploaded_at
```

---

*FieldOps Supabase Setup Guide — June 2026*
