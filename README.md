# Nokhaba Payroll · 2026 Enterprise System

Premium, production-minded payroll & operations platform for Saudi logistics riders —
centralized rules engine, bilingual payslips, monthly imports, income-vs-expenses
analytics, and Supabase-backed authentication with row-level security.

## Stack

- **Next.js 16** (App Router, standalone output) + **React 19**
- **Tailwind CSS 4** + shadcn/ui (Radix), lucide-react, recharts
- **Prisma 7** (`@prisma/adapter-pg`) over **Supabase PostgreSQL** (server-side only)
- **Supabase Auth** (`@supabase/ssr`, cookie-based sessions) for sign-in/sign-out/password recovery

## Getting started

```bash
npm ci
cp .env.example .env        # fill in real values (see below)
npx prisma migrate deploy   # apply committed migrations
npm run dev                 # http://localhost:3000
```

### Environment variables

| Variable | Where it is used | Notes |
| --- | --- | --- |
| `DATABASE_URL` | application server (Prisma) | Supabase transaction-pooler connection string. **Server-side only — never expose to the browser.** |
| `DIRECT_URL` | Prisma migrations (`prisma.config.ts`) | Session-pooler connection (port 5432). |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server + middleware | Supabase → Project Settings → API → Project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server + middleware | The modern Supabase publishable key; the legacy anon key is also supported. Never use the service-role key. |

`.env.example` contains placeholder values only. Real credentials live in `.env`
(ignored by Git) and in your deployment secret store.

### Supabase project configuration (one-time)

1. **Bootstrapping the database:** for a new Supabase project run
   `npx prisma migrate resolve --applied 00000000000000_init_supabase`
   once if the base tables were created via the Supabase migration API, then
   `npx prisma migrate deploy`.
2. **Create the first owner account:**
   - In the Supabase dashboard create the user under *Authentication → Users*
     (disable public sign-ups: *Authentication → Providers → Email →
     disable “Allow new users to sign up”* unless you invite users yourself).
   - Insert the matching membership row (Prisma connects as `postgres` and may
     insert immediately; alternatively use the SQL editor as the service role):
     ```sql
     INSERT INTO "app_user" ("id","email","name","role","updated_at")
     VALUES ('<auth-user-uuid>', 'owner@nokhaba.com', 'Owner', 'owner', now());
     ```
   - Subsequent members: create the Supabase user, add the `app_user` row with
     the right role (`owner`, `admin`, `viewer`), then send a password-reset
     invitation from *Authentication → Users → Invite/Magic link*.
3. **Email delivery** (password recovery): configure Supabase *Auth → SMTP* or
   the built-in email templates under *Auth → Emails*. Until SMTP is verified,
   treat recovery emails as unconfirmed — the UI shows a neutral “email sent”
   message without guaranteeing delivery.
4. **Redirect URLs:** add `<your-origin>/auth/callback?next=/reset-password`
   (and `<your-origin>/**`) under *Auth → URL Configuration*.

## Authentication & authorization model

- **Single-organization deployment.** Organization feature work is done
  per-user under `app_user`; there is no public self-registration.
- **Roles**
  | Role | Read | Write | User management |
  | --- | --- | --- | --- |
  | `owner` | ✅ | ✅ | ✅ |
  | `admin` | ✅ | ✅ | ❌ |
  | `viewer` | ✅ | ❌ | ❌ |
- **Enforcement layers**
  1. *Middleware* (`src/middleware.ts`) refreshes/validates the session cookie
     and redirects unauthenticated page loads to `/login`.
  2. *API routes* call `requireAuth()` / `requireAuth({ write: true })`
     (`src/lib/auth.ts`) on every handler — 60 handlers across 28 route files —
     returning 401/403/503 JSON responses.
  3. *Database* — `prisma/migrations/20261023000000_auth_rls/migration.sql`
     enables RLS on **every** table (`app_user`, all payroll/employee/
     compensation tables, audit log), revokes `anon` access, and exposes
     read/write policies gated on `app_user` membership and role
     (`is_active_app_user()`, `has_payroll_role()` security-definer helpers).
- **Backend choice:** the existing architecture uses Prisma over a trusted
  server connection for data operations, and Supabase (GoTrue/Auth + Postgres)
  for identity and policy enforcement. No separate backend server is
  introduced; Prisma accesses the Supabase PG. Because the Prisma connection
  runs as a privileged role that bypasses RLS, database policies protect the
  Supabase Data API surface while `requireAuth`/`requireRole` protects the
  application's own trusted endpoints.

## Database schema highlights

- Defined in `prisma/schema.prisma` (rule sets/values, contract overrides,
  company profile, drivers, payroll runs + per-driver results, exceptions,
  traffic violations, manual adjustments, custom bonuses/deductions, audit
  log, income records, expense categories/expenses, driver counts, custom
  income fields, authenticated `app_user`).
- Migrations live under `prisma/migrations/`.

## Payroll math

All calculations (`src/lib/salary-engine.ts`, `src/lib/income-expenses-engine.ts`,
rule snapshots) implement the company's own configured formula set — they are
**not** generic statutory/tax calculators. Jurisdictional (ZATCA/GOSI/filing)
features are intentionally absent and must not be improvised.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server (port 3000) |
| `npm run build` | Production build (standalone + asset copy via `scripts/build.mjs`) |
| `npm run start` | Run the standalone server |
| `npm run lint` | ESLint |
| `npm run db:migrate:deploy` | Apply committed migrations |
| `npm run db:legacy:export` | Export the historical SQLite fixture to SQL |

## Deployment checklist

1. Set `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the hosting secret store.
2. `npm ci && npm run db:migrate:deploy`.
3. `npm run build && npm run start`.
4. Verify `/login`, sign-in, sign-out, and `/api/dashboard` (200 with a session).
5. Rotate any database password that was ever committed to Git, and consider
   purging Git history before making this repository public.
