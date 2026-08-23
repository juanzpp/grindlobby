import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';

describe('bundled native desktop client',()=>{
  it('renders the Windows UI from bundled assets instead of the production website',async()=>{
    const native=await readFile('desktop/src-tauri/src/main.rs','utf8');
    const config=await readFile('desktop/src-tauri/tauri.conf.json','utf8');
    expect(native).toContain('WebviewUrl::App("index.html".into())');
    expect(native).not.toContain('WebviewUrl::External');
    expect(native).toContain('.decorations(false)');
    expect(config).toContain('"frontendDist": "../dist"');
    expect(config).toContain('"withGlobalTauri": true');
  });

  it('keeps the native backend bridge fixed to GrindLobby and rejects arbitrary URLs',async()=>{
    const native=await readFile('desktop/src-tauri/src/main.rs','utf8');
    expect(native).toContain('const API_ORIGIN: &str = "https://grindlobby.onrender.com"');
    expect(native).toContain('path.starts_with("/api/")');
    expect(native).toContain('!path.contains("://")');
    expect(native).toContain('!path.contains("..")');
    expect(native).toContain("!path.contains('\\\\')");
    expect(native).toContain('path.len() <= 512');
    expect(native).toContain('.cookie_store(true)');
  });

  it('identifies native requests without browser Origin spoofing so trusted mutations work behind Render proxies',async()=>{
    const native=await readFile('desktop/src-tauri/src/main.rs','utf8');
    expect(native).toContain('.header("Sec-Fetch-Site", "same-origin")');
    expect(native).toContain('.header("X-GrindLobby-Client", "desktop-native")');
    expect(native).not.toContain('.header("Origin", API_ORIGIN)');
    expect(native).not.toContain('.header("Referer", format!("{API_ORIGIN}/"))');
  });

  it('ships a readable desktop/login scale instead of tiny 8-9px primary UI',async()=>{
    const html=await readFile('desktop/ui/index.html','utf8');
    expect(html).toContain('.login-card{width:min(520px,92vw)!important;padding:36px!important');
    expect(html).toContain('.login-card h1{font-size:32px!important');
    expect(html).toContain('.login-card input{height:50px!important');
    expect(html).toContain('.sidebar nav button{font-size:12px!important');
    expect(html).toContain('.welcome h1{font-size:33px!important');
  });

  it('ships functional lobby, voice, screen-share and local desktop modules',async()=>{
    const ui=await readFile('desktop/ui/src/main.jsx','utf8');
    expect(ui).toContain('POST",`/api/lobbies/${lobby.id}/join`');
    expect(ui).toContain('POST",`/api/lobbies/${lobby.id}/voice/token`');
    expect(ui).toContain('room.localParticipant.setMicrophoneEnabled');
    expect(ui).toContain('room.localParticipant.setScreenShareEnabled');
    expect(ui).toContain('function CommunityView');
    expect(ui).toContain('function MessagesView');
    expect(ui).toContain('function StoreView');
    expect(ui).toContain('function SettingsView');
  });

  it('forces CI to compile and inspect the local frontend before packaging Windows',async()=>{
    const workflow=await readFile('.github/workflows/desktop-windows.yml','utf8');
    expect(workflow).toContain('Build bundled desktop frontend');
    expect(workflow).toContain('vite@7.1.3 build desktop/ui');
    expect(workflow).toContain('Validate local desktop bundle contract');
    expect(workflow).toContain("if ($main -match 'WebviewUrl::External')");
    expect(workflow).toContain("'setScreenShareEnabled'");
    expect(workflow).toContain("'voice/token'");
  });
});