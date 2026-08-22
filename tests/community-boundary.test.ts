import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';

const authenticatedRoutes=[
  'app/api/communities/route.ts',
  'app/api/communities/[id]/route.ts',
  'app/api/communities/[id]/environments/route.ts',
  'app/api/communities/[id]/events/route.ts',
  'app/api/communities/[id]/invite/route.ts',
  'app/api/communities/[id]/environments/[environmentId]/room/route.ts',
  'app/api/communities/[id]/events/[eventId]/join/route.ts',
  'app/api/communities/[id]/upload/route.ts',
  'app/api/community/invite/[token]/route.ts',
];

describe('Community functional boundary',()=>{
  it('keeps every authenticated Community route bearer-aware for Lovable',async()=>{
    for(const path of authenticatedRoutes){
      const source=await readFile(path,'utf8');
      expect(source,`${path} must authenticate from Request`).toContain('getCurrentUser(request)');
    }
  });

  it('uses atomic database transitions for Community creation, event joins and invite acceptance',async()=>{
    const create=await readFile('app/api/communities/route.ts','utf8');
    const joinEvent=await readFile('app/api/communities/[id]/events/[eventId]/join/route.ts','utf8');
    const invite=await readFile('app/api/community/invite/[token]/route.ts','utf8');
    expect(create).toContain("rpc('create_community_atomic'");
    expect(joinEvent).toContain("rpc('join_community_event_atomic'");
    expect(invite).toContain("rpc('accept_community_invite_atomic'");
  });

  it('validates Community image signatures instead of trusting MIME only',async()=>{
    const upload=await readFile('app/api/communities/[id]/upload/route.ts','utf8');
    expect(upload).toContain('hasValidImageSignature');
    expect(upload).toContain('0x89');
    expect(upload).toContain('0xff');
    expect(upload).toContain('0x52');
  });

  it('locks the invite row and publishes the matching schema version',async()=>{
    const migration=await readFile('supabase/migrations/20260821222500_community_invite_atomic.sql','utf8');
    expect(migration).toContain('for update');
    expect(migration).toContain("'20260821_community_invite_atomic'");
    expect(migration).toContain('grant execute on function public.accept_community_invite_atomic');
  });

  it('uses compare-and-set when replacing or claiming an environment room',async()=>{
    const room=await readFile('app/api/communities/[id]/environments/[environmentId]/room/route.ts','utf8');
    expect(room).toContain(".eq('lobby_id',staleLobbyId)");
    expect(room).toContain(".is('lobby_id',null)");
    expect(room).toContain("const candidateLobbyId=lobby.id as string");
    expect(room).toContain("update({status:'closed'}).eq('id',candidateLobbyId)");
  });

  it('cancels stale Community detail requests before they can replace the current selection',async()=>{
    const hub=await readFile('components/community/CommunityHub.tsx','utf8');
    expect(hub).toContain('detailController.current?.abort()');
    expect(hub).toContain('signal:controller.signal');
    expect(hub).toContain('generation!==detailGeneration.current');
    expect(hub).toContain('controller.signal.aborted');
  });
});
