import {NextResponse} from "next/server";
import {AccessToken,TokenVerifier} from "livekit-server-sdk";
import {createClient} from "@/lib/supabase/server";

export const runtime="nodejs";

function normalizeServerEnv(value:string|undefined){
 const trimmed=value?.trim();
 if(!trimmed)return "";
 const first=trimmed[0],last=trimmed.at(-1);
 return first===last&&(first==='"'||first==="'")?trimmed.slice(1,-1).trim():trimmed;
}

function maskApiKey(value:string){
 if(!value)return "missing";
 if(value.length<7)return `${value.slice(0,1)}***${value.slice(-1)}`;
 return `${value.slice(0,3)}***${value.slice(-3)}`;
}

function readJwtPayload(jwt:string){
 const encoded=jwt.split(".")[1];
 if(!encoded)throw new Error("JWT payload ausente");
 return JSON.parse(Buffer.from(encoded,"base64url").toString("utf8")) as {iss?:string;sub?:string;nbf?:number;iat?:number;exp?:number;video?:{room?:string;roomJoin?:boolean}};
}

function toIso(value:number|undefined){return typeof value==="number"?new Date(value*1000).toISOString():null}

export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params,supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Não autorizado."},{status:401});
 const {data:member}=await supabase.from("lobby_members").select("user_id").eq("lobby_id",id).eq("user_id",user.id).gt("last_seen_at",new Date(Date.now()-30000).toISOString()).maybeSingle();
 if(!member)return NextResponse.json({error:"Você não está presente neste lobby."},{status:403});
 const url=normalizeServerEnv(process.env.NEXT_PUBLIC_LIVEKIT_URL),apiKey=normalizeServerEnv(process.env.LIVEKIT_API_KEY),apiSecret=normalizeServerEnv(process.env.LIVEKIT_API_SECRET),room=`lobby-${id}`;
 const auditBase={apiKeyPresent:Boolean(apiKey),apiSecretPresent:Boolean(apiSecret),apiKeyPrefixSuffix:maskApiKey(apiKey),issuerMatchesConfiguredKey:false,identity:user.id,room,roomJoin:false,issuedAt:null as string|null,expiresAt:null as string|null};
 if(!url||!apiKey||!apiSecret){console.info("[LiveKit Token Audit]",auditBase);return NextResponse.json({error:"LiveKit não configurado."},{status:503})}
 const {data:profile}=await supabase.from("profiles").select("display_name,username").eq("id",user.id).maybeSingle();
 const token=new AccessToken(apiKey,apiSecret,{identity:user.id,name:profile?.display_name||profile?.username||"Player",metadata:JSON.stringify({username:profile?.username||"player"}),ttl:"15m"});
 token.addGrant({roomJoin:true,room,canPublish:true,canSubscribe:true,canPublishData:false});
 const jwt=await token.toJwt(),payload=readJwtPayload(jwt);
 let signatureValid=false;
 try{await new TokenVerifier(apiKey,apiSecret).verify(jwt);signatureValid=true}catch{}
 console.info("[LiveKit Token Audit]",{...auditBase,issuerMatchesConfiguredKey:signatureValid&&payload.iss===apiKey,identity:payload.sub??user.id,room:payload.video?.room??room,roomJoin:payload.video?.roomJoin===true,issuedAt:toIso(payload.iat??payload.nbf),expiresAt:toIso(payload.exp)});
 return NextResponse.json({token:jwt,url});
}
