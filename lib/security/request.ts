import {isAllowedFrontendOrigin} from '@/lib/api/cors'

export class InvalidRequestError extends Error {
  constructor(message="Requisição inválida."){
    super(message);
    this.name="InvalidRequestError";
  }
}

function hasBearerAuthorization(request:Request){
  return /^Bearer\s+\S+$/i.test(request.headers.get('authorization')?.trim()??'')
}

export function assertTrustedMutation(request:Request){
  const requestUrl=new URL(request.url);
  const origin=request.headers.get("origin");
  const fetchSite=request.headers.get("sec-fetch-site");
  if(origin){
    let originUrl:URL;
    try{originUrl=new URL(origin)}catch{throw new InvalidRequestError()}
    if(originUrl.origin===requestUrl.origin)return;
    // Reverse proxies can expose an internal request URL to Next.js. Fetch
    // Metadata remains browser-controlled and confirms the public request was
    // initiated from the same origin without trusting forwarded host headers.
    if(fetchSite==="same-origin")return;
    // Decoupled frontend requests are allowed only from an explicit frontend
    // allowlist and only when they carry bearer authentication. Route handlers
    // still verify that token server-side before applying the mutation.
    if(isAllowedFrontendOrigin(origin)&&hasBearerAuthorization(request))return;
    throw new InvalidRequestError();
  }
  if(fetchSite!=="same-origin")throw new InvalidRequestError();
}

export async function readJsonBody(request:Request,maxBytes=16_384):Promise<unknown>{
  const contentType=request.headers.get("content-type")?.split(";",1)[0].trim().toLowerCase();
  if(contentType!=="application/json")throw new InvalidRequestError("Use JSON válido.");
  const declaredLength=Number(request.headers.get("content-length")??0);
  if(Number.isFinite(declaredLength)&&declaredLength>maxBytes)throw new InvalidRequestError("Requisição muito grande.");
  const raw=await request.text();
  if(new TextEncoder().encode(raw).byteLength>maxBytes)throw new InvalidRequestError("Requisição muito grande.");
  try{return JSON.parse(raw)}catch{throw new InvalidRequestError("Use JSON válido.")}
}

export function safeInternalPath(value:string|null,fallback="/"){
  if(!value||!value.startsWith("/")||value.startsWith("//")||value.includes("\\"))return fallback;
  return value;
}

export function noStoreJson(data:unknown,init:ResponseInit={}){
  const headers=new Headers(init.headers);
  headers.set("Cache-Control","private, no-store, max-age=0");
  headers.set("Pragma","no-cache");
  headers.set("Vary","Cookie");
  return Response.json(data,{...init,headers});
}
