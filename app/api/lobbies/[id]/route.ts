import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {noStoreJson} from "@/lib/security/request";
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from "@/lib/security/rate-limit";

const idSchema=z.string().uuid();

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const id=idSchema.parse((await params).id),supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();
    if(!user)return noStoreJson({error:"Não autorizado."},{status:401});
    await enforceRateLimit(request,{scope:"read-lobby",limit:180,windowSeconds:60,subject:user.id});
    const admin=createAdminClient();
    const [{data:lobby},{data:membership}]=await Promise.all([
      admin.from("lobbies").select("id,owner_id,game_id,name,description,visibility,max_members,status,created_at,updated_at").eq("id",id).maybeSingle(),
      admin.from("lobby_members").select("user_id,role,last_seen_at").eq("lobby_id",id).eq("user_id",user.id).maybeSingle(),
    ]);
    if(!lobby)return noStoreJson({error:"Lobby não encontrado."},{status:404});
    const authorized=lobby.visibility==="public"||lobby.owner_id===user.id||Boolean(membership);
    if(!authorized)return noStoreJson({error:"Lobby não encontrado."},{status:404});
    const cutoff=new Date(Date.now()-30000).toISOString();
    const [{data:game},{data:members}]=await Promise.all([
      lobby.game_id?admin.from("games").select("id,name,slug").eq("id",lobby.game_id).maybeSingle():Promise.resolve({data:null}),
      admin.from("lobby_members").select("user_id,role,joined_at,last_seen_at").eq("lobby_id",id).gt("last_seen_at",cutoff).order("joined_at"),
    ]);
    const ids=(members??[]).map(member=>member.user_id);
    const {data:profiles}=ids.length?await admin.from("profiles").select("id,username,display_name,avatar,status").in("id",ids):{data:[] as Array<{id:string;username:string;display_name:string;avatar:string|null;status:string}>};
    const profileMap=new Map((profiles??[]).map(profile=>[profile.id,profile]));
    return noStoreJson({lobby:{...lobby,game,members:(members??[]).map(member=>({...member,profile:profileMap.get(member.user_id)})),isMember:Boolean(membership),me:user.id}});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    if(error instanceof z.ZodError)return noStoreJson({error:"Lobby não encontrado."},{status:404});
    return noStoreJson({error:"Não foi possível carregar o lobby."},{status:500});
  }
}
