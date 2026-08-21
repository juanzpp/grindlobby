import CommunityInvite from '@/components/community/CommunityInvite';
export default async function InvitePage({params}:{params:Promise<{token:string}>}){const {token}=await params;return <CommunityInvite token={token}/>}
