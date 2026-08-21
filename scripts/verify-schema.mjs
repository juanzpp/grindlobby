const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,"");
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key){console.error("[schema-check] missing Supabase server environment variables");process.exit(1)}
const required=["lobby_invites","voice_quality_samples"];
for(const table of required){
  const response=await fetch(`${url}/rest/v1/${table}?select=id&limit=1`,{headers:{apikey:key,Authorization:`Bearer ${key}`,Accept:"application/json"}}).catch(()=>null);
  if(!response||!response.ok){console.error(`[schema-check] required table ${table} is unavailable (${response?.status??"network"})`);process.exit(1)}
}
const rpc=await fetch(`${url}/rest/v1/rpc/join_community_event_atomic`,{method:"OPTIONS",headers:{apikey:key,Authorization:`Bearer ${key}`}}).catch(()=>null);
if(!rpc||!(rpc.ok||rpc.status===204)){console.error(`[schema-check] required RPC join_community_event_atomic is unavailable (${rpc?.status??"network"})`);process.exit(1)}
console.log("[schema-check] production schema is compatible");
