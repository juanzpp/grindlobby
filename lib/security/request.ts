export class InvalidRequestError extends Error {
  constructor(message="Requisição inválida."){
    super(message);
    this.name="InvalidRequestError";
  }
}

export function assertTrustedMutation(request:Request){
  const requestUrl=new URL(request.url);
  const origin=request.headers.get("origin");
  if(origin){
    let originUrl:URL;
    try{originUrl=new URL(origin)}catch{throw new InvalidRequestError()}
    if(originUrl.origin!==requestUrl.origin)throw new InvalidRequestError();
    return;
  }
  const fetchSite=request.headers.get("sec-fetch-site");
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
