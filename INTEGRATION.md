# GitHub and Supabase handoff

This repository is build-ready and intentionally has no remote configured yet. Add the destination GitHub remote and push the reviewed local commit when the repository is confirmed.

The current app uses Prisma with SQLite (`db/custom.db`) for local development. The Supabase migration should be performed against a selected Supabase project by changing the Prisma datasource provider to `postgresql`, setting `DATABASE_URL` to that project's connection string, generating a migration, and applying it through the Supabase migration workflow. Do not commit connection strings or other secrets.

The local SQLite database remains tracked as the current development fixture. `.env` is ignored; use `.env.example` as the starting point for local configuration.
