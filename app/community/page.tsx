import {redirect} from 'next/navigation';
import {getCurrentUser} from '@/lib/auth';
import CommunityHub from '@/components/community/CommunityHub';
export default async function CommunityPage(){const user=await getCurrentUser();if(!user)redirect('/login?next=/community');return <CommunityHub/>;}
