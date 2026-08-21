import {getScreenSharePolicy} from '@/lib/livekit-screen-policy'

type CapabilityUser={account_tier?:string|null;app_role?:string|null}

export function getAccountCapabilities(user:CapabilityUser){
  const isAdmin=user.app_role==='admin'
  const pro=user.account_tier==='pro'||isAdmin
  const screenShare=getScreenSharePolicy(pro)
  return {
    entitlements:{tier:pro?'pro' as const:'free' as const,isAdmin},
    screenShare:{...screenShare,allowed:true,reason:null},
    store:{premiumAccess:pro,allTestItems:isAdmin,purchasesAllowed:pro},
  }
}
