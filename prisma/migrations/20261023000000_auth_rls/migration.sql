-- ============================================================
-- Auth + Row Level Security (single-organization payroll)
--
-- Access model (conservative, single-tenant):
--   * Every human belongs to exactly ONE organization — this deployment's
--     company (Nokhaba Tatweer). Membership is expressed by having an
--     active row in "app_user"; there is no anonymous self-registration.
--   * "app_user.role": 'owner' → full control incl. user management,
--     'admin' → read/write payroll data, 'viewer' → read-only.
--   * RLS applies to every table in "public". The Supabase Data API
--     (anon/authenticated PostgREST roles) can never see rows without a
--     valid, matching app row. The application server uses Prisma over a
--     dedicated connection (postgres) for trusted reads/writes and also
--     enforces these rules in code via requireAuth()/requireRole().
--   * To convert to multi-tenant later: add an organization id to
--     "app_user" and every sensitive table, then add
--     organization_id = (select organization from app_user where id = auth.uid())
--     to every policy predicate.
-- ============================================================

-- ------------------------------------------------------------
-- app_user — links Supabase auth user to role + organization membership
-- ------------------------------------------------------------
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

ALTER TABLE "app_user" ADD CONSTRAINT "app_user_id_fkey"
  FOREIGN KEY ("id") REFERENCES "auth"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_user" ADD CONSTRAINT "app_user_role_check"
  CHECK ("role" IN ('owner', 'admin', 'viewer'));

ALTER TABLE "app_user" ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Helper functions (SECURITY DEFINER, pinned search_path)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."app_user_role"()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT au."role" FROM "public"."app_user" au
  WHERE au."id" = auth.uid() AND au."is_active" = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION "public"."is_active_app_user"()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "public"."app_user"
    WHERE "id" = auth.uid() AND "is_active" = true
  )
$$;

CREATE OR REPLACE FUNCTION "public"."has_payroll_role"(VARIADIC roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "public"."app_user"
    WHERE "id" = auth.uid() AND "is_active" = true AND "role" = ANY(roles)
  )
$$;

-- ------------------------------------------------------------
-- RLS on every existing data table
-- read policy  : any active app_user (of this organization)
-- write policy : owner or admin only
-- anon/postgrest unauthenticated access: fully denied (no policy + revoked)
-- ------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'PayrollRuleSet','PayrollRuleValue','ContractOverride','CompanyProfile',
    'Driver','PayrollRun','DriverResult','PayrollException','TrafficViolation',
    'ManualAdjustment','CustomBonus','CustomDeduction','IncomeRecord',
    'ExpenseCategory','Expense','DriverCount','CustomIncomeField'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format ($f$
      DROP POLICY IF EXISTS %I ON %I
    $f$, 'payroll_member_read', t);

    EXECUTE format ($f$
      CREATE POLICY %I ON %I
      FOR SELECT TO authenticated
      USING (public.is_active_app_user())
    $f$, 'payroll_member_read', t);

    EXECUTE format ($f$
      DROP POLICY IF EXISTS %I ON %I
    $f$, 'payroll_admin_write', t);

    EXECUTE format ($f$
      CREATE POLICY %I ON %I
      FOR ALL TO authenticated
      USING (public.has_payroll_role('owner','admin'))
      WITH CHECK (public.has_payroll_role('owner','admin'))
    $f$, 'payroll_admin_write', t);

    EXECUTE format('REVOKE ALL ON %I FROM anon', t);
  END LOOP;
END $$;

-- Anchored payroll data should not be editable through the Data API at all:
-- writes happen either through the trusted application server (Prisma) or
-- by admins with the explicit role, which the policy above enforces.

-- ------------------------------------------------------------
-- app_user policies: self-readable; owners/admins manage members
-- row creation happens server-side (Prisma) when onboarding a user
-- ------------------------------------------------------------
CREATE POLICY "app_user_self_read"
  ON "app_user" FOR SELECT TO authenticated
  USING ("id" = auth.uid() OR public.has_payroll_role('owner','admin'));

CREATE POLICY "app_user_admin_manage"
  ON "app_user" FOR ALL TO authenticated
  USING (public.has_payroll_role('owner'))
  WITH CHECK (public.has_payroll_role('owner'));

REVOKE ALL ON "app_user" FROM anon;

-- ------------------------------------------------------------
-- Audit log: readable by owner/admin only; writes go through the
-- trusted server (audit trail must not be mutable via the Data API)
-- ------------------------------------------------------------
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_admin_read"
  ON "AuditLog" FOR SELECT TO authenticated
  USING (public.has_payroll_role('owner','admin'));

REVOKE ALL ON "AuditLog" FROM anon;

-- Lock down other surfaces from the public anon role entirely
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "public" FROM anon;
