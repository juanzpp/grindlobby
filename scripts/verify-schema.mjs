const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,"");
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const expectedVersion="20260822_server_only_privileged_dml";

if(!url||!key){
  console.error("[schema-check] missing Supabase server environment variables");
  process.exit(1);
}

const headers={apikey:key,Authorization:`Bearer ${key}`,Accept:"application/json"};
const required=[
  "lobby_invites","voice_quality_samples","app_schema_state",
  "communities","community_members","community_environments","community_events","community_invites",
  "valorant_squads","valorant_squad_members","valorant_matches","valorant_match_players",
  "match_team_rooms","strategy_sessions","strategy_objects",
];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function requestWithRetry(path,attempts=5){
  let lastStatus="network";
  for(let attempt=1;attempt<=attempts;attempt+=1){
    const response=await fetch(`${url}${path}`,{headers,signal:AbortSignal.timeout(8000)}).catch(()=>null);
    if(response?.ok)return response;
    lastStatus=response?.status??"network";
    if(attempt<attempts)await sleep(Math.min(1000*2**(attempt-1),5000));
  }
  throw new Error(`request failed (${lastStatus}) for ${path}`);
}

try{
  for(const table of required){
    await requestWithRetry(`/rest/v1/${table}?select=*&limit=0`);
  }

  const versionResponse=await requestWithRetry('/rest/v1/app_schema_state?id=eq.1&select=version');
  const versionRows=await versionResponse.json().catch(()=>[]);
  const actualVersion=versionRows?.[0]?.version;
  if(actualVersion!==expectedVersion){
    throw new Error(`incompatible schema: expected ${expectedVersion}, got ${actualVersion??"missing"}`);
  }

  console.log(`[schema-check] production schema is compatible (${expectedVersion})`);
}catch(error){
  console.error(`[schema-check] ${error instanceof Error?error.message:String(error)}`);
  process.exit(1);
}
