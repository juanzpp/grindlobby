import {redirect} from 'next/navigation';
import {getCurrentUser} from '@/lib/auth';
import CompetitiveMatchRoom from '@/components/competitive/CompetitiveMatchRoom';
import DesktopModuleShell from '@/components/desktop/DesktopModuleShell';

type SearchParams=Promise<Record<string,string|string[]|undefined>>;

export default async function MatchPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:SearchParams}){
  const query=await searchParams;
  const desktop=query.desktop==='1',lite=query.desktop==='lite';
  const user=await getCurrentUser();
  if(!user)redirect(lite?'/login?desktop=lite':desktop?'/login?desktop=1':'/login');
  if(lite)redirect('/desktop-lite?desktop=lite');
  const {id}=await params;
  const content=<CompetitiveMatchRoom matchId={id} userId={user.id}/>;
  if(desktop)return <DesktopModuleShell section="competitive" title="Competitive Match" subtitle="LIVE MATCH ROOM">{content}</DesktopModuleShell>;
  return content;
}
