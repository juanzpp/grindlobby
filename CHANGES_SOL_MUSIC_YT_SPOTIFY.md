# Grind Beats — YouTube + Spotify

Este patch troca a busca Jamendo por YouTube + Spotify e mantém o restante do patch v2 intacto.

## O que mudou
- `/api/music/search` busca no YouTube Data API e Spotify Web API.
- Filtros: Todos / YouTube / Spotify.
- Resultados mostram capa, título, artista/canal, fonte e duração.
- YouTube toca no player oficial IFrame embutido.
- Spotify usa catálogo e link oficial; não extrai nem retransmite áudio.
- A fila, play/pause, próxima/anterior, loop, volume, remoção e reordenação são sincronizados via LiveKit Data Packets enquanto houver call ativa.
- Sem call ativa, o bot continua funcionando como fila local.

## Variáveis no Render
- `YOUTUBE_API_KEY`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

Não use `NEXT_PUBLIC_` para nenhuma dessas credenciais.

## Observação sobre Spotify
A busca do catálogo usa Client Credentials. Reprodução dentro do navegador exigiria autenticação de usuário e as regras/SDK oficiais do Spotify; este patch abre a faixa no Spotify em vez de extrair áudio.

## Teste
1. Adicione as três env vars no Render e faça rebuild.
2. Pesquise por uma faixa com filtro Todos.
3. Adicione um resultado do YouTube à fila e confirme reprodução no player oficial.
4. Adicione um resultado do Spotify e confirme que Play abre a faixa no Spotify.
5. Com duas pessoas na mesma call, altere fila/play/pause/volume e confirme sincronização do estado.
