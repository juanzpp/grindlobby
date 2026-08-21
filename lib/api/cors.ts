const staticFrontendOrigins=new Set([
  'https://pixel-perfect-clone-87933.lovable.app',
  'https://id-preview--6df5c80b-d9f1-417c-bda4-2a268217f2ca.lovable.app',
])

function configuredOrigins(){
  const raw=process.env.FRONTEND_ORIGINS??''
  return raw.split(',').map(value=>value.trim()).filter(Boolean)
}

export function allowedFrontendOrigins(){
  return new Set([...staticFrontendOrigins,...configuredOrigins()])
}

export function isAllowedFrontendOrigin(origin:string|null){
  if(!origin)return false
  try{return allowedFrontendOrigins().has(new URL(origin).origin)}catch{return false}
}

export function corsHeaders(request:Request){
  const origin=request.headers.get('origin')
  const headers=new Headers({
    'Access-Control-Allow-Headers':'Authorization, Content-Type, X-Request-Id',
    'Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Max-Age':'600',
    'Vary':'Origin',
  })
  if(isAllowedFrontendOrigin(origin))headers.set('Access-Control-Allow-Origin',new URL(origin!).origin)
  return headers
}

export function corsPreflight(request:Request){
  const origin=request.headers.get('origin')
  if(!isAllowedFrontendOrigin(origin))return new Response(null,{status:403})
  return new Response(null,{status:204,headers:corsHeaders(request)})
}
