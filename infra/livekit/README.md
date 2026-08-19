# LiveKit self-hosted para o GrindLobby

## VM e DNS

Use uma VM Linux com IP público fixo. Crie registros DNS `A` apontando `voice.grindlobby.com` e, se habilitar TURN/TLS, `turn.grindlobby.com` para esse IP. O endpoint WebSocket precisa de certificado TLS público válido; coloque Caddy, Nginx ou um load balancer na frente de `127.0.0.1:7880` e encaminhe `voice.grindlobby.com` para essa porta.

## Configuração

1. Copie `.env.example` para `.env` e gere chave e segredo fortes.
2. Mantenha os mesmos valores em `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET` no Render.
3. Configure `NEXT_PUBLIC_LIVEKIT_URL=wss://voice.grindlobby.com` no Render.
4. Revise `livekit.yaml`. Para TURN/TLS, forneça certificado de `turn.grindlobby.com`, chave e `tls_port: 443`; o TURN/UDP integrado já está preparado na porta 3478.
5. Inicie com `docker compose up -d`.

O Compose usa rede do host, recomendada para mídia WebRTC, e Redis persistente para preparar expansão para múltiplos nós.

## Firewall

- `80/tcp`: emissão/renovação de certificado.
- `443/tcp`: HTTPS/WSS e TURN/TLS quando configurado.
- `7881/tcp`: ICE/TCP.
- `3478/udp`: TURN/UDP integrado.
- `50000-60000/udp`: mídia WebRTC.

Não exponha `7880` diretamente; mantenha-o atrás do proxy TLS. Restrinja Redis a localhost/rede privada.

## Verificação

Confirme que `https://voice.grindlobby.com` alcança o proxy, acompanhe `docker compose logs -f livekit` e teste a call em redes diferentes (Wi-Fi e 4G/5G). Para produção redundante, execute múltiplos nós LiveKit com o mesmo Redis e balanceamento compatível com WebSocket.
