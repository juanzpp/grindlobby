import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {ensureValorantTeamRooms} from '@/lib/competitive/rooms';
import {assertTrustedMutation,noStoreJson,readJsonBody} from '@/lib/security/request';

const schema=z.object({mapSlug:z.string().trim().min(2).max(40)});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    assertTrustedMutation(request);const user=await getCurrentUser();if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
    const {id}=await params,body=schema.parse(await readJsonBody(request));const admin=createAdminClient();
    const {data:match}=await admin.from('valorant_matches').select('id,state,squad_a_id,squad_b_id,veto_deadline').eq('id',id).maybeSingle();if(!match||match.state!=='VETO')return noStoreJson({error:'O veto não está ativo.'},{status:409});
    const {data:squads}=await admin.from('valorant_squads').select('id,captain_id').in('id',[match.squad_a_id,match.squad_b_id]);const squadA=(squads??[]).find(s=>s.id===match.squad_a_id),squadB=(squads??[]).find(s=>s.id===match.squad_b_id);
    const {data:actions}=await admin.from('valorant_veto_actions').select('step,map_slug').eq('match_id',id).order('step');const nextStep=(actions?.length??0)+1;const expectedSquadId=nextStep%2===1?match.squad_a_id:match.squad_b_id;const expectedCaptain=nextStep%2===1?squadA?.captain_id:squadB?.captain_id;
    if(expectedCaptain!==user.id)return noStoreJson({error:'Não é o seu turno de veto.'},{status:403});
    const {data:map}=await admin.from('valorant_map_pool').select('slug,name').eq('slug',body.mapSlug).eq('active',true).maybeSingle();if(!map)return noStoreJson({error:'Mapa inválido.'},{status:400});if((actions??[]).some(action=>action.map_slug===body.mapSlug))return noStoreJson({error:'Este mapa já foi vetado.'},{status:409});
    const {error:insertError}=await admin.from('valorant_veto_actions').insert({match_id:id,step:nextStep,squad_id:expectedSquadId,captain_id:user.id,map_slug:body.mapSlug,action:'ban'});if(insertError)throw insertError;
    const {data:pool}=await admin.from('valorant_map_pool').select('slug,name').eq('active',true).order('sort_order');const banned=new Set([...(actions??[]).map(a=>a.map_slug),body.mapSlug]);const remaining=(pool??[]).filter(item=>!banned.has(item.slug));
    if(remaining.length===1){const selected=remaining[0];await admin.from('valorant_matches').update({state:'MAP_SELECTED',selected_map_slug:selected.slug,veto_deadline:null,updated_at:new Date().toISOString()}).eq('id',id).eq('state','VETO');await ensureValorantTeamRooms(id,selected.slug);await admin.from('valorant_matches').update({state:'LOBBY_READY',updated_at:new Date().toISOString()}).eq('id',id).eq('state','MAP_SELECTED');return noStoreJson({state:'LOBBY_READY',selectedMap:selected});}
    await admin.from('valorant_matches').update({veto_deadline:new Date(Date.now()+24000).toISOString(),updated_at:new Date().toISOString()}).eq('id',id).eq('state','VETO');return noStoreJson({state:'VETO',remaining:remaining.length});
  }catch(error){if(error instanceof z.ZodError)return noStoreJson({error:'Mapa inválido.'},{status:400});return noStoreJson({error:'Não foi possível registrar o veto.'},{status:500});}
}
