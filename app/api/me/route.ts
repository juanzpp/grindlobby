import {getCurrentUser} from "@/lib/auth";import {noStoreJson} from "@/lib/security/request";
export async function GET(request:Request){const user=await getCurrentUser(request);return user?noStoreJson({user}):noStoreJson({error:"Não autorizado."},{status:401})}
