import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';

describe('desktop functionality audit',()=>{
  it('wires global search, notifications and functional navigation controls',async()=>{
    const ui=await readFile('desktop/ui/src/main.jsx','utf8');
    expect(ui).toContain('const runSearch=()=>');
    expect(ui).toContain('Ctrl+K');
    expect(ui).toContain('title="Notificações" onClick=');
    expect(ui).toContain('onMessage={openMessage}');
  });

  it('uses real backend routes for community invites and profile changes',async()=>{
    const ui=await readFile('desktop/ui/src/main.jsx','utf8');
    expect(ui).toContain('API("GET","/api/communities")');
    expect(ui).toContain('`/api/communities/${community.id}/invite`');
    expect(ui).toContain('API("GET","/api/profile")');
    expect(ui).toContain('API("PATCH","/api/profile",body)');
  });

  it('wires camera, microphone and screen sharing to LiveKit',async()=>{
    const ui=await readFile('desktop/ui/src/main.jsx','utf8');
    expect(ui).toContain('room.localParticipant.setMicrophoneEnabled');
    expect(ui).toContain('room.localParticipant.setScreenShareEnabled');
    expect(ui).toContain('room.localParticipant.setCameraEnabled');
  });

  it('does not fake unsupported tournament and event persistence',async()=>{
    const ui=await readFile('desktop/ui/src/main.jsx','utf8');
    expect(ui).toContain('Nenhuma inscrição falsa é criada localmente.');
    expect(ui).toContain('<button className="primary" disabled>Inscrições indisponíveis</button>');
    expect(ui).not.toContain('Inscrição registrada.');
    expect(ui).not.toContain('confirmou presença');
  });

  it('fixes the stale dashboard closure after creating a lobby',async()=>{
    const ui=await readFile('desktop/ui/src/main.jsx','utf8');
    expect(ui).toContain('await loadDashboard();setView("lobbies");notify("Lobby criado com sucesso.")');
    expect(ui).not.toContain('const fresh=(dashboard?.lobbies||[]).find');
  });
});
