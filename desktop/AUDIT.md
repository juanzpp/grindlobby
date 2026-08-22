# GrindLobby Desktop Audit

This folder is the Windows desktop shell for GrindLobby. The desktop CI must validate the real NSIS installer on a Windows runner before merge.

## Runtime guarantees

- Tauri 2 + system WebView2; no bundled Chromium/Electron runtime.
- Only one GrindLobby process may run at a time.
- Desktop mode is injected natively on every GrindLobby document load, so internal/full-page navigation cannot silently lose desktop optimizations.
- Non-HTTPS top-level navigation is blocked (except `about:blank`).
- Release builds use LTO, stripped symbols and size-oriented optimization.
- The NSIS installer uses current-user mode and the WebView2 bootstrapper.

## Required CI checks

- Rust compile check.
- RustSec dependency audit.
- Release NSIS build.
- Silent install on Windows.
- Installed product/version/registry verification.
- Real Tauri/WebView2 startup.
- In-app DevTools smoke for secure context, WebRTC, Web Audio, microphone API, display-capture API, WebSocket, storage and `/api/health`.
- Single-instance behavior.
- Idle memory/CPU sanity thresholds.
- Silent uninstall and registry cleanup.

## Distribution signing

CI reports Authenticode state for both installer and installed executable. Public production distribution should use a trusted Windows code-signing certificate; setting `REQUIRE_WINDOWS_SIGNATURE=true` turns missing/invalid signatures into a hard failure.
