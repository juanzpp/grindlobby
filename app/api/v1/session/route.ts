import {getCurrentUser} from '@/lib/auth'
import {getAccountCapabilities} from '@/lib/account-capabilities'
import {apiError,apiJson} from '@/lib/api/response'
import {corsPreflight,isAllowedFrontendOrigin} from '@/lib/api/cors'

export const dynamic='force-dynamic'

export function OPTIONS(request:Request){return corsPreflight(request)}

export async function GET(request:Request){
  const origin=request.headers.get('origin')
  if(origin&&!isAllowedFrontendOrigin(origin))return apiError(request,403,'origin_not_allowed','Origem não autorizada.')
  const user=await getCurrentUser(request)
  if(!user)return apiError(request,401,'unauthorized','Não autorizado.')
  return apiJson(request,{user,capabilities:getAccountCapabilities(user)})
}
