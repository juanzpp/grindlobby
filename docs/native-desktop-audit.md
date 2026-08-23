# Native desktop audit

This branch isolates the Windows client UI from the web UI while keeping the existing backend, LiveKit voice engine, screen-share policy and lobby APIs shared.

Validated invariants expected before merge:
- Standard Tauri root uses `DesktopHome`.
- Standard/lite lobby routes use `DesktopLobbyRoom`; browser lobby remains `LobbyRoom`.
- WebRTC RTT is measured, never hard-coded.
- Screen-share LIVE state comes from the active LiveKit session.
- Call/Lobby/Strategy/Match controls are real stateful tabs.
- Standard and Performance Windows installers rebuild whenever native desktop surfaces change.
