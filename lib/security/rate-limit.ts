import {createHmac} from "node:crypto";
import {createAdminClient} from "@/lib/supabase/admin";

type RateLimitOptions={
  scope:string;
  limit:number;
  windowSeconds:number;
  subject?:string;
};

export class RateLimitExceededError extends Error{
  retryAfter:number;
  constructor(retryAfter:number){super("Muitas tentativas.");this.name="RateLimitExceededError";this.retryAfter=retryAfter}
}

export class RateLimitUnavailableError extends Error{
  code:string;
  constructor(code="rate_limit_unavailable"){
    super("Proteção temporariamente indisponível.");
    this.name="RateLimitUnavailableError";
    this.code=code;
  }
}

function safeErrorCode(value:unknown,fallback:string){
  const code=typeof value==="object"&&value!==null&&"code" in value&&typeof value.code==="string"?value.code:"";
  return /^[a-zA-Z0-9_.:-]{1,64}$/.test(code)?code:fallback;
}

function clientAddress(request:Request){
  return request.headers.get("cf-connecting-ip")?.trim()
    ||request.headers.get("x-real-ip")?.trim()
    ||request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ||"unknown";
}

function rateLimitSalt(){
  const salt=process.env.RATE_LIMIT_SALT?.trim()||process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!salt)throw new RateLimitUnavailableError();
  return salt;
}

function rateKey(request:Request,{scope,subject}:Pick<RateLimitOptions,"scope"|"subject">){
  const normalizedSubject=subject?.trim().toLowerCase().slice(0,160)??"anonymous";
  const digest=createHmac("sha256",rateLimitSalt()).update(`${scope}|${clientAddress(request)}|${normalizedSubject}`).digest("hex");
  return `v1:${scope}:${digest}`;
}

export async function enforceRateLimit(request:Request,options:RateLimitOptions){
  const admin=createAdminClient();
  const {data,error}=await admin.rpc("consume_rate_limit",{
    p_key:rateKey(request,options),
    p_limit:options.limit,
    p_window_seconds:options.windowSeconds,
  });
  if(error)throw new RateLimitUnavailableError(safeErrorCode(error,"rate_limit_rpc_failed"));
  if(!Array.isArray(data)||!data[0])throw new RateLimitUnavailableError("rate_limit_invalid_response");
  const result=data[0] as {allowed:boolean;remaining:number;reset_at:string};
  if(!result.allowed){
    const retryAfter=Math.max(1,Math.ceil((new Date(result.reset_at).getTime()-Date.now())/1000));
    throw new RateLimitExceededError(retryAfter);
  }
  return result;
}

export function rateLimitResponse(error:RateLimitExceededError|RateLimitUnavailableError){
  if(error instanceof RateLimitExceededError){
    return Response.json({error:"Muitas tentativas. Aguarde antes de tentar novamente."},{status:429,headers:{"Retry-After":String(error.retryAfter),"Cache-Control":"no-store"}});
  }
  return Response.json({error:"Serviço temporariamente indisponível."},{status:503,headers:{"Cache-Control":"no-store"}});
}
