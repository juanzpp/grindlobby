import {redirect} from 'next/navigation';
import {getCurrentUser} from '@/lib/auth';
import CommunityHub from '@/components/community/CommunityHub';
import DesktopModuleShell from '@/components/desktop/DesktopModuleShell';

type SearchParams=Promise<Record<string,string|string[]|undefined>>;

export default async function CommunityPage({searchParams}:{searchParams:SearchParams}){
  const query=await searchParams;
  const desktop=query.desktop==='1',lite=query.desktop==='lite';
  const user=await getCurrentUser();
  if(!user)redirect(lite?'/login?desktop=lite':desktop?'/login?desktop=1&next=/community':'/login?next=/community');
  if(lite)redirect('/desktop-lite?desktop=lite');
  const content=<CommunityHub/>;
  if(desktop)return <DesktopModuleShell section="community" title="Communities" subtitle="PRIVATE GROUP HUB">{content}</DesktopModuleShell>;
  return content;
}
