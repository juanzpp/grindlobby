import http from 'node:http';

const port = Number(process.env.PORT || 10000);
const upstream = new URL(process.env.GRINDLOBBY_UPSTREAM || 'https://grindlobby.onrender.com');

function htmlTransfer(target) {
  const destination = JSON.stringify(target.toString());
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GrindLobby</title><style>html,body{margin:0;min-height:100%;background:#070910;color:#fff;font-family:Inter,system-ui,sans-serif}body{display:grid;place-items:center}.box{text-align:center;padding:32px}.dot{width:12px;height:12px;border-radius:999px;background:#8b5cf6;box-shadow:0 0 28px #8b5cf6;margin:0 auto 18px;animation:p 1.1s ease-in-out infinite}@keyframes p{50%{transform:scale(1.7);opacity:.45}}h1{font-size:18px;margin:0 0 8px}p{margin:0;color:#a9a4b5;font-size:13px}</style></head><body><div class="box"><div class="dot"></div><h1>Entrando no GrindLobby</h1><p>Sincronizando sua sessão...</p></div><script>(()=>{const target=${destination};let session=null;const stores=[window.localStorage,window.sessionStorage];for(const store of stores){try{for(let i=0;i<store.length;i+=1){const key=store.key(i)||'';if(!key.includes('-auth-token'))continue;const raw=store.getItem(key);if(!raw)continue;const parsed=JSON.parse(raw);const candidate=parsed?.access_token?parsed:parsed?.currentSession?.access_token?parsed.currentSession:null;if(candidate?.access_token&&candidate?.refresh_token){session={access_token:candidate.access_token,refresh_token:candidate.refresh_token};break;}}}catch{}if(session)break;}if(!session){window.location.replace(target);return;}try{const json=JSON.stringify(session);const bytes=new TextEncoder().encode(json);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);const encoded=btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');const url=new URL(target);const hash=new URLSearchParams(url.hash.slice(1));hash.set('gl_session',encoded);url.hash=hash.toString();window.location.replace(url.toString());}catch{window.location.replace(target);}})();</script></body></html>`;
}

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/healthz' || req.url === '/ready') {
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(JSON.stringify({ ok: true, service: 'grindlobby-public-session-bridge' }));
    return;
  }

  const target = new URL(req.url || '/', upstream);
  const acceptsHtml = String(req.headers.accept || '').includes('text/html');
  if (req.method === 'GET' && acceptsHtml) {
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'x-grindlobby-route': 'session-bridge',
    });
    res.end(htmlTransfer(target));
    return;
  }

  res.statusCode = 307;
  res.setHeader('location', target.toString());
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-grindlobby-route', 'direct-render-app');
  res.end();
});

server.listen(port, '0.0.0.0', () => {
  console.log(`GrindLobby public session bridge listening on ${port}`);
  console.log(`Redirect target: ${upstream.origin}`);
});
