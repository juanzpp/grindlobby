import {corsHeaders} from '@/lib/api/cors'

export const API_VERSION='2026-08-21'

function requestId(request:Request){
  const incoming=request.headers.get('x-request-id')?.trim()
  if(incoming&&/^[A-Za-z0-9._:-]{8,120}$/.test(incoming))return incoming
  return crypto.randomUUID()
}

function headersFor(request:Request,init?:HeadersInit){
  const headers=corsHeaders(request)
  new Headers(init).forEach((value,key)=>headers.set(key,value))
  headers.set('Cache-Control','private, no-store, max-age=0')
  headers.set('Pragma','no-cache')
  headers.set('X-Grind-Api-Version',API_VERSION)
  headers.set('X-Request-Id',requestId(request))
  return headers
}

export function apiJson(request:Request,data:unknown,init:ResponseInit={}){
  return Response.json({ok:true,data},{...init,headers:headersFor(request,init.headers)})
}

export function apiError(request:Request,status:number,code:string,message:string,details?:unknown){
  return Response.json({ok:false,error:{code,message,...(details===undefined?{}:{details})}},{status,headers:headersFor(request)})
}
