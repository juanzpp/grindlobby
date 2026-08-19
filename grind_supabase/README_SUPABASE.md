# GrindLobby v2 + Supabase

This build replaces the local SQLite authentication/persistence layer with Supabase Auth + Postgres.

## 1. Supabase database
Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor.

## 2. Environment variables
Add these locally and in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only; never prefix with NEXT_PUBLIC)

## 3. Auth settings
For production, keep email confirmation enabled. Add the Vercel production URL and preview URLs to Supabase Auth URL configuration as appropriate.

## 4. Install/build
```bash
npm install
npm run build
```

## What changed
- Removed `better-sqlite3` and local DB writes.
- Supabase Auth now stores credentials/sessions.
- `profiles`, `games`, `user_game_ranks`, `lobbies`, and `lobby_members` live in Postgres.
- Row Level Security is enabled.
- Login still accepts username or email. Username resolution uses the service-role key only on the server.
- Logout updates presence status to offline.
- Registration enforces a stronger minimum password rule.

## Important
Voice calls, WebRTC screen sharing, realtime lobby presence, Pro billing, moderation and ECA Digital compliance are not implemented by this migration. This migration fixes the persistence/auth database foundation so those features can be built on reliable storage.
