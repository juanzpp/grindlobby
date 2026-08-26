import {getCurrentUser} from '@/lib/auth';
import {isConfiguredAdmin} from '@/lib/admin-config';
import {createAdminClient} from '@/lib/supabase/admin';
import {noStoreJson} from '@/lib/security/request';
import {PROFILE_BADGES,PROFILE_BANNERS,PROFILE_CARD_STYLES,PROFILE_EFFECTS,PROFILE_FRAMES} from '@/lib/profile-cosmetics';
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from '@/lib/security/rate-limit';

export async function GET(request:Request){
  try{
    const user=await getCurrentUser(request);
    if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
    await enforceRateLimit(request,{scope:'profile-cosmetics-read',limit:120,windowSeconds:600,subject:user.id});
    const admin=createAdminClient();
    const {data:profile,error}=await admin.from('profiles').select('cosmetic_owned,cosmetic_equipped,app_role').eq('id',user.id).maybeSingle();
    if(error)throw error;
    const isAdmin=isConfiguredAdmin(user.id)||profile?.app_role==='admin'||user.app_role==='admin';
    const owned=new Set(Array.isArray(profile?.cosmetic_owned)?profile.cosmetic_owned:[]);
    const mark=(kind:string,items:Array<Record<string,unknown>>)=>items.map(item=>({...item,kind,available:isAdmin||item.id==='none'||owned.has(String(item.id))}));
    return noStoreJson({
      isAdmin,
      owned:[...owned],
      equipped:profile?.cosmetic_equipped??{},
      catalog:{
        banners:mark('banner',PROFILE_BANNERS as unknown as Array<Record<string,unknown>>),
        frames:mark('frame',PROFILE_FRAMES as unknown as Array<Record<string,unknown>>),
        effects:mark('effect',PROFILE_EFFECTS as unknown as Array<Record<string,unknown>>),
        badges:mark('badge',PROFILE_BADGES as unknown as Array<Record<string,unknown>>),
        cardStyles:mark('cardStyle',PROFILE_CARD_STYLES as unknown as Array<Record<string,unknown>>),
      },
    });
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    return noStoreJson({error:'Não foi possível carregar o catálogo de cosméticos.'},{status:500});
  }
}
