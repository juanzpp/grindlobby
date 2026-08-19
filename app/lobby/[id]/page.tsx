import {getCurrentUser} from '@/lib/auth'
import {redirect} from 'next/navigation'
import LobbyRoom from '@/components/LobbyRoom'
export default async function LobbyPage({params}:{params:Promise<{id:string}>}){const user=await getCurrentUser();if(!user)redirect('/login');const {id}=await params;return <LobbyRoom id={id} user={user}/>}
