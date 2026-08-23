import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';

describe('desktop route contract',()=>{
  it('preserves desktop=1 in standard native navigation',async()=>{
    const home=await readFile('components/desktop/DesktopHome.tsx','utf8');
    const room=await readFile('components/desktop/DesktopLobbyRoom.tsx','utf8');
    expect(home).toContain('desktop=1');
    expect(room).toContain('desktop=${mode==="lite"?"lite":"1"}');
  });
});
