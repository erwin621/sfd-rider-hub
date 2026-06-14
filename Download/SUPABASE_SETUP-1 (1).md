# FieldOps — Supabase Database Setup Guide

> Replace the flat `database.json` file with a production-ready PostgreSQL
> database hosted on Supabase. Includes auth, Row-Level Security (RLS),
> and ready-to-paste SQL for every table and policy.

---

## 1. Create a Supabase Project

1. Go to **https://supabase.com** and sign in.
2. Click **New Project**, choose an org, give it a name (e.g. `fieldops`),
   set a strong DB password, and pick your region.
3. Wait ~2 minutes for provisioning.

---

## 2. Database Schema

Open **SQL Editor → New query** and paste each block below, in order.

---

### 2a. `users` table (extends Supabase Auth)

```sql
-- Public profile for every auth user
CREATE TABLE public.users (
    id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role          TEXT        NOT NULL CHECK (role IN ('admin', 'technician')),
    display_name  TEXT        NOT NULL,
    tech_code     TEXT        UNIQUE,   -- e.g. "Tech_Juan" (null for admins)
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create a profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.users (id, role, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'role', 'technician'),
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

---

### 2b. `tickets` table

```sql
CREATE TABLE public.tickets (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id     TEXT        UNIQUE NOT NULL,          -- e.g. "TKT-0842-4360"
    site_id       TEXT        NOT NULL,
    site_name     TEXT        NOT NULL,
    locality      TEXT,
    address       TEXT,
    coordinates   TEXT,
    status        TEXT        NOT NULL DEFAULT 'OPEN'
                              CHECK (status IN ('OPEN', 'ON_GOING', 'COMPLETED')),
    priority      TEXT        NOT NULL DEFAULT 'LOW'
                              CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
    assigned_to   UUID        REFERENCES public.users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update `updated_at` on every row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER tickets_updated_at
    BEFORE UPDATE ON public.tickets
    FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Useful indexes
CREATE INDEX idx_tickets_status   ON public.tickets(status);
CREATE INDEX idx_tickets_priority ON public.tickets(priority);
CREATE INDEX idx_tickets_assigned ON public.tickets(assigned_to);
```

---

### 2c. `ticket_proofs` table

```sql
CREATE TABLE public.ticket_proofs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id    UUID        NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    file_url     TEXT        NOT NULL,   -- Supabase Storage public URL
    file_type    TEXT,                   -- 'image' or 'video'
    uploaded_by  UUID        REFERENCES public.users(id) ON DELETE SET NULL,
    uploaded_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proofs_ticket ON public.ticket_proofs(ticket_id);
```

---

## 3. Row-Level Security (RLS)

Enable RLS on all three tables, then add policies.

```sql
ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_proofs ENABLE ROW LEVEL SECURITY;
```

### 3a. `users` policies

```sql
-- Anyone logged in can read their own profile
CREATE POLICY "users_read_own" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "admins_read_all_users" ON public.users
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- Users can update their own profile
CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE USING (auth.uid() = id);
```

### 3b. `tickets` policies

```sql
-- Everyone logged in can read all tickets
CREATE POLICY "read_all_tickets" ON public.tickets
    FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can create / delete tickets
CREATE POLICY "admins_insert_tickets" ON public.tickets
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "admins_delete_tickets" ON public.tickets
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- Admins can update anything; techs can only update tickets assigned to them
CREATE POLICY "update_tickets" ON public.tickets
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        OR assigned_to = auth.uid()
        OR (status = 'OPEN' AND assigned_to IS NULL)  -- allows claiming
    );
```

### 3c. `ticket_proofs` policies

```sql
-- Everyone logged in can read proofs
CREATE POLICY "read_proofs" ON public.ticket_proofs
    FOR SELECT USING (auth.role() = 'authenticated');

-- Only technicians who own the ticket can insert proofs
CREATE POLICY "tech_insert_proof" ON public.ticket_proofs
    FOR INSERT WITH CHECK (
        uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.tickets
            WHERE id = ticket_id AND assigned_to = auth.uid()
        )
    );
```

---

## 4. Supabase Storage (for photo / video uploads)

1. Go to **Storage → New bucket**.
2. Name it `proofs`, set it to **Public** (so URLs work without tokens).
3. Add an upload policy:

```sql
-- In the Supabase Storage policies editor (or via SQL):
CREATE POLICY "techs_upload_proof"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'proofs'
    AND auth.role() = 'authenticated'
);

CREATE POLICY "public_read_proof"
ON storage.objects FOR SELECT
USING ( bucket_id = 'proofs' );
```

---

## 5. Seed Initial Users

In SQL Editor, first create the auth users via the **Supabase Dashboard → Authentication → Users → Invite user**, or use the API. Then run this SQL to set their roles and codes:

```sql
-- Replace the UUIDs with the real IDs from auth.users after creating them
UPDATE public.users SET role='admin',      display_name='Administrator',  tech_code=NULL        WHERE id='<admin-uuid>';
UPDATE public.users SET role='technician', display_name='Tech Juan',  tech_code='Tech_Juan'  WHERE id='<juan-uuid>';
UPDATE public.users SET role='technician', display_name='Tech Pedro', tech_code='Tech_Pedro' WHERE id='<pedro-uuid>';
UPDATE public.users SET role='technician', display_name='Tech Maria', tech_code='Tech_Maria' WHERE id='<maria-uuid>';
```

---

## 6. Update `server.js` to use Supabase

### Install the client

```bash
npm install @supabase/supabase-js
```

### Replace `database.json` logic

```javascript
// server.js — Supabase version
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,    // e.g. https://xxxx.supabase.co
    process.env.SUPABASE_SERVICE_KEY   // use SERVICE ROLE key on the server
);

