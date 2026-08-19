# GrindLobby — revisão de segurança, privacidade e ECA Digital

Data da revisão: 19 de agosto de 2026.

Este documento registra evidências e limites da revisão. Ele não declara conformidade jurídica integral nem substitui avaliação jurídica, pentest ou DPIA/RIPD.

## Escopo revisado

- Next.js App Router, rotas de autenticação, dashboard, lobby e token LiveKit.
- Configuração Supabase, grants, RLS, advisors e histórico de migrations.
- Sessões/cookies, redirects, validação de entrada, erros e logs.
- Capacidades Free/PRO/admin e transmissão de tela.
- Minimização de dados e fundação de aferição etária/responsável.

## Achados objetivos antes do hardening

1. O projeto remoto tinha RLS habilitado, porém grants amplos e policies permitiam mutações diretas pelo papel `authenticated`.
2. Um usuário podia inserir o próprio `user_id` em `lobby_members` escolhendo um `role` privilegiado.
3. O próprio jogador podia inserir/alterar seus registros de rank.
4. A tabela legada `voice_signals` continuava exposta a papéis do browser, embora a voz já use LiveKit.
5. Faltavam índices para chaves estrangeiras indicadas pelo advisor.
6. O histórico remoto de migrations não correspondia integralmente aos arquivos locais; há drift que precisa ser reconciliado antes de automação de deploy.
7. O advisor de segurança do Supabase indicou proteção contra senhas vazadas desabilitada.
8. Rate limits locais de processo não seriam suficientes para múltiplas instâncias.

## Controles implementados no código/migration local

- Todas as mutações sensíveis passam por rotas autenticadas server-side.
- Proteção same-origin para POST, limite de tamanho e schemas Zod estritos.
- Rate limit atômico e distribuído no Postgres, com chaves HMAC pseudonimizadas.
- Logs estruturados sem e-mail, token, cookie, Authorization, segredo ou payload.
- Cookies de sessão `HttpOnly`, `Secure` em produção, `SameSite=Lax` e escopo `Path=/`.
- Logout invalida a sessão pelo provedor; redirects aceitam somente caminhos internos.
- CSP, HSTS em produção, `nosniff`, proteção contra framing, Referrer-Policy e Permissions-Policy.
- Token LiveKit de curta duração, assinatura/claims validados no servidor e publicação limitada a microfone, tela e áudio da tela.
- PRO/admin deriva de configuração server-side por auth user ID; e-mail não é chave de autorização.
- Escritas de rank retiradas do browser.
- Writes de lobby retirados do browser; join usa função serializada com limite de capacidade.
- Sinalização P2P legada fica sem grants/policies de browser.
- Grants de tabelas substituídos pelo mínimo necessário.

## Matriz resumida de autorização

| Recurso | Leitura | Escrita |
| --- | --- | --- |
| Perfil privado | próprio usuário / rotas confiáveis | campos públicos do próprio perfil |
| Rank | usuário autenticado | somente processamento confiável futuro |
| Lobby | público, proprietário ou membro via API | rotas server-side autenticadas |
| Membership | dados mínimos via API autorizada | rotas server-side; join serializado |
| LiveKit token | membro ativo e elegível | emissão server-side |
| Age assurance | próprio usuário | rota server-side/provider |
| Guardian link | menor/responsável relacionado | fluxo server-side futuro |
| Voice signals legado | nenhum browser | nenhum browser |

## Aferição etária e responsável

A fundação persiste apenas:

- faixa etária;
- status da aferição;
- método/status do provedor;
- timestamps de verificação e expiração;
- status mínimo do vínculo com responsável.

Não são armazenados data completa de nascimento, imagem de documento, biometria ou token de convite em claro. Convites de responsável foram modelados com hash e expiração. O provider atual é deliberadamente `deferred`: ele inicia o estado, mas nunca afirma que a idade foi verificada. Faixas que exigem responsável mantêm lobby, voz e transmissão bloqueados até integração real.

Pendências obrigatórias antes de produção regulada:

1. selecionar e contratar provedor de aferição adequado ao risco;
2. implementar jornada verificável do responsável;
3. definir base legal, avisos, canal de contestação e revisão humana;
4. produzir RIPD/DPIA com jurídico/DPO;
5. testar acessibilidade e cenários de falsa classificação;
6. documentar exclusão e portabilidade de dados do fluxo.

## Inventário e retenção proposta

| Dado | Finalidade | Retenção recomendada |
| --- | --- | --- |
| Sessão Supabase | autenticação | até logout, revogação ou expiração do provedor |
| Perfil | conta e identidade pública | vida da conta; excluir/anonomizar sob solicitação aplicável |
| Membership/presença | operação do lobby | presença expira em 30 s; histórico deve ter política de expurgo definida |
| Voice signals legado | nenhuma nova finalidade | remover após confirmar ausência de rollback P2P |
| Rate limits | prevenção de abuso | janela + até 24 h para limpeza operacional |
| Logs de segurança | investigação | definir 30–90 dias conforme risco e acesso restrito |
| Consentimentos versionados | prova de aceite | duração da conta + prazo jurídico definido |
| Age assurance | habilitação segura | somente enquanto necessário; revalidar na expiração |
| Guardian links | autorização | convite até expiração; vínculo até revogação/fim da necessidade |

Uma rotina agendada de expurgo ainda deve ser criada depois que os prazos forem aprovados. Não foi implementada uma exclusão automática sem política aprovada para evitar apagar evidência necessária ou reter além do necessário por suposição.

## Ações operacionais externas

- Aplicar e revisar a migration local `20260819150915_security_age_assurance.sql` em staging antes de produção.
- Reconciliar o drift do histórico de migrations remoto.
- Habilitar proteção de senha vazada no Supabase Auth.
- Revisar os rate limits nativos do Supabase Auth e SMTP.
- Configurar `RATE_LIMIT_SALT` longo e aleatório no Render.
- Configurar `GRINDLOBBY_ADMIN_USER_IDS` somente com UUIDs aprovados.
- Confirmar rotação/escopo de service-role, LiveKit key/secret e acesso aos logs.
- Executar pentest de IDOR, CSRF, enumeração, privilege escalation e abuso de mídia.

## Risco residual

O hardening reduz as falhas encontradas, mas a migration ainda não foi aplicada e os testes reais multi-dispositivo/browser dependem de credenciais, dispositivos e ambiente de produção/staging. ECA Digital, proteção de dados e autorização de responsáveis permanecem uma iniciativa técnica-jurídica contínua, não um estado obtido apenas por código.
