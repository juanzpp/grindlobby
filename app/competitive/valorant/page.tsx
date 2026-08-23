import {redirect} from 'next/navigation';
import {getCurrentUser} from '@/lib/auth';
import ValorantCompetitive from '@/components/competitive/ValorantCompetitive';
import DesktopModuleShell from '@/components/desktop/DesktopModuleShell';

type SearchParams=Promise<Record<string,string|string[]|undefined>>;

export default async function ValorantPage({searchParams}:{searchParams:SearchParams}){
  const query=await searchParams;
  const desktop=query.desktop==='1',lite=query.desktop==='lite';
  const user=await getCurrentUser();
  if(!user)redirect(lite?'/login?desktop=lite':desktop?'/login?desktop=1&next=/competitive/valorant':'/login?next=/competitive/valorant');
  if(lite)redirect('/desktop-lite?desktop=lite');
  const content=<ValorantCompetitive userId={user.id}/>;
  if(desktop)return <DesktopModuleShell section="competitive" title="GRIND VALORANT" subtitle="COMPETITIVE 5V5">{content}</DesktopModuleShell>;
  return content;
}
