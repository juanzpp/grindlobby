'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ManagerApp from './ManagerApp';
import { api } from '@/lib/api';

export default function AuthenticatedManager(){
  const router=useRouter();
  const [ready,setReady]=useState(false);
  useEffect(()=>{api('/api/auth/me').then(()=>setReady(true)).catch(()=>router.replace('/login'));},[router]);
  if(!ready)return <div className="auth-boot"><div/><span>Validando acesso seguro…</span></div>;
  return <ManagerApp/>;
}
