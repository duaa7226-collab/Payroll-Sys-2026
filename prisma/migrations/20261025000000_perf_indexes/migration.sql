-- ============================================================
-- Performance indexes for payroll hot paths
--
-- Foreign keys are NOT automatically indexed in PostgreSQL, so the payroll
-- queries (results per run, exceptions per run, deductions per rider) were
-- doing sequential scans. All indexes below are additive and safe to apply on
-- a live database (IF NOT EXISTS).
-- ============================================================

-- Payroll runs: dashboard picks the latest run, import checks for a prior run
-- of the same month.
CREATE INDEX IF NOT EXISTS "PayrollRun_createdAt_idx" ON "PayrollRun" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "PayrollRun_payrollMonth_idx" ON "PayrollRun" ("payrollMonth");

-- Driver results: lookups by rider (payslip, income sync, single-rider edits).
CREATE INDEX IF NOT EXISTS "DriverResult_riderId_idx" ON "DriverResult" ("riderId");
CREATE INDEX IF NOT EXISTS "DriverResult_driverId_idx" ON "DriverResult" ("driverId");

-- Exceptions are always read/deleted by run.
CREATE INDEX IF NOT EXISTS "PayrollException_payrollRunId_idx" ON "PayrollException" ("payrollRunId");

-- Traffic violations: per-rider approved-deduction lookups (every calculation).
CREATE INDEX IF NOT EXISTS "TrafficViolation_riderId_status_idx" ON "TrafficViolation" ("riderId", "status");
CREATE INDEX IF NOT EXISTS "TrafficViolation_driverId_idx" ON "TrafficViolation" ("driverId");

-- Manual adjustments: per-rider active lookups (every calculation).
CREATE INDEX IF NOT EXISTS "ManualAdjustment_riderId_status_idx" ON "ManualAdjustment" ("riderId", "status");
CREATE INDEX IF NOT EXISTS "ManualAdjustment_driverId_idx" ON "ManualAdjustment" ("driverId");

-- Custom bonus / deduction definitions are filtered by status on every run.
CREATE INDEX IF NOT EXISTS "CustomBonus_status_idx" ON "CustomBonus" ("status");
CREATE INDEX IF NOT EXISTS "CustomDeduction_status_idx" ON "CustomDeduction" ("status");
CREATE INDEX IF NOT EXISTS "CustomDeduction_installmentEnabled_installmentStatus_idx" ON "CustomDeduction" ("installmentEnabled", "installmentStatus");

-- Income records: import replaces a month+company in one statement.
CREATE INDEX IF NOT EXISTS "IncomeRecord_month_companyName_idx" ON "IncomeRecord" ("month", "companyName");

-- Rules: active-set lookup on every calculation.
CREATE INDEX IF NOT EXISTS "PayrollRuleSet_status_activatedAt_idx" ON "PayrollRuleSet" ("status", "activatedAt" DESC);

-- Audit log is read newest-first with a limit.
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog" ("action", "createdAt" DESC);

-- Expenses are read per month for allocation.
CREATE INDEX IF NOT EXISTS "Expense_month_allocationType_idx" ON "Expense" ("month", "allocationType");
