import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';

describe('Valorant room recovery',()=>{
  it('retries MAP_SELECTED room provisioning from match load',async()=>{
    const source=await readFile('app/api/competitive/valorant/matches/[id]/route.ts','utf8');
    expect(source).toContain("match.state==='MAP_SELECTED'||match.state==='LOBBY_READY'");
    expect(source).toContain('await ensureValorantTeamRooms(id,match.selected_map_slug)');
    expect(source).toContain(".eq('state','MAP_SELECTED')");
  });

  it('repairs closed team lobbies and closes failed replacements',async()=>{
    const source=await readFile('lib/competitive/rooms.ts','utf8');
    expect(source).toContain("if(lobby?.status==='open')");
    expect(source).toContain("await admin.from('match_team_rooms').update({lobby_id:lobby.id,status:'PRE_MATCH'})");
    expect(source).toContain('if(!committed)await closeLobby(admin,lobby.id)');
    expect(source).toContain('if(existing&&(existing as ExistingRoom).lobby_id!==lobby.id)await closeLobby');
  });
});
