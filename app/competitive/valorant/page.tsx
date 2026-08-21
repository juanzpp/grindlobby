import {redirect} from 'next/navigation';import {getCurrentUser} from '@/lib/auth';import ValorantCompetitive from '@/components/competitive/ValorantCompetitive';
export default async function ValorantPage(){const user=await getCurrentUser();if(!user)redirect('/login?next=/competitive/valorant');return <ValorantCompetitive userId={user.id}/>;}
