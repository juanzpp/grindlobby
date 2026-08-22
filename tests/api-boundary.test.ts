import {readFile} from 'node:fs/promises'
import {describe,expect,it} from 'vitest'
import {corsHeaders,isAllowedFrontendOrigin} from '@/lib/api/cors'
import {apiError,apiJson,API_VERSION} from '@/lib/api/response'
import {assertTrustedMutation,InvalidRequestError} from '@/lib/security/request'

const bearerAwareRoutes=[
  'app/api/lobbies/[id]/invites/route.ts',
  'app/api/competitive/valorant/route.ts',
  'app/api/competitive/valorant/queue/route.ts',
  'app/api/competitive/valorant/squad/route.ts',
  'app/api/competitive/valorant/history/route.ts',
  'app/api/competitive/valorant/matches/[id]/accept/route.ts',
  'app/api/competitive/valorant/matches/[id]/result/route.ts',
  'app/api/competitive/valorant/matches/[id]/board/route.ts',
]

describe('frontend API boundary',()=>{
  it('allows the current Lovable frontend origins only',()=>{
    expect(isAllowedFrontendOrigin('https://pixel-perfect-clone-87933.lovable.app')).toBe(true)
    expect(isAllowedFrontendOrigin('https://id-preview--6df5c80b-d9f1-417c-bda4-2a268217f2ca.lovable.app')).toBe(true)
    expect(isAllowedFrontendOrigin('https://evil.example')).toBe(false)
  })

  it('emits CORS only for an allowed frontend',()=>{
    const allowed=new Request('https://grindlobby.onrender.com/api/v1/session',{headers:{origin:'https://pixel-perfect-clone-87933.lovable.app'}})
    const denied=new Request('https://grindlobby.onrender.com/api/v1/session',{headers:{origin:'https://evil.example'}})
    expect(corsHeaders(allowed).get('access-control-allow-origin')).toBe('https://pixel-perfect-clone-87933.lovable.app')
    expect(corsHeaders(denied).get('access-control-allow-origin')).toBeNull()
  })

  it('allows cross-origin mutations only for allowlisted bearer clients',()=>{
    const trusted=new Request('https://grindlobby.onrender.com/api/lobbies',{method:'POST',headers:{origin:'https://pixel-perfect-clone-87933.lovable.app',authorization:'Bearer user-access-token','sec-fetch-site':'cross-site'}})
    const noBearer=new Request('https://grindlobby.onrender.com/api/lobbies',{method:'POST',headers:{origin:'https://pixel-perfect-clone-87933.lovable.app','sec-fetch-site':'cross-site'}})
    const evil=new Request('https://grindlobby.onrender.com/api/lobbies',{method:'POST',headers:{origin:'https://evil.example',authorization:'Bearer user-access-token','sec-fetch-site':'cross-site'}})
    expect(()=>assertTrustedMutation(trusted)).not.toThrow()
    expect(()=>assertTrustedMutation(noBearer)).toThrow(InvalidRequestError)
    expect(()=>assertTrustedMutation(evil)).toThrow(InvalidRequestError)
  })

  it('keeps browser-facing API routes bearer-aware',async()=>{
    for(const path of bearerAwareRoutes){
      const source=await readFile(path,'utf8')
      expect(source,`${path} must authenticate from Request`).toContain('getCurrentUser(request)')
      expect(source,`${path} must not rely on cookie-only auth`).not.toContain('getCurrentUser();')
    }
  })

  it('uses one versioned success/error envelope',async()=>{
    const request=new Request('https://grindlobby.onrender.com/api/v1/session')
    const ok=apiJson(request,{hello:'grind'})
    const fail=apiError(request,409,'conflict','Conflito.')
    expect(ok.headers.get('x-grind-api-version')).toBe(API_VERSION)
    expect(ok.headers.get('x-request-id')).toBeTruthy()
    expect(await ok.json()).toEqual({ok:true,data:{hello:'grind'}})
    expect(fail.status).toBe(409)
    expect(await fail.json()).toEqual({ok:false,error:{code:'conflict',message:'Conflito.'}})
  })
})
