# Step 9 Fix — Row Level Security Policies

> **Why this error happens:** `auth.uid()` in Supabase returns a `uuid` type, but without an explicit cast, PostgreSQL sometimes cannot resolve the comparison operator when the column is also `uuid`. The fix is to cast every `auth.uid()` call to `uuid` explicitly using `(auth.uid())::uuid`. Additionally, the original policies on the `users` table caused a **recursive loop** (querying `users` inside a policy on `users`), which is another source of failure.

---

## What to Do

### 1 · Clean Up Any Partially Created Policies

If you already ran Step 9 and got the error, some policies may have been partially created. Run this first to remove them cleanly:

```sql
-- ─────────────────────────────────────────────
-- DROP all existing policies so we can recreate
-- them correctly. Safe to run even if none exist.
-- ─────────────────────────────────────────────

-- users table
DROP POLICY IF EXISTS "users: read own profile"     ON public.users;
DROP POLICY IF EXISTS "users: admins read all"       ON public.users;
DROP POLICY IF EXISTS "users: update own profile"    ON public.users;
DROP POLICY IF EXISTS "users_read_own"               ON public.users;
DROP POLICY IF EXISTS "users_admins_read_all"        ON public.users;
DROP POLICY IF EXISTS "users_update_own"             ON public.users;
DROP POLICY IF EXISTS "users_select_own"             ON public.users;

-- tickets table
DROP POLICY IF EXISTS "tickets: read all"            ON public.tickets;
DROP POLICY IF EXISTS "tickets: admins insert"       ON public.tickets;
DROP POLICY IF EXISTS "tickets: admins delete"       ON public.tickets;
DROP POLICY IF EXISTS "tickets: update rules"        ON public.tickets;
DROP POLICY IF EXISTS "tickets_read_all"             ON public.tickets;
DROP POLICY IF EXISTS "tickets_admins_insert"        ON public.tickets;
DROP POLICY IF EXISTS "tickets_admins_delete"        ON public.tickets;
DROP POLICY IF EXISTS "tickets_update_rules"         ON public.tickets;
DROP POLICY IF EXISTS "tickets_select_all"           ON public.tickets;
DROP POLICY IF EXISTS "tickets_insert"               ON public.tickets;
DROP POLICY IF EXISTS "tickets_update"               ON public.tickets;

-- ticket_proofs table
DROP POLICY IF EXISTS "proofs: read all"             ON public.ticket_proofs;
DROP POLICY IF EXISTS "proofs: tech inserts own"     ON public.ticket_proofs;
DROP POLICY IF EXISTS "proofs: admins insert"        ON public.ticket_proofs;
DROP POLICY IF EXISTS "proofs_read_all"              ON public.ticket_proofs;
DROP POLICY IF EXISTS "proofs_tech_insert"           ON public.ticket_proofs;
DROP POLICY IF EXISTS "proofs_admins_insert"         ON public.ticket_proofs;
DROP POLICY IF EXISTS "proofs_select_all"            ON public.ticket_proofs;
DROP POLICY IF EXISTS "proofs_insert"                ON public.ticket_proofs;
```

After clicking **Run**, you should see:

```
Success. No rows returned
```

---

### 2 · Enable RLS (Skip if Already Done)

```sql
ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_proofs ENABLE ROW LEVEL SECURITY;
```

---

### 3 · Run the Corrected Policies

Paste and run this entire block. Every `auth.uid()` is now cast to `::uuid` explicitly, and the recursive users-table reference has been removed.

```sql
-- ═══════════════════════════════════════════════
-- CORRECTED RLS POLICIES — FieldOps
--
-- Key fixes applied:
--   1. Every auth.uid() call is cast: (auth.uid())::uuid
--   2. Removed recursive self-join on public.users
--   3. Simplified: server.js uses service_role key
--      which bypasses RLS, so policies are a safety
--      net for direct DB access only
-- ═══════════════════════════════════════════════


-- ─────────────────────────────────────────────
-- TABLE: users
-- ─────────────────────────────────────────────

-- Each user can read only their own profile row
CREATE POLICY "users_select_own"
ON public.users
FOR SELECT
TO authenticated
USING (
    id = (auth.uid())::uuid
);

-- Each user can update only their own profile row
CREATE POLICY "users_update_own"
ON public.users
FOR UPDATE
TO authenticated
USING (
    id = (auth.uid())::uuid
)
WITH CHECK (
    id = (auth.uid())::uuid
);


-- ─────────────────────────────────────────────
-- TABLE: tickets
-- ─────────────────────────────────────────────

-- All authenticated users can read all tickets
CREATE POLICY "tickets_select_all"
ON public.tickets
FOR SELECT
TO authenticated
USING (true);

-- All authenticated users can insert tickets
-- (admin-only enforcement happens in server.js)
CREATE POLICY "tickets_insert"
ON public.tickets
FOR INSERT
TO authenticated
WITH CHECK (true);

-- A technician can update their own assigned ticket.
-- Any authenticated user can claim an unassigned OPEN ticket.
CREATE POLICY "tickets_update"
ON public.tickets
FOR UPDATE
TO authenticated
USING (
    assigned_to = (auth.uid())::uuid
    OR (status = 'OPEN' AND assigned_to IS NULL)
);

-- Only the assigned technician can delete their ticket
-- (in practice, cancellation is preferred over deletion)
CREATE POLICY "tickets_delete"
ON public.tickets
FOR DELETE
TO authenticated
USING (
    assigned_to = (auth.uid())::uuid
);


-- ─────────────────────────────────────────────
-- TABLE: ticket_proofs
-- ─────────────────────────────────────────────

-- All authenticated users can view proof files
CREATE POLICY "proofs_select_all"
ON public.ticket_proofs
FOR SELECT
TO authenticated
USING (true);

-- A user can only insert proofs they uploaded themselves
CREATE POLICY "proofs_insert"
ON public.ticket_proofs
FOR INSERT
TO authenticated
WITH CHECK (
    uploaded_by = (auth.uid())::uuid
);
```

---

### 4 · Verify All Policies Were Created

Run this query to confirm you have exactly **8 policies** across the three tables:

```sql
SELECT
    tablename,
    policyname,
    cmd        AS "operation",
    permissive AS "type"
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

You should see this result:

| tablename | policyname | operation | type |
|---|---|---|---|
| ticket_proofs | proofs_insert | INSERT | PERMISSIVE |
| ticket_proofs | proofs_select_all | SELECT | PERMISSIVE |
| tickets | tickets_delete | DELETE | PERMISSIVE |
| tickets | tickets_insert | INSERT | PERMISSIVE |
| tickets | tickets_select_all | SELECT | PERMISSIVE |
| tickets | tickets_update | UPDATE | PERMISSIVE |
| users | users_select_own | SELECT | PERMISSIVE |
| users | users_update_own | UPDATE | PERMISSIVE |

If you see **8 rows**, the setup is complete and correct.

---

## Why the Policies Are Simplified

The original guide had policies where the `users` table queried **itself** to check if the current user is an admin:

```sql
-- ❌ This causes a recursive loop
EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
```

PostgreSQL evaluates this by running another `SELECT` on `public.users`, which triggers the RLS policy again, which runs another `SELECT`... causing an infinite loop or an error.

The corrected policies avoid this entirely. Admin-only actions (like inserting tickets and cancelling any ticket) are **enforced in `server.js`** using the `SUPABASE_SERVICE_KEY`, which is a service-role key that **bypasses RLS completely**. The policies here are purely a safety net for any direct database access.

---

## Continue to Step 10

Once the verification query shows 8 rows, go back to the guide and continue with **Part 5 — Set Up File Storage**.
