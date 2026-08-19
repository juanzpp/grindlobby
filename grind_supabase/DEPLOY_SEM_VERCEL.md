# GrindLobby v2 — deploy sem Vercel

O GrindLobby agora pode rodar como um serviço Next.js normal. O Supabase continua responsável por Postgres/Auth.

## Variáveis obrigatórias

```env
NEXT_PUBLIC_SUPABASE_URL=https://eilaxaklqgyvgjgpkonv.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=COLOQUE_SUA_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=COLOQUE_SUA_SERVICE_ROLE_KEY
```

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no navegador, repositório ou variável com prefixo `NEXT_PUBLIC_`.

## Rodar localmente

```bash
npm install
npm run dev
```

## Rodar em produção sem Docker

```bash
npm ci
npm run build
npm start
```

O serviço escuta por padrão a porta 3000.

## Docker

```bash
docker build -t grindlobby-v2 .
docker run --env-file .env.local -p 3000:3000 grindlobby-v2
```

## Onde hospedar

O mesmo container pode ser usado em Railway, Render, Fly.io ou VPS. Para a etapa futura de signaling/WebSocket/WebRTC, um serviço persistente/contêiner é preferível a depender apenas de funções serverless.

## Supabase

A migration inicial do banco já foi aplicada ao projeto GrindLobby. Uma migration adicional revogou acesso externo à função `handle_new_user`, deixando-a disponível apenas para o trigger interno.
