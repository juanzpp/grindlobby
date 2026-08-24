import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';

describe('native desktop client',()=>{
  it('routes Tauri standard and lite lobbies to a separate desktop component',async()=>{
    const source=await readFile('app/lobby/[id]/page.tsx','utf8');
    expect(source).toContain("query.desktop==='lite'?'lite':query.desktop==='1'?'standard':null");
    expect(source).toContain('return <DesktopLobbyRoom id={id} user={user} mode={desktopMode}/>');
    expect(source).toContain('return <LobbyRoom id={id} user={user}/>');
  });

  it('routes the standard Tauri root to a dedicated native home',async()=>{
    const source=await readFile('app/page.tsx','utf8');
    expect(source).toContain('const standardDesktop=query.desktop==="1"');
    expect(source).toContain('return <DesktopHome user={user} initialView={initialView}/>');
    expect(source).toContain('return <div className="web-refresh-scope web-home-v2"><Dashboard user={user}/></div>');
  });

  it('persists desktop mode so internal navigation cannot silently fall back to web UI',async()=>{
    const source=await readFile('components/DesktopRuntimeMode.tsx','utf8');
    expect(source).toContain('const runtimeKey="grindlobby.desktop.runtime"');
    expect(source).toContain('url.searchParams.set("desktop",mode)');
    expect(source).toContain('root.dataset.grindDesktop=mode');
  });

  it('uses real WebRTC RTT and screen-share session state instead of fake desktop status',async()=>{
    const source=await readFile('components/desktop/DesktopLobbyRoom.tsx','utf8');
    expect(source).toContain('getLiveKitMediaRttMs');
    expect(source).toContain('subscribeVoiceSession');
    expect(source).toContain('const shareActive=session.screenSharers.length>0');
    expect(source).not.toContain('<strong>18ms</strong>');
    expect(source).not.toContain('MINIMAL RESOURCE MODE');
  });

  it('makes desktop call tabs and room channels real controls',async()=>{
    const source=await readFile('components/desktop/DesktopLobbyRoom.tsx','utf8');
    expect(source).toContain('onClick={()=>setTab("call")}');
    expect(source).toContain('onClick={()=>setTab("strategy")}');
    expect(source).toContain('onClick={()=>setTab("match")}');
    expect(source).toContain('onClick={()=>setTab("lobby")}');
    expect(source).toContain('<LobbyChat lobbyId={lobby.id}');
  });

  it('forces Windows installer validation when native desktop surfaces change',async()=>{
    const workflow=await readFile('.github/workflows/desktop-windows.yml','utf8');
    expect(workflow).toContain("- 'components/desktop/**'");
    expect(workflow).toContain("- 'app/native-desktop.css'");
    expect(workflow).toContain("- 'app/native-home.css'");
  });
});
