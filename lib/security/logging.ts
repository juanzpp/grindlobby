import {createHmac} from "node:crypto";

type SecurityLog={
  event:string;
  outcome:"allowed"|"blocked"|"failed";
  actorId?:string|null;
  reason?:string;
  route?:string;
};

function hashActor(actorId:string){
  const salt=process.env.RATE_LIMIT_SALT?.trim()||process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()||"grindlobby-local";
  return createHmac("sha256",salt).update(actorId).digest("hex").slice(0,16);
}

export function logSecurityEvent({actorId,...event}:SecurityLog){
  console.info("[GrindLobby Security]",{
    ...event,
    actor:actorId?hashActor(actorId):undefined,
    at:new Date().toISOString(),
  });
}
