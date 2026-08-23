import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {notFound,redirect} from 'next/navigation';
import LobbyRoom from '@/components/LobbyRoom';
import DesktopLobbyRoom from '@/components/desktop/DesktopLobbyRoom';

type SearchParams=Promise<Record<string,string|string[]|undefined>>;

export default async function LobbyPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:SearchParams}){
  const query=await searchParams;
  const desktopMode=query.desktop==='lite'?'lite':query.desktop==='1'?'standard':null;
  const user=await getCurrentUser();
  if(!user)redirect(desktopMode?`/login?desktop=${desktopMode==='lite'?'lite':'1'}`:'/login');
  const {id}=await params,admin=createAdminClient();
  const [{data:lobby},{data:membership}]=await Promise.all([
    admin.from('lobbies').select('id,owner_id,visibility,status').eq('id',id).maybeSingle(),
    admin.from('lobby_members').select('user_id').eq('lobby_id',id).eq('user_id',user.id).maybeSingle(),
  ]);
  if(!lobby)notFound();
  if(lobby.visibility!=='public'&&lobby.owner_id!==user.id&&!membership)notFound();
  if(desktopMode)return <DesktopLobbyRoom id={id} user={user} mode={desktopMode}/>;
  return <LobbyRoom id={id} user={user}/>;
}
