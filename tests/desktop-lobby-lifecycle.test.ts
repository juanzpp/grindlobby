import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';

describe('native desktop lobby lifecycle',()=>{
  it('defers the initial lobby load and clears both timers on unmount',async()=>{
    const source=await readFile('components/desktop/DesktopLobbyRoom.tsx','utf8');
    expect(source).toContain('const initial=window.setTimeout(()=>void load(),0)');
    expect(source).toContain('window.clearTimeout(initial);window.clearInterval(timer);loadController.current?.abort()');
  });

  it('defers RTT reset when voice disconnects instead of synchronously cascading state',async()=>{
    const source=await readFile('components/desktop/DesktopLobbyRoom.tsx','utf8');
    expect(source).toContain('if(!session.connected){const clear=window.setTimeout(()=>setRttMs(null),0);return()=>window.clearTimeout(clear)}');
  });
});