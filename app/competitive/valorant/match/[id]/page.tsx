import {redirect} from 'next/navigation';import {getCurrentUser} from '@/lib/auth';import CompetitiveMatchRoom from '@/components/competitive/CompetitiveMatchRoom';
export default async function MatchPage({params}:{params:Promise<{id:string}>}){const user=await getCurrentUser();if(!user)redirect('/login');const {id}=await params;return <CompetitiveMatchRoom matchId={id} userId={user.id}/>;}
