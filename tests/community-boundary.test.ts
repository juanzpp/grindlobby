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

describe('Community API boundary',()=>{
  it('keeps authenticated Community handlers compatible with bearer clients',async()=>{
    for(const path of authenticatedRoutes){
      const source=await readFile(path,'utf8');
      expect(source,`${path} must authenticate from the Request`).toContain('getCurrentUser(request)');
    }
  });

  it('validates Community image content instead of trusting MIME alone',async()=>{
    const source=await readFile('app/api/communities/[id]/upload/route.ts','utf8');
    expect(source).toContain('hasValidImageSignature');
    expect(source).toContain("bytes[0]===0x89");
    expect(source).toContain("bytes[0]===0xff");
    expect(source).toContain("bytes[0]===0x52");
  });

  it('keeps Community room and event mutations behind trusted-origin validation',async()=>{
    for(const path of [
      'app/api/communities/[id]/environments/[environmentId]/room/route.ts',
      'app/api/communities/[id]/events/[eventId]/join/route.ts',
      'app/api/community/invite/[token]/route.ts',
    ]){
      const source=await readFile(path,'utf8');
      expect(source).toContain('assertTrustedMutation(request)');
    }
  });
});
