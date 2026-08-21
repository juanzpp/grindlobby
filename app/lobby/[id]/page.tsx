import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {lobbyInviteHash} from '@/lib/lobby-invites';
import {redirect} from 'next/navigation';
import LobbyRoom from '@/components/LobbyRoom';

export default async function LobbyPage({params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser();if(!user)redirect('/login');
  const {id}=await params,admin=createAdminClient();
  const [{data:lobby},{data:membership}]=await Promise.all([
    admin.from('lobbies').select('id,owner_id,visibility,status').eq('id',id).maybeSingle(),
    admin.from('lobby_members').select('user_id').eq('lobby_id',id).eq('user_id',user.id).maybeSingle(),
  ]);
  if(lobby?.status==='open'&&lobby.visibility!=='public'&&lobby.owner_id!==user.id&&!membership){
    await admin.rpc('redeem_lobby_invite',{p_token_hash:lobbyInviteHash(id),p_user_id:user.id});
  }
  return <LobbyRoom id={id} user={user}/>;
}
