# GrindLobby v2

Versão 2: autenticação própria + SQLite local + sessões HTTP-only + dashboard protegido.

## Rodar

1. Copie `.env.example` para `.env.local` e defina `SESSION_SECRET`.
2. `npm install`
3. `npm run dev`
4. Abra `http://localhost:3000`

## O que foi implementado

- Cadastro
- Login por username/email
- Hash de senha com bcrypt
- Sessão persistente em SQLite
- Cookie HTTP-only
- Logout
- Endpoint `/api/me`
- Banco próprio em `data/grindlobby.db`
- Seed inicial de jogos
- Dashboard protegido por autenticação

## Próxima etapa

Implementar repositórios de jogos/ranks e lobbies persistentes; depois WebSocket para presença/chat e signaling WebRTC.
