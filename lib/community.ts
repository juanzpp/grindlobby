import {createHash,randomBytes} from 'node:crypto';
import {createAdminClient} from '@/lib/supabase/admin';

export type CommunityRole='owner'|'admin'|'moderator'|'member';

export function communityInviteToken(){return randomBytes(24).toString('base64url')}
export function communityInviteHash(token:string){return createHash('sha256').update(token).digest('hex')}

export async function getCommunityMembership(communityId:string,userId:string){
  const admin=createAdminClient();
  const {data,error}=await admin.from('community_members').select('community_id,user_id,role,joined_at').eq('community_id',communityId).eq('user_id',userId).maybeSingle();
  if(error)throw error;
  return data as {community_id:string;user_id:string;role:CommunityRole;joined_at:string}|null;
}

export function canManageCommunity(role:CommunityRole|undefined|null){return role==='owner'||role==='admin'}
export function canModerateCommunity(role:CommunityRole|undefined|null){return role==='owner'||role==='admin'||role==='moderator'}
