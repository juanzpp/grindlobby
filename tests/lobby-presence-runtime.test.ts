import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';

describe('lobby presence runtime',()=>{
  it('shares one heartbeat manager between lobby UI and persistent voice',async()=>{
    const manager=await readFile('lib/lobby-presence-heartbeat.ts','utf8');
    const room=await readFile('components/LobbyRoom.tsx','utf8');
    const voice=await readFile('lib/webrtc/useLobbyVoice.ts','utf8');
    expect(manager).toContain('const entries=new Map');
    expect(manager).toContain('if(entry.inFlight)return');
    expect(room).toContain('retainLobbyPresenceHeartbeat(id');
    expect(voice).toContain('retainLobbyPresenceHeartbeat(activeLobbyId)');
    expect(room).not.toContain('fetch(`/api/lobbies/${id}/heartbeat`');
    expect(voice).not.toContain('fetch(`/api/lobbies/${activeLobbyId}/heartbeat`');
  });

  it('serializes lobby polling and aborts stale requests',async()=>{
    const room=await readFile('components/LobbyRoom.tsx','utf8');
    expect(room).toContain('loadController.current?.abort()');
    expect(room).toContain('signal:controller.signal');
    expect(room).toContain('generation!==loadGeneration.current');
    expect(room).toContain('return()=>{window.clearInterval(timer);loadController.current?.abort()}');
  });
});
