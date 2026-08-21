# GrindLobby architecture

## Production responsibilities

| Layer | Responsibility | Authoritative? |
| --- | --- | --- |
| Lovable frontend | UI, UX, responsive layout, animation, accessibility, view state | No business authority |
| Next API / Render | Application API, validation, orchestration, authorization, rate limiting | Yes |
| Supabase Auth | Identity/session issuance | Yes |
| Supabase Postgres | Persistent product state | Yes |
| Supabase Storage | User/community media | Yes |
| LiveKit | Voice/screen media transport | Yes for media session state |
| Browser local storage | Local UX preferences only | No |

## Rules

1. The frontend never computes or persists authoritative GR/rank, currency, cosmetics ownership, PRO/admin entitlements, lobby membership, matchmaking state, match result or moderation decisions.
2. Route handlers should remain transport controllers. Reusable product policy belongs in `lib/` services/functions (for example `lib/account-capabilities.ts`).
3. New frontend-facing APIs use `/api/v1` and the common response contract in `lib/api/response.ts`.
4. Decoupled frontend authentication uses a Supabase user access token. Service-role and LiveKit secrets stay server-only.
5. Cross-origin access is deny-by-default and limited to explicit origins in `lib/api/cors.ts`/`FRONTEND_ORIGINS`.
6. Database schema changes are migrations and production startup is guarded against incompatible schema.
7. Production code must pass `npm ci`, tests, startup validation, `next build`, server boot and HTTP smoke tests before merge.

## Migration away from the legacy embedded frontend

The current Next-rendered frontend remains operational during migration. Do not delete it until the Lovable frontend has E2E coverage for authentication, profile, lobby, voice token, community and competitive flows. This avoids a big-bang rewrite.
