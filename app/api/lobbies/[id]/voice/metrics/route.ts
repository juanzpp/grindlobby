import {z} from "zod";
import {getCurrentUser} from "@/lib/auth";
import {createAdminClient} from "@/lib/supabase/admin";
import {assertTrustedMutation,InvalidRequestError,noStoreJson,readJsonBody} from "@/lib/security/request";
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from "@/lib/security/rate-limit";

const idSchema=z.string().uuid();
const payloadSchema=z.object({
  connectionState:z.enum(["connected","reconnecting","disconnected"]),
  rttMs:z.number().int().min(0).max(60000).nullable().optional(),
  jitterMs:z.number().min(0).max(60000).nullable().optional(),
  packetsLost:z.number().int().min(0).nullable().optional(),
  packetsReceived:z.number().int().min(0).nullable().optional(),
  bitrateKbps:z.number().int().min(0).max(1000000).nullable().optional(),
  participantCount:z.number().int().min(0).max(200),
}).strict();

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    assertTrustedMutation(request);
    const user=await getCurrentUser(request);if(!user)return noStoreJson({error:"Não autorizado."},{status:401});
    await enforceRateLimit(request,{scope:"voice-metrics",limit:120,windowSeconds:600,subject:user.id});
    const lobbyId=idSchema.parse((await params).id),body=payloadSchema.parse(await readJsonBody(request,4096)),admin=createAdminClient();
    const cutoff=new Date(Date.now()-60000).toISOString();
    const {data:membership}=await admin.from("lobby_members").select("user_id").eq("lobby_id",lobbyId).eq("user_id",user.id).gt("last_seen_at",cutoff).maybeSingle();
    if(!membership)return noStoreJson({error:"Lobby indisponível."},{status:404});
    const {error}=await admin.from("voice_quality_samples").insert({
      lobby_id:lobbyId,user_id:user.id,connection_state:body.connectionState,
      rtt_ms:body.rttMs??null,jitter_ms:body.jitterMs??null,packets_lost:body.packetsLost??null,
      packets_received:body.packetsReceived??null,bitrate_kbps:body.bitrateKbps??null,participant_count:body.participantCount,
    });
    if(error)throw error;
    return noStoreJson({ok:true},{status:201});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    if(error instanceof z.ZodError||error instanceof InvalidRequestError)return noStoreJson({error:"Métrica inválida."},{status:400});
    return noStoreJson({error:"Não foi possível registrar a qualidade da chamada."},{status:500});
  }
}
