import http from 'node:http';
import { pipeline, Readable } from 'node:stream';

const port = Number(process.env.PORT || 10000);
const upstream = new URL(process.env.GRINDLOBBY_UPSTREAM || 'https://grindlobby.onrender.com');
const REQUEST_TIMEOUT_MS = Number(process.env.PROXY_REQUEST_TIMEOUT_MS || 15000);

function createForwardHeaders(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    if (['host', 'content-length', 'connection'].includes(key.toLowerCase())) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  headers.set('x-forwarded-host', req.headers.host || '');
  headers.set('x-forwarded-proto', 'https');
  headers.set('x-grindlobby-proxy', 'render-public-proxy');
  return headers;
}

async function fetchWithTimeout(target, init, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(target, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function proxyRequest(req) {
  const target = new URL(req.url || '/', upstream);
  const headers = createForwardHeaders(req);
  const init = { method: req.method, headers, redirect: 'manual' };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req;
    init.duplex = 'half';
  }

  // Exactly one upstream request per browser request. This avoids multiplying
  // traffic on Render Free and prevents 429 storms during cold starts.
  return await fetchWithTimeout(target, init);
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(JSON.stringify({ ok: true, service: 'grindlobby-public-proxy' }));
    return;
  }

  if (req.url === '/ready') {
    // Readiness is intentionally local. It must not generate extra traffic to
    // the upstream service or wake sleeping instances repeatedly.
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(JSON.stringify({ ok: true, service: 'grindlobby-public-proxy' }));
    return;
  }

  try {
    const response = await proxyRequest(req);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (['content-length', 'content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) return;
      res.setHeader(key, value);
    });
    res.setHeader('x-grindlobby-proxy', 'render-public-proxy');

    // Never auto-retry or auto-refresh a 429. Respect upstream throttling and
    // allow the rate window to recover naturally.
    if (response.status === 429) {
      res.setHeader('retry-after', response.headers.get('retry-after') || '15');
      res.setHeader('cache-control', 'no-store');
    }

    if (!response.body) {
      res.end();
      return;
    }

    const nodeStream = Readable.fromWeb(response.body);
    pipeline(nodeStream, res, (error) => {
      if (error && !res.headersSent) {
        res.statusCode = 502;
        res.end();
      }
    });
  } catch (error) {
    console.error('Proxy upstream failure', error);
    res.statusCode = 503;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('retry-after', '15');
    res.end(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GrindLobby</title><style>html,body{margin:0;min-height:100%;background:#09070d;color:#fff;font-family:Inter,system-ui,sans-serif}body{display:grid;place-items:center}.box{text-align:center;padding:32px}.dot{width:12px;height:12px;border-radius:999px;background:#8b5cf6;box-shadow:0 0 28px #8b5cf6;margin:0 auto 18px}h1{font-size:20px;margin:0 0 8px}p{margin:0;color:#a9a4b5;max-width:440px}</style></head><body><div class="box"><div class="dot"></div><h1>GrindLobby está iniciando</h1><p>Aguarde alguns segundos e atualize a página uma vez.</p></div></body></html>`);
  }
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

server.listen(port, '0.0.0.0', () => {
  console.log(`GrindLobby public proxy listening on ${port}`);
  console.log(`Upstream: ${upstream.origin}`);
});
