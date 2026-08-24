# Lovable workspace import registry

Workspace: `917f500414ba754d42cb` (`jzz's Lovable`)
Imported for controlled consolidation into GrindLobby. These sources are archived references and are NOT automatically activated in the production runtime.

## Projects

| Snapshot | Lovable project id | Classification | Migration note |
|---|---|---|---|
| GrindLobby Hub (45) | `c89015ff-ea2d-4757-902e-e7a8a56ab3bc` | Primary full desktop UI | Highest-value source. 40 authored files identified: dashboard, lobbies, Community, friends, messages, tournaments, events, store, app shell, sidebar, topbar, music player, state and styles. Existing Lovable source contains old hand-built logo and missing `/profile`/`/settings`; do not promote those parts blindly. |
| GrindLobby Hub (66) | `3d4b96d6-4c11-4cb7-aae2-22170b98e6da` | Partial/placeholder desktop source | 20 authored/config files inventoried; home route is still placeholder. Data/store/primitives are useful references. |
| Spark New Beginnings | `89a4b2a4-c6c6-4d8f-a4d2-9092eeaadd7b` | Old single-screen prototype | Discord-like layout and old red/navy token set. Reference only; do not adopt its branding. |
| Novo Spark | `f213e559-f832-4e21-aa1b-601a138f28ce` | Empty placeholder | No meaningful GrindLobby UI beyond blank starter. |
| GrindLobby Hub | `21166e65-f73c-47fb-ad11-fb8298241d2d` | Empty/early starter | Home route is blank starter. |
| Arena Hub | `a42f68d4-4b65-4359-8e52-dfc6546b25e6` | Old dashboard prototype | Contains rank/lobby/audio dashboard concept; useful only as visual reference. |
| Arena Hub (67) | `1947f30e-0dd4-41d6-a288-7f467c1fb49e` | Login/loading prototype | Contains old portal/login and percentage loading screen. Explicitly must NOT override current loading behavior without approval. |
| Future Bloom Project | `5e550d2c-cf04-45b7-86d2-200d83233950` | Full dashboard/login/shop prototype | Contains LoginPortal, AppLayout, dashboard, shop, auth, Supabase integration/migrations and design plans. `.env` intentionally excluded to avoid importing secrets/obsolete credentials. |

## Global migration rules

- Production backend, authentication, Supabase schema, Render configuration, WebRTC/LiveKit and server APIs in the current GrindLobby remain authoritative.
- Lovable sources are UI/reference inputs. Never replace existing backend code with mock state from Lovable.
- Official brand asset remains `/brand/grindlobby-official.png` (example 07). Hand-built Lovable SVG logos are reference-only and must not become production branding.
- Generic `src/components/ui/**` shadcn files, `node_modules`, lockfiles, generated route trees and platform boilerplate are intentionally not duplicated across snapshots.
- No `.env`, tokens or secrets are imported.
- Archived source files use non-compilable extensions such as `.tsx.txt` so Next/TypeScript does not include them in production typechecking.
- The old loading prototypes from Arena Hub (67) and Future Bloom are archived only; they must not be enabled automatically.

## Recommended source precedence

1. Current GrindLobby repo for backend, data, authentication, media, security and production runtime.
2. GrindLobby Hub (45) for desktop navigation, social/community structure and music separation.
3. Future Bloom Project for selected dashboard/store composition and auth visual ideas.
4. Arena Hub for selected rank/lobby/audio layout details.
5. Remaining projects only as historical references.
