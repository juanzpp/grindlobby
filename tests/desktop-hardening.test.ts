import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';

describe('desktop production hardening',()=>{
  it('pins direct Rust dependencies used by the Windows client',async()=>{
    const cargo=await readFile('desktop/src-tauri/Cargo.toml','utf8');
    expect(cargo).toContain('tauri-build = { version = "=2.6.3"');
    expect(cargo).toContain('tauri = { version = "=2.11.5"');
    expect(cargo).toContain('url = "=2.5.8"');
    expect(cargo).toContain('serde = { version = "=1.0.229"');
    expect(cargo).toContain('sysinfo = { version = "=0.33.1"');
    expect(cargo).toContain('reqwest = { version = "=0.12.23"');
    expect(cargo).toContain('features = ["json", "cookies", "rustls-tls"]');
  });

  it('uses one locked dependency resolution for checks and both installers',async()=>{
    const workflow=await readFile('.github/workflows/desktop-windows.yml','utf8');
    expect(workflow).toContain('cargo generate-lockfile');
    expect(workflow).toContain('cargo check --locked');
    expect(workflow).toContain('cargo check --locked --features lite');
    expect(workflow).toContain('@tauri-apps/cli@2.11.4 build --bundles nsis -- --locked');
    expect(workflow).toContain('@tauri-apps/cli@2.11.4 build --bundles nsis --features lite --config tauri.lite.conf.json -- --locked');
    expect(workflow).toContain('name: GrindLobby-Cargo-Lock');
  });

  it('builds Windows installers automatically for native changes on main',async()=>{
    const workflow=await readFile('.github/workflows/desktop-windows.yml','utf8');
    expect(workflow).toContain('push:\n    branches:\n      - main');
    expect(workflow).toContain("- 'desktop/**'");
    expect(workflow).toContain('name: GrindLobby-Windows');
    expect(workflow).toContain('name: GrindLobby-Performance-Windows');
  });

  it('keeps legacy performance IPC read-only and scoped to the official remote origin',async()=>{
    const capability=await readFile('desktop/src-tauri/capabilities/performance-remote.json','utf8');
    const permission=await readFile('desktop/src-tauri/permissions/performance.toml','utf8');
    expect(capability).toContain('https://grindlobby.onrender.com/*');
    expect(capability).toContain('allow-performance-snapshot');
    expect(permission).toContain('commands.allow = ["performance_snapshot"]');
    expect(permission).not.toContain('shell');
    expect(permission).not.toContain('fs:');
  });

  it('bundles the desktop UI locally and restricts backend access to the fixed GrindLobby API',async()=>{
    const native=await readFile('desktop/src-tauri/src/main.rs','utf8');
    expect(native).toContain('const API_ORIGIN: &str = "https://grindlobby.onrender.com"');
    expect(native).toContain('WebviewUrl::App("index.html".into())');
    expect(native).not.toContain('WebviewUrl::External');
    expect(native).toContain('.decorations(false)');
    expect(native).toContain('path.starts_with("/api/")');
    expect(native).toContain('!path.contains("://")');
    expect(native).toContain('!path.contains("..")');
    expect(native).toContain('.cookie_store(true)');
    expect(native).toContain('.header("Sec-Fetch-Site", "same-origin")');
    expect(native).toContain('.header("X-GrindLobby-Client", "desktop-native")');
    expect(native).not.toContain('.header("Origin", API_ORIGIN)');
  });

  it('grants only explicit local bridge and window commands to the bundled main window',async()=>{
    const capability=await readFile('desktop/src-tauri/capabilities/local-main.json','utf8');
    const permission=await readFile('desktop/src-tauri/permissions/desktop.toml','utf8');
    expect(capability).toContain('allow-api-request');
    expect(capability).toContain('allow-window-controls');
    expect(permission).toContain('commands.allow = ["api_request"]');
    expect(permission).toContain('window_minimize');
    expect(permission).toContain('window_toggle_maximize');
    expect(permission).toContain('window_close');
    expect(permission).not.toContain('shell');
    expect(permission).not.toContain('fs:');
  });

  it('holds a Web Lock only while voice is active so minimized legacy sessions stay alive',async()=>{
    const voice=await readFile('lib/webrtc/useLobbyVoice.ts','utf8');
    expect(voice).toContain('navigator.locks.request("grindlobby-active-voice",{mode:"shared"}');
    expect(voice).toContain('startBackgroundActivityLock()');
    expect(voice).toContain('stopBackgroundActivityLock()');
    expect(voice).toContain('RoomEvent.Disconnected,()=>{stopHeartbeat();stopBackgroundActivityLock();sync()}');
  });

  it('preserves desktop mode and safe invite return paths through legacy compatibility routes',async()=>{
    const login=await readFile('app/login/page.tsx','utf8');
    const lobby=await readFile('app/lobby/[id]/page.tsx','utf8');
    const invite=await readFile('app/lobby/invite/[token]/page.tsx','utf8');
    expect(login).toContain('next.startsWith("/") && !next.startsWith("//")');
    expect(login).toContain('query.get("desktop") === "lite" ? "/desktop-lite?desktop=lite" : "/"');
    expect(login).toContain('router.replace(destination)');
    expect(lobby).toContain("const desktopMode=query.desktop==='lite'?'lite':query.desktop==='1'?'standard':null");
    expect(lobby).toContain("redirect(desktopMode?`/login?desktop=${desktopMode==='lite'?'lite':'1'}`:'/login')");
    expect(lobby).toContain('if(desktopMode)return <DesktopLobbyRoom id={id} user={user} mode={desktopMode}/>');
    expect(invite).toContain('router.replace(lite?"/login?desktop=lite":"/login")');
    expect(invite).toContain('router.replace(`/lobby/${body.lobbyId}${suffix}`)');
  });
});