-- ============================================================
-- Upload history — permanent archive of every imported workbook.
--
-- The original .xlsx is stored in Supabase PostgreSQL (BYTEA), so it
-- survives redeploys and is downloadable from the dashboard. Rows are
-- removed only through an explicit user delete. Deleting a payroll run
-- (or clearing payroll data) detaches the archive instead of deleting it.
-- ============================================================

CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    "size" INTEGER NOT NULL,
    "payrollMonth" TEXT NOT NULL,
    "driverCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedBy" TEXT NOT NULL DEFAULT 'admin',
    "payrollRunId" TEXT,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UploadedFile_payrollRunId_key" ON "UploadedFile"("payrollRunId");
CREATE INDEX "UploadedFile_createdAt_idx" ON "UploadedFile"("createdAt" DESC);
CREATE INDEX "UploadedFile_payrollMonth_idx" ON "UploadedFile"("payrollMonth");

ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_payrollRunId_fkey"
  FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ------------------------------------------------------------
-- Row level security (same model as the rest of the payroll tables):
-- read for active members, write for owner/admin only, nothing for anon.
-- The application server reaches this table through Prisma, which runs as
-- a privileged role and enforces authorization with requireAuth().
-- ------------------------------------------------------------
ALTER TABLE "UploadedFile" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uploaded_file_read"
  ON "UploadedFile" FOR SELECT TO authenticated
  USING (public.is_active_app_user());

CREATE POLICY "uploaded_file_write"
  ON "UploadedFile" FOR ALL TO authenticated
  USING (public.has_payroll_role('owner','admin'))
  WITH CHECK (public.has_payroll_role('owner','admin'));

REVOKE ALL ON "UploadedFile" FROM anon;
