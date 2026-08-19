import {getCurrentUser} from "@/lib/auth";import {noStoreJson} from "@/lib/security/request";
export async function GET(){const user=await getCurrentUser();return user?noStoreJson({user}):noStoreJson({error:"Não autorizado."},{status:401})}
