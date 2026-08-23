import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';

describe('native desktop visual contract',()=>{
  it('keeps the EXE on a dedicated rail/sidebar/content/context layout',async()=>{
    const room=await readFile('components/desktop/DesktopLobbyRoom.tsx','utf8');
    const css=await readFile('app/native-desktop.css','utf8');
    expect(room).toContain('className="nd-rail"');
    expect(room).toContain('className="nd-room-sidebar"');
    expect(room).toContain('className="nd-content"');
    expect(room).toContain('className="nd-context"');
    expect(room).toContain('className="nd-callbar"');
    expect(css).toContain('grid-template-columns:74px 270px minmax(560px,1fr) 300px');
  });

  it('does not reintroduce the old fake desktop status copy',async()=>{
    const room=await readFile('components/desktop/DesktopLobbyRoom.tsx','utf8');
    expect(room).not.toContain('18ms');
    expect(room).not.toContain('OPTIMIZED DESKTOP CLIENT');
    expect(room).not.toContain('MINIMAL RESOURCE MODE');
  });
});
