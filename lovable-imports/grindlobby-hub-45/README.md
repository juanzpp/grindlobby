# GrindLobby Hub (45)

Lovable project: `c89015ff-ea2d-4757-902e-e7a8a56ab3bc`
Role: primary Lovable desktop UI source.

The Lovable project contains 40 authored files. Inventory preserved for migration:

- `src/routes/community.tsx`
- `src/routes/events.tsx`
- `src/routes/friends.tsx`
- `src/routes/index.tsx`
- `src/routes/lobbies.tsx`
- `src/routes/messages.tsx`
- `src/routes/store.tsx`
- `src/routes/tournaments.tsx`
- `src/components/app/add-friend-dialog.tsx`
- `src/components/app/app-shell.tsx`
- `src/components/app/app-sidebar.tsx`
- `src/components/app/avatar-stack.tsx`
- `src/components/app/create-lobby-dialog.tsx`
- `src/components/app/empty-state.tsx`
- `src/components/app/event-row.tsx`
- `src/components/app/friend-row.tsx`
- `src/components/app/game-chip.tsx`
- `src/components/app/lobby-row.tsx`
- `src/components/app/logo.tsx`
- `src/components/app/music-player.tsx`
- `src/components/app/search-input.tsx`
- `src/components/app/section-header.tsx`
- `src/components/app/stat-chip.tsx`
- `src/components/app/status-dot.tsx`
- `src/components/app/tip.tsx`
- `src/components/app/titlebar.tsx`
- `src/components/app/topbar.tsx`
- `src/components/app/user-avatar.tsx`
- `src/components/app/voice-activity.tsx`
- `src/data/mock.ts`
- `src/lib/app-state.tsx`
- `src/styles.css`
- root TanStack/Vite configs.

Important migration constraints:
- Source data/state is mock-only; never replace production APIs.
- `/profile` and `/settings` are referenced but absent in this Lovable snapshot.
- Its hand-built SVG logo is obsolete; use `/brand/grindlobby-official.png` (example 07) instead.
- Generic shadcn components are omitted from archive because the production repo already has its own UI stack.
- This snapshot is a visual/component source, not a deployable replacement for the current Next.js app.
