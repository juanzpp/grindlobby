export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
    credentials: 'include',
  });
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try { const data = await res.json(); msg = data.detail || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}
export const money = (v: number | string = 0) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
export const dateTime = (v?: string) => v ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)) : '—';
export function wsUrl(){
  if (typeof window === 'undefined') return '';
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  if (configured) return configured;
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.hostname;
  return `${protocol}://${host}:8000/ws`;
}
