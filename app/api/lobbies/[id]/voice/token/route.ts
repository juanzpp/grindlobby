import {NextResponse} from "next/server";
import {AccessToken} from "livekit-server-sdk";
import {createClient} from "@/lib/supabase/server";

export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params,supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Não autorizado."},{status:401});
 const {data:member}=await supabase.from("lobby_members").select("user_id").eq("lobby_id",id).eq("user_id",user.id).gt("last_seen_at",new Date(Date.now()-30000).toISOString()).maybeSingle();
 if(!member)return NextResponse.json({error:"Você não está presente neste lobby."},{status:403});
 const url=process.env.NEXT_PUBLIC_LIVEKIT_URL,apiKey=process.env.LIVEKIT_API_KEY,apiSecret=process.env.LIVEKIT_API_SECRET;
 if(!url||!apiKey||!apiSecret)return NextResponse.json({error:"LiveKit não configurado."},{status:503});
 const {data:profile}=await supabase.from("profiles").select("display_name,username").eq("id",user.id).maybeSingle();
 const token=new AccessToken(apiKey,apiSecret,{identity:user.id,name:profile?.display_name||profile?.username||"Player",metadata:JSON.stringify({username:profile?.username||"player"}),ttl:"15m"});
 token.addGrant({roomJoin:true,room:`lobby-${id}`,canPublish:true,canSubscribe:true,canPublishData:false});
 return NextResponse.json({token:await token.toJwt(),url});
}
