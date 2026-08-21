import {getCurrentUser} from '@/lib/auth'
import {getAccountCapabilities} from '@/lib/account-capabilities'
import {noStoreJson} from '@/lib/security/request'

export async function GET(){
  const user=await getCurrentUser()
  if(!user)return noStoreJson({error:'Não autorizado.'},{status:401})
  const {screenShare,store}=getAccountCapabilities(user)
  return noStoreJson({screenShare,store})
}