// ── GET open tickets ──────────────────────────────────────
app.get('/api/tickets/open', async (req, res) => {
    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('status', 'OPEN')
        .is('assigned_to', null)
        .order('priority', { ascending: true });   // HIGH=1 sorts first with a custom enum

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ── GET all tickets (admin) ───────────────────────────────
app.get('/api/tickets/all', async (req, res) => {
    const { data, error } = await supabase
        .from('tickets')
        .select('*, assigned_user:users(display_name)')
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ── GET ongoing tickets for a tech ───────────────────────
app.get('/api/tickets/ongoing', async (req, res) => {
    const { technician_id } = req.query;
    const { data: userRow } = await supabase
        .from('users').select('id').eq('tech_code', technician_id).single();

    if (!userRow) return res.status(404).json({ error: 'Tech not found' });

    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('status', 'ON_GOING')
        .eq('assigned_to', userRow.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ── POST claim a ticket ───────────────────────────────────
app.post('/api/tickets/claim', async (req, res) => {
    const { ticket_id, technician_id } = req.body;
    const { data: userRow } = await supabase
        .from('users').select('id').eq('tech_code', technician_id).single();

    if (!userRow) return res.status(404).json({ error: 'Tech not found' });

    const { error } = await supabase
        .from('tickets')
        .update({ status: 'ON_GOING', assigned_to: userRow.id })
        .eq('ticket_id', ticket_id)
        .eq('status', 'OPEN');

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Job successfully claimed!' });
});

// ── POST submit a job ─────────────────────────────────────
app.post('/api/tickets/submit', upload.array('proof', 5), async (req, res) => {
    const { ticket_id, technician_id } = req.body;
    const { data: userRow } = await supabase
        .from('users').select('id').eq('tech_code', technician_id).single();
    const { data: ticketRow } = await supabase
        .from('tickets').select('id').eq('ticket_id', ticket_id).single();

    if (!userRow || !ticketRow) return res.status(404).json({ error: 'Not found' });

    // Upload files to Supabase Storage
    const proofInserts = [];
    for (const file of req.files) {
        const filePath = `${ticket_id}/${file.filename}`;
        const fileBuffer = require('fs').readFileSync(file.path);

        await supabase.storage.from('proofs').upload(filePath, fileBuffer, {
            contentType: file.mimetype, upsert: true
        });

        const { data: { publicUrl } } = supabase.storage
            .from('proofs').getPublicUrl(filePath);

        proofInserts.push({
            ticket_id:   ticketRow.id,
            file_url:    publicUrl,
            file_type:   file.mimetype.startsWith('video') ? 'video' : 'image',
            uploaded_by: userRow.id
        });
    }

    await supabase.from('ticket_proofs').insert(proofInserts);
    await supabase.from('tickets')
        .update({ status: 'COMPLETED' })
        .eq('id', ticketRow.id);

    // … Telegram sendMediaGroup logic stays the same …

    res.json({ message: 'Job completed successfully!' });
});

// ── POST admin batch upload ───────────────────────────────
app.post('/api/admin/batch-upload', async (req, res) => {
    const { sites } = req.body;
    if (!sites?.length) return res.status(400).json({ error: 'Invalid data' });

    let created = 0, escalated = 0;

    for (const site of sites) {
        const { data: existing } = await supabase
            .from('tickets')
            .select('id')
            .eq('site_id', site.site_id)
            .eq('status', 'OPEN')
            .single();

        if (existing) {
            await supabase.from('tickets')
                .update({ priority: 'HIGH' }).eq('id', existing.id);
            escalated++;
        } else {
            const ticketId = `TKT-${Date.now().toString().slice(-4)}-${Math.floor(1000+Math.random()*9000)}`;
            await supabase.from('tickets').insert({
                ticket_id:   ticketId,
                site_id:     site.site_id,
                site_name:   site.site_name,
                locality:    site.locality,
                address:     site.address,
                coordinates: site.coordinates,
                status:      'OPEN',
                priority:    site.priority.toUpperCase()
            });
            created++;
        }
    }

    res.json({ message: `Batch complete. Created: ${created}, Escalated: ${escalated}` });
});
```

---

## 7. Environment Variables

Create a `.env` file (never commit this):

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
TELEGRAM_BOT_TOKEN=8273955218:AAGeIovO...
TELEGRAM_CHAT_ID=8129202637
PORT=3000
```

Add `dotenv` support to `server.js`:

```javascript
require('dotenv').config();   // add this at the very top of server.js
```

Install it:

```bash
npm install dotenv
```

---

## 8. Quick Reference

| What you need | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Settings → API → **service_role** key (keep secret!) |
| `SUPABASE_ANON_KEY` | Settings → API → anon/public key (safe for frontend) |
| Storage bucket URL | Storage → proofs → copy bucket URL |
| Auth user IDs | Authentication → Users → copy UUID |

---

## 9. Database ERD (Summary)

```
auth.users  (Supabase built-in)
    │
    └──► public.users
              │  id, role, display_name, tech_code
              │
              ├──► public.tickets
              │         id, ticket_id, site_id, site_name
              │         locality, address, coordinates
              │         status, priority
              │         assigned_to → users.id
              │         created_at, updated_at
              │
              └──► public.ticket_proofs
                        id, ticket_id → tickets.id
                        file_url (Supabase Storage)
                        file_type, uploaded_by → users.id
                        uploaded_at
```

---

*Guide generated for FieldOps v2 — June 2026*
