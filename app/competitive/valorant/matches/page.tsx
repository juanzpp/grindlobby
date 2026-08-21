import {redirect} from 'next/navigation';import {getCurrentUser} from '@/lib/auth';import ValorantHistory from '@/components/competitive/ValorantHistory';
export default async function MatchesPage(){const user=await getCurrentUser();if(!user)redirect('/login');return <ValorantHistory/>}
