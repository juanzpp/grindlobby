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
    expect(voice).toContain('retainLobbyPresenceHeartbeat(lobbyId');
    expect(room).not.toContain('fetch(`/api/lobbies/${id}/heartbeat`');
    expect(voice).not.toContain('fetch(`/api/lobbies/${activeLobbyId}/heartbeat`');
  });

  it('rejects heartbeat renewal after the lobby has closed',async()=>{
    const route=await readFile('app/api/lobbies/[id]/heartbeat/route.ts','utf8');
    expect(route).toContain('select("status")');
    expect(route).toContain('lobby.status!=="open"');
    expect(route).toContain('Lobby encerrado.');
    expect(route).toContain('status:410');
  });

  it('tears down persistent media when membership or lobby access ends',async()=>{
    const voice=await readFile('lib/webrtc/useLobbyVoice.ts','utf8');
    expect(voice).toContain('status===401||status===404||status===410');
    expect(voice).toContain('activeLobbyId===lobbyId');
    expect(voice).toContain('disconnectActiveLiveKitVoice(true)');
  });

  it('serializes lobby polling and aborts stale requests',async()=>{
    const room=await readFile('components/LobbyRoom.tsx','utf8');
    expect(room).toContain('loadController.current?.abort()');
    expect(room).toContain('signal:controller.signal');
    expect(room).toContain('generation!==loadGeneration.current');
    expect(room).toContain('return()=>{window.clearInterval(timer);loadController.current?.abort()}');
  });
});
