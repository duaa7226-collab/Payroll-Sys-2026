# Production deployment: GitHub + Supabase

The production backend uses **Supabase PostgreSQL** through **Prisma 7** and the `@prisma/adapter-pg` driver. SQLite is retained only as a local backup/fixture in `db/custom.db`; it is no longer the application runtime database.

## Environment variables

Set `DATABASE_URL` in the deployment secret store. Use the Supabase session/direct pooler URL on port `5432` for a server-based Next.js deployment:

```env
DATABASE_URL="postgresql://prisma.<project-ref>:<password>@<region>.pooler.supabase.com:5432/postgres"
DIRECT_URL="postgresql://prisma.<project-ref>:<password>@<region>.pooler.supabase.com:5432/postgres?sslmode=require"
```

`prisma.config.ts` prefers `DIRECT_URL` for migration commands and falls back to `DATABASE_URL` for older deployments. If the database password contains URL-reserved characters, URL-encode them before saving the connection string.

Never commit `.env`, passwords, Supabase service-role keys, or database URLs.

## Schema migrations

The initial PostgreSQL schema is committed in `prisma/migrations/00000000000000_init_supabase/migration.sql`.

For a newly provisioned Supabase project:

```bash
npm ci
npx prisma migrate deploy
npx prisma generate
```

The current `payroll-system-2026` project was bootstrapped through the Supabase migration API. If deploying the committed Prisma migration directory against that already-created database, mark the initial migration as applied once, then use normal deployment migrations:

```bash
npx prisma migrate resolve --applied 00000000000000_init_supabase
npm run db:migrate:deploy
```

For future schema changes, create and commit a migration locally:

```bash
npx prisma migrate dev --name describe_change
npm run db:migrate:deploy
```

Do not use `prisma db push` in production after the initial setup; use committed migrations instead.

## Existing SQLite payroll data

The local SQLite fixture contains the historical payroll data. The repeatable exporter converts it to PostgreSQL-compatible SQL and converts millisecond timestamps correctly:

```bash
npm run db:legacy:export
psql "$DATABASE_URL" --set ON_ERROR_STOP=1 --file /tmp/payroll-legacy.sql
```

Run the import once against the intended Supabase project and verify row counts and payroll totals before switching traffic. The import is transactional and can be rerun only after clearing the target tables or restoring a clean staging database; do not run it blindly against a populated production database.

Recommended reconciliation checks:

```sql
SELECT 'Driver' AS table_name, count(*) FROM "Driver"
UNION ALL SELECT 'PayrollRun', count(*) FROM "PayrollRun"
UNION ALL SELECT 'DriverResult', count(*) FROM "DriverResult"
UNION ALL SELECT 'PayrollException', count(*) FROM "PayrollException"
UNION ALL SELECT 'IncomeRecord', count(*) FROM "IncomeRecord"
UNION ALL SELECT 'Expense', count(*) FROM "Expense";

SELECT "payrollMonth", count(*) AS drivers, sum("finalNetSalary") AS total_net
FROM "DriverResult"
GROUP BY "payrollMonth"
ORDER BY "payrollMonth";
```

## Deployment checklist

1. Configure `DATABASE_URL` in the hosting provider.
2. Run `npm ci` so Prisma generates the PostgreSQL client.
3. Run `npm run db:migrate:deploy` during the release step.
4. Run `npm run build` and start the standalone Next.js server.
5. Confirm `/api/dashboard` returns HTTP 200 and compare totals against the SQLite backup.
6. Enable Supabase backups and review database advisors/RLS before exposing any direct Supabase API access.

The Next.js API routes use Prisma on the server. Supabase Data API access is not required for this architecture, so the database URL and Prisma credentials must remain server-side only.
