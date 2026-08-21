# GrindLobby frontend/backend boundary

## Source of truth

- Lovable owns visual frontend/UX only.
- Render/Next API owns server-side application contracts.
- Supabase owns persisted data/authentication; browser access is limited by publishable key + RLS.
- LiveKit owns media transport; LiveKit API credentials remain server-only.

The browser must never be authoritative for rank, currency, ownership, entitlements, lobby membership, competitive state, moderation, permissions or match result.

## Authentication

The existing Next-rendered app may continue using Supabase cookie sessions.

A decoupled frontend sends the Supabase access token:

```http
Authorization: Bearer <supabase-access-token>
```

The backend validates the token server-side with Supabase Auth. The service-role key is never exposed to the frontend.

## CORS

Versioned frontend endpoints live under `/api/v1` and return CORS headers only for explicit allowed origins. Additional production origins must be configured through `FRONTEND_ORIGINS`.

## Response contract

New `/api/v1` responses use one envelope:

Success:

```json
{"ok":true,"data":{}}
```

Failure:

```json
{"ok":false,"error":{"code":"machine_readable_code","message":"Human readable message"}}
```

Every response carries:

- `X-Grind-Api-Version`
- `X-Request-Id`
- `Cache-Control: private, no-store`

## Session bootstrap

`GET /api/v1/session`

Returns the authenticated account plus server-derived capabilities. It supports the existing cookie session and Bearer authentication.

The frontend must use returned capability flags instead of re-implementing entitlement rules.

## Lobby presence and explicit leave

Lobby presence is heartbeat-based so refreshes, temporary network loss and normal browser lifecycle events can reconnect without destroying the room.

- `pagehide`/`sendBeacon` is treated as temporary disconnect and must not close a lobby.
- A normal same-origin explicit leave may POST to `/api/lobbies/:id/leave` without a JSON body.
- A decoupled/JSON client such as the Lovable frontend must use `POST /api/lobbies/:id/leave?intent=explicit` when the user actually clicks **Sair**.
- Closing or refreshing the page must not call the explicit-leave contract; stop heartbeats and allow the server presence timeout to handle the disconnect.

## Frontend implementation rules

- Network access belongs in one typed API client layer, not inside visual components.
- `localStorage` is allowed only for strictly local UX preferences (volume, theme, last tab, motion preference).
- Do not persist profile, avatar/banner, rank, currency, inventory, cosmetics, lobbies, friendships, competitive state or permissions in localStorage.
- Mutations are confirmed by the backend; optimistic state needs rollback.
- Preview/mock data, when required by Lovable, must be isolated behind a preview adapter and disabled in production.
- No service-role key, LiveKit secret, Spotify secret or any server secret may be placed in frontend environment variables.

## Migration strategy

1. Keep current Render frontend working while `/api/v1` expands.
2. Move Lovable visual components to typed API adapters one domain at a time.
3. Validate each domain with E2E tests against the real backend.
4. After all critical screens consume `/api/v1`, retire duplicate browser-side business stores.
5. Only then switch the public frontend source of truth to Lovable.
