import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';

describe('authentication media teardown',()=>{
  it('mounts the persistent media guard at the root layout',async()=>{
    const layout=await readFile('app/layout.tsx','utf8');
    expect(layout).toContain('<PersistentCallDock/>');
    expect(layout).toContain('<DesktopRuntimeMode/>');
  });

  it('tears down active LiveKit media on authentication routes',async()=>{
    const dock=await readFile('components/PersistentCallDock.tsx','utf8');
    expect(dock).toContain('pathname==="/login"');
    expect(dock).toContain('pathname==="/register"');
    expect(dock).toContain('disconnectActiveLiveKitVoice(true)');
  });

  it('keeps the Performance client sticky if an old navigation loses its query string',async()=>{
    const runtime=await readFile('components/DesktopRuntimeMode.tsx','utf8');
    expect(runtime).toContain('sessionStorage.setItem(liteKey,"1")');
    expect(runtime).toContain('sessionStorage.getItem(liteKey)==="1"');
    expect(runtime).toContain('window.location.pathname==="/"');
    expect(runtime).toContain('window.location.replace("/desktop-lite?desktop=lite")');
  });

  it('tears down media explicitly before Performance logout',async()=>{
    const home=await readFile('components/desktop/DesktopLiteHome.tsx','utf8');
    const disconnect=home.indexOf('await disconnectActiveLiveKitVoice(true)');
    const logout=home.indexOf('fetch("/api/auth/logout"');
    expect(disconnect).toBeGreaterThanOrEqual(0);
    expect(logout).toBeGreaterThan(disconnect);
  });
});
