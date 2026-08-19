# GrindLobby — atualização da call/screen/chat

Implementado neste pacote:

- call LiveKit persistente durante navegação client-side;
- dock global da call com mute, sair, voltar à sala e aviso de amigo transmitindo;
- heartbeat da call mantido enquanto a sessão de voz está ativa;
- compartilhamento com 360p, 480p, 720p e 1080p (respeitando entitlement Free/Pro);
- presets de bitrate/fps para reduzir atraso e uso de banda;
- cards mais claros para amigos que estão transmitindo;
- chat da sala em tempo real via LiveKit Data Packets (histórico da sessão em memória, não persistente no banco);
- abas Membros / Chat dentro da sala.

## Testes recomendados

1. Entrar na mesma sala em PC e celular.
2. Entrar no áudio em ambos.
3. Navegar da sala para o dashboard e confirmar que a call continua.
4. Voltar à sala pelo dock inferior.
5. Compartilhar tela em 360p, 480p, 720p e (PRO/admin) 1080p.
6. Confirmar que o outro participante recebe aviso de transmissão no dock e na sala.
7. Testar chat nos dois sentidos.
8. Testar mute/unmute pelo dock fora da sala.
9. Encerrar a call pelo dock e confirmar desconexão.

## Observação de validação

O ZIP recebido contém dependências de `node_modules` incompletas; por isso não foi possível executar build/TypeScript localmente neste ambiente. Rode `npm install && npm run build` no Codespace antes do merge/deploy.
