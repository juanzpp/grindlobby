# Future Bloom Project

Lovable project: `5e550d2c-cf04-45b7-86d2-200d83233950`

High-value historical source containing login, dashboard, store and Supabase experiments.

Auth source (`src/components/auth/LoginPortal.tsx`):
- split portal/login composition;
- Framer Motion transition;
- dark glass login card;
- mock 2-second login then navigate to `/`;
- old generated portal artwork asset.

Layout source (`src/components/layout/AppLayout.tsx`):
- 72px hub rail plus secondary navigation;
- Dashboard/Lobbies/Rank/Loja/Pro/Configurações;
- global admin/PRO status header;
- activity list and user status card;
- older Discord-style hub navigation.

Dashboard source (`src/routes/index.tsx`):
- large rank/season progress panel;
- circular XP panel;
- active lobby with member mic state;
- audio sliders + screen sharing controls;
- transmission quality/system status;
- store highlights and upcoming events.

Other authored material inventoried in Lovable:
- `src/routes/auth.tsx`
- `src/routes/shop.tsx`
- `src/assets/auth-hero.png.asset.json`
- `src/assets/dashboard-ref.png.asset.json`
- `src/assets/shop-ref.png.asset.json`
- Supabase client/auth integration files;
- Supabase migrations;
- five `.lovable/plan/*.md` implementation/design plans.

Security/migration rules:
- `.env` is deliberately NOT imported.
- Do not replace production Supabase migrations or authentication with this historical project's schema.
- Mock login/timeouts are reference-only.
- Hand-built Shield/Gamepad branding is obsolete; production must use `/brand/grindlobby-official.png`.
- Discord-style dual rail should not be copied wholesale; only selected composition ideas may be reused.
- Existing production WebRTC/LiveKit/media/backend code remains authoritative.
