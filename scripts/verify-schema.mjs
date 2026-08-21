const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,"");
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const expectedVersion="20260821_community_atomic_hardening";
if(!url||!key){console.error("[schema-check] missing Supabase server environment variables");process.exit(1)}
const headers={apikey:key,Authorization:`Bearer ${key}`,Accept:"application/json"};
const required=["lobby_invites","voice_quality_samples","app_schema_state","community_invites","community_members"];
for(const table of required){
  const response=await fetch(`${url}/rest/v1/${table}?select=id&limit=1`,{headers}).catch(()=>null);
  if(!response||!response.ok){console.error(`[schema-check] required table ${table} is unavailable (${response?.status??"network"})`);process.exit(1)}
}
const versionResponse=await fetch(`${url}/rest/v1/app_schema_state?id=eq.1&select=version`,{headers}).catch(()=>null);
if(!versionResponse?.ok){console.error(`[schema-check] schema version cannot be read (${versionResponse?.status??"network"})`);process.exit(1)}
const versionRows=await versionResponse.json().catch(()=>[]);
if(versionRows?.[0]?.version!==expectedVersion){console.error(`[schema-check] incompatible schema: expected ${expectedVersion}, got ${versionRows?.[0]?.version??"missing"}`);process.exit(1)}
for(const rpcName of ["join_community_event_atomic","create_community_atomic","accept_community_invite_atomic"]){
  const rpc=await fetch(`${url}/rest/v1/rpc/${rpcName}`,{method:"OPTIONS",headers}).catch(()=>null);
  if(!rpc||!(rpc.ok||rpc.status===204)){console.error(`[schema-check] required RPC ${rpcName} is unavailable (${rpc?.status??"network"})`);process.exit(1)}
}
console.log(`[schema-check] production schema is compatible (${expectedVersion})`);
