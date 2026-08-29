import { Suspense } from 'react';
import LoginApp from '@/components/LoginApp';
export default function LoginPage(){return <Suspense fallback={<div className="auth-boot"><div/><span>Carregando acesso…</span></div>}><LoginApp/></Suspense>}
