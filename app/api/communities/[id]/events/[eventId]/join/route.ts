import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {getCommunityMembership} from '@/lib/community';
import {assertTrustedMutation,noStoreJson} from '@/lib/security/request';

export async function POST(request:Request,{params}:{params:Promise<{id:string;eventId:string}>}){
  try{assertTrustedMutation(request);const user=await getCurrentUser();if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});const {id,eventId}=await params;if(!await getCommunityMembership(id,user.id))return noStoreJson({error:'Community não encontrada.'},{status:404});const admin=createAdminClient();const {data:event}=await admin.from('community_events').select('id,community_id,capacity,status').eq('id',eventId).eq('community_id',id).maybeSingle();if(!event||event.status!=='scheduled')return noStoreJson({error:'Evento indisponível.'},{status:409});if(event.capacity){const {count}=await admin.from('community_event_members').select('*',{count:'exact',head:true}).eq('event_id',eventId);if((count??0)>=event.capacity)return noStoreJson({error:'Evento lotado.'},{status:409});}const {error}=await admin.from('community_event_members').upsert({event_id:eventId,user_id:user.id},{onConflict:'event_id,user_id',ignoreDuplicates:true});if(error)throw error;return noStoreJson({ok:true});}catch{return noStoreJson({error:'Não foi possível participar do evento.'},{status:500});}
}
