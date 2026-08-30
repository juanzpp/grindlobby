import http from 'node:http';
import { pipeline, Readable } from 'node:stream';

const port = Number(process.env.PORT || 10000);
const upstream = new URL('https://grindlobby.onrender.com');

const server = http.createServer(async (req, res) => {
  try {
    const target = new URL(req.url || '/', upstream);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value == null) continue;
      if (['host', 'content-length', 'connection'].includes(key.toLowerCase())) continue;
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
    headers.set('x-forwarded-host', req.headers.host || '');
    headers.set('x-forwarded-proto', 'https');
    headers.set('x-grindlobby-proxy', 'render-public-proxy');

    const init = { method: req.method, headers, redirect: 'manual' };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = req;
      init.duplex = 'half';
    }

    const response = await fetch(target, init);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (['content-length', 'content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) return;
      res.setHeader(key, value);
    });
    res.setHeader('x-grindlobby-proxy', 'render-public-proxy');

    if (!response.body) {
      res.end();
      return;
    }

    const nodeStream = Readable.fromWeb(response.body);
    pipeline(nodeStream, res, () => {});
  } catch (error) {
    console.error('Proxy upstream failure', error);
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify({ ok: false, error: 'upstream_unreachable' }));
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`GrindLobby public proxy listening on ${port}`);
});
