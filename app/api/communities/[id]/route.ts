import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {getCommunityMembership} from '@/lib/community';
import {noStoreJson} from '@/lib/security/request';

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const user=await getCurrentUser();if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
    const {id}=await params;const membership=await getCommunityMembership(id,user.id);if(!membership)return noStoreJson({error:'Community não encontrada.'},{status:404});
    const admin=createAdminClient();
    const [{data:community,error},{data:members},{data:environments},{data:posts},{data:events}]=await Promise.all([
      admin.from('communities').select('id,owner_id,name,description,logo_url,banner_url,privacy,tags,created_at,updated_at').eq('id',id).single(),
      admin.from('community_members').select('user_id,role,joined_at').eq('community_id',id).order('joined_at').limit(200),
      admin.from('community_environments').select('id,name,description,type,capacity,lobby_id,sort_order,created_at').eq('community_id',id).order('sort_order').limit(50),
      admin.from('community_posts').select('id,author_id,type,title,body,media_url,created_at').eq('community_id',id).order('created_at',{ascending:false}).limit(30),
      admin.from('community_events').select('id,creator_id,environment_id,title,description,type,starts_at,ends_at,capacity,status').eq('community_id',id).gte('starts_at',new Date(Date.now()-86400000).toISOString()).order('starts_at').limit(20),
    ]);
    if(error)throw error;
    const profileIds=Array.from(new Set([...(members??[]).map(m=>m.user_id),...(posts??[]).map(p=>p.author_id)]));
    const {data:profiles}=profileIds.length?await admin.from('profiles').select('id,username,display_name,avatar,status,favorite_game,avatar_frame,profile_effect,profile_badge').in('id',profileIds):{data:[]};
    type CommunityProfile={id:string;username:string;display_name:string;avatar:string|null;status:string|null;favorite_game:string|null;avatar_frame:string|null;profile_effect:string|null;profile_badge:string|null};
    const profileMap=new Map<string,CommunityProfile>(((profiles??[]) as CommunityProfile[]).map(profile=>[profile.id,profile]));
    const online=(members??[]).filter(m=>profileMap.get(m.user_id)?.status==='online').length;
    return noStoreJson({
      community:{...community,role:membership.role},
      members:(members??[]).map(m=>({...m,profile:profileMap.get(m.user_id)??null})),
      environments:environments??[],
      posts:(posts??[]).map(p=>({...p,author:profileMap.get(p.author_id)??null})),
      events:events??[],
      stats:{members:(members??[]).length,online,activeRooms:(environments??[]).filter(e=>Boolean(e.lobby_id)).length},
    });
  }catch{return noStoreJson({error:'Não foi possível carregar a Community.'},{status:500});}
}
