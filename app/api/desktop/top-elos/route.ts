import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {noStoreJson} from '@/lib/security/request';
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from '@/lib/security/rate-limit';

type RankRow={user_id:string;rank_name:string;points:number;wins:number;losses:number;game_id:number;updated_at:string};
type ProfileRow={id:string;username:string;display_name:string;avatar:string|null;account_level:number|null;favorite_game:string|null;profile_banner:string|null;avatar_frame:string|null;profile_effect:string|null;profile_badge:string|null};

function matches(rank:RankRow){return (rank.wins??0)+(rank.losses??0)}
function better(next:RankRow,current?:RankRow){if(!current)return true;if(next.points!==current.points)return next.points>current.points;return matches(next)>matches(current)}

export async function GET(request:Request){
  try{
    const user=await getCurrentUser(request);
    if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
    await enforceRateLimit(request,{scope:'desktop-top-elos',limit:120,windowSeconds:600,subject:user.id});
    const admin=createAdminClient();
    const {data:ranks,error}=await admin.from('user_game_ranks').select('user_id,rank_name,points,wins,losses,game_id,updated_at').order('points',{ascending:false}).limit(500);
    if(error)throw error;
    const best=new Map<string,RankRow>();
    for(const row of (ranks??[]) as RankRow[]){
      if((row.points??0)<=0&&matches(row)<=0)continue;
      const current=best.get(row.user_id);
      if(better(row,current))best.set(row.user_id,row);
    }
    const ordered=[...best.values()].sort((a,b)=>b.points-a.points||matches(b)-matches(a)).slice(0,20);
    const ids=ordered.map(row=>row.user_id);
    const {data:profiles,error:profileError}=ids.length?await admin.from('profiles').select('id,username,display_name,avatar,account_level,favorite_game,profile_banner,avatar_frame,profile_effect,profile_badge').in('id',ids):{data:[] as ProfileRow[],error:null};
    if(profileError)throw profileError;
    const profileMap=new Map(((profiles??[]) as ProfileRow[]).map(profile=>[profile.id,profile]));
    const players=ordered.flatMap(rank=>{
      const profile=profileMap.get(rank.user_id);if(!profile)return [];
      const total=matches(rank);
      return [{
        id:profile.id,
        name:profile.display_name||profile.username,
        username:profile.username,
        avatar:profile.avatar,
        level:profile.account_level??0,
        favoriteGame:profile.favorite_game??'',
        rankName:rank.rank_name||'Iniciante',
        points:rank.points??0,
        wins:rank.wins??0,
        losses:rank.losses??0,
        matches:total,
        winRate:total?Math.round(((rank.wins??0)/total)*100):0,
        banner:profile.profile_banner,
        frame:profile.avatar_frame||'none',
        effect:profile.profile_effect||'none',
        badge:profile.profile_badge,
      }];
    }).slice(0,8);
    return noStoreJson({players});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    return noStoreJson({error:'Não foi possível carregar o Top Elos.'},{status:500});
  }
}
