import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {notFound,redirect} from 'next/navigation';
import LobbyRoom from '@/components/LobbyRoom';

type SearchParams=Promise<Record<string,string|string[]|undefined>>;

export default async function LobbyPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:SearchParams}){
  const query=await searchParams;
  const lite=query.desktop==='lite';
  const user=await getCurrentUser();if(!user)redirect(lite?'/login?desktop=lite':'/login');
  const {id}=await params,admin=createAdminClient();
  const [{data:lobby},{data:membership}]=await Promise.all([
    admin.from('lobbies').select('id,owner_id,visibility,status').eq('id',id).maybeSingle(),
    admin.from('lobby_members').select('user_id').eq('lobby_id',id).eq('user_id',user.id).maybeSingle(),
  ]);
  if(!lobby)notFound();
  if(lobby.visibility!=='public'&&lobby.owner_id!==user.id&&!membership)notFound();
  return <LobbyRoom id={id} user={user}/>;
}
