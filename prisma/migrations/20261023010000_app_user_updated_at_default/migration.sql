-- Allow manual Supabase Auth membership provisioning without supplying updated_at.
ALTER TABLE "app_user"
  ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
