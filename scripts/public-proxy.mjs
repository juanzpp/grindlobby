import http from 'node:http';

const port = Number(process.env.PORT || 10000);
const upstream = new URL(process.env.GRINDLOBBY_UPSTREAM || 'https://grindlobby.onrender.com');

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/healthz' || req.url === '/ready') {
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(JSON.stringify({ ok: true, service: 'grindlobby-public-redirect' }));
    return;
  }

  const target = new URL(req.url || '/', upstream);
  res.statusCode = 307;
  res.setHeader('location', target.toString());
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-grindlobby-route', 'direct-render-app');
  res.end();
});

server.listen(port, '0.0.0.0', () => {
  console.log(`GrindLobby redirect service listening on ${port}`);
  console.log(`Redirect target: ${upstream.origin}`);
});
