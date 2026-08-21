import {NextResponse,type NextRequest} from 'next/server'
import {corsHeaders,isAllowedFrontendOrigin} from '@/lib/api/cors'

export function middleware(request:NextRequest){
  const origin=request.headers.get('origin')
  if(!origin)return NextResponse.next()

  if(!isAllowedFrontendOrigin(origin)){
    if(request.method==='OPTIONS')return new NextResponse(null,{status:403})
    return NextResponse.next()
  }

  const headers=corsHeaders(request)
  if(request.method==='OPTIONS')return new NextResponse(null,{status:204,headers})

  const response=NextResponse.next()
  headers.forEach((value,key)=>response.headers.set(key,value))
  return response
}

export const config={matcher:['/api/:path*']}
