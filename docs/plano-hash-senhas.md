# Senhas em texto puro — avaliação e plano de migração

Status: **proposta**. Nada disto está aplicado. O código proposto está em
[`hash-senhas.patch`](hash-senhas.patch) (aplica-se sobre a branch atual, sem tocar no schema).
Levantamento feito em 2026-09-29.

## 1. O que existe hoje

`User.password` é uma coluna `String` (`prisma/schema.prisma`) e guarda a senha **como o
usuário a digitou**. Os pontos de contato:

| Onde | O que faz |
|---|---|
| `api/auth/login/route.ts:71` | `user.password !== body.password` — comparação direta |
| `api/auth/reset-password/route.ts` | grava a senha nova crua (o comentário admite: "mantido em texto puro") |
| `api/users/route.ts:151` e `api/users/[id]/route.ts:34` | admin cria/edita usuário e a senha vai crua ao banco |
| `prisma/seed.ts:21,34,48` | `admin123` e `secretaria123`; o `README.md:46` publica o par `admin@seplan.ac.gov.br` / `admin123` |
| `lib/local-quick-access.ts` + `components/domain/login-quick-access.tsx` | guardam a senha em `localStorage` (ver seção 3) |

O que **não** vaza a senha (conferido): `getAuthUser` a omite do objeto (`omit: { password: true }`),
`/auth/me`, `/auth/login` e as rotas de `users` a removem da resposta, o e-mail de redefinição só
leva o link, e **`db:backup` não inclui a tabela `User`** (`scripts/backup.mjs`) — então não há
arquivo de senhas dentro de `backups/` nem no GitHub/GitLab. No repositório e no histórico só
encontrei as senhas do seed (busca por `admin123`/`secretaria123`), nenhuma senha de conta real.

## 2. Risco

- **O que muda com o hash:** quem ler a tabela `User` (comprometimento do Neon, um SQL injection
  futuro, um log, um snapshot) deixa de obter senhas utilizáveis. Hoje obtém todas, e usuários
  reutilizam senha (conta institucional, e-mail). É a mitigação padrão e barata.
- **Escala pequena, valor alto:** são poucos usuários (o comentário de `session-lifetime.ts` cita 8),
  mas o `SEPLAN_ADMIN` grava em dados orçamentários do Estado.
- **Mitigações que já existem:** limite de 5 falhas por conta em 5 min com lock no Postgres (protege
  contra tentativa online, não contra leitura do banco); sessões expiram em 30 dias.
- **Fragilidades vizinhas** (fora do hash, mas do mesmo assunto): senha mínima de **3** caracteres
  (`login/page.tsx`, `reset-password/route.ts`); senhas padrão públicas do seed; o admin trocar a
  senha de alguém por `PATCH /users/[id]` **não encerra as sessões** desse usuário (a redefinição por
  e-mail encerra).

## 3. Acesso rápido do login (senha no navegador)

**Sim, guarda a senha em texto puro no navegador.** `recordSuccessfulLogin` grava
`{ identifier, password, name, role }` em `localStorage['otac-quick-access-v1']`, até **8 contas**,
removidas após **7 dias** sem uso. O botão "Acesso rápido" reenvia essa senha ao `/auth/login`. A
janela de confirmação (`login/page.tsx`) avisa o usuário ("A senha ficará guardada apenas neste
navegador…"), então é uma decisão de produto consciente — mas o risco é real:

- **Computador compartilhado:** qualquer pessoa com acesso ao perfil do navegador lê as senhas
  (DevTools → Application → Local Storage), não só usa o botão.
- **XSS:** qualquer script na mesma origem lê o `localStorage`.
- **Incremento sobre o que já existe:** o token de sessão (`otac-session`) também está em
  `localStorage`, e dá o mesmo acesso por 30 dias. O que o acesso rápido acrescenta é a **senha
  em si**: reutilizável em outros serviços e válida mesmo depois de a sessão ser revogada.
- **O hash no servidor não resolve isto.** O navegador continua com a senha em claro, e as entradas
  já gravadas nos computadores de hoje continuam lá até serem apagadas.

Opções, da mais simples à mais completa:

1. **Recomendada — não guardar a senha.** A entrada guarda só `identifier/name/role`; o clique
   preenche o identificador e põe o foco no campo de senha (o gerenciador de senhas do navegador
   completa o resto; `autoComplete="current-password"` já está lá). Custo: um passo a mais no login.
   Sem mudança de schema. **Precisa também apagar o campo `password` das entradas já salvas** (ao ler
   o `localStorage`, reescrever sem ele), senão a exposição continua nas máquinas atuais.
2. **Manter o um-clique, mas como token de dispositivo.** O servidor emite um token aleatório por
   dispositivo (guardado em hash, revogável, com expiração), e o clique troca o token por uma sessão.
   O vazamento do `localStorage` deixa de revelar a senha. Exige tabela nova (passa por
   `db:backup` + `db:push`) e rota nova.
3. **Manter como está**, mas encurtando a janela (7 dias → 24 h) e deixando o aviso mais explícito.

Não incluí nenhuma delas no patch: muda a experiência de login e é decisão sua.

## 4. O que o patch faz

- **`lib/password.ts` (novo):** scrypt do `node:crypto`, sem dependência nova. Formato
  `scrypt$N$r$p$sal$hash`, com os parâmetros dentro da string (subir o custo no futuro não invalida
  ninguém). Custo atual N=2^15, r=8, p=1: ~80–150 ms e ~32 MiB por hash. Normaliza Unicode (NFKC).
  `verifyPassword` aceita **os dois formatos**: um valor que não começa com `scrypt$` é texto puro e
  é comparado em tempo constante; se conferir, devolve `needsUpgrade`.
- **Login:** confere com `verifyPassword`; se a conta estava em texto puro e a senha conferiu, regrava
  em hash na mesma transação. A regravação é um *compare-and-swap*
  (`WHERE id = … AND password = <valor lido>`): uma redefinição concorrente não é sobrescrita.
  Conta inexistente/inativa gasta o mesmo tempo de uma conferência real — sem isso, o tempo de
  resposta passaria a revelar quais e-mails têm conta. Senha acima de 1024 caracteres é recusada
  antes de qualquer custo.
- **Redefinição, criar usuário, editar usuário, seed:** passam a gravar hash.
- **`scripts/hash-passwords.mjs` (novo):** migra as contas dormentes. **Dry-run por padrão**;
  `--apply` pede confirmação; cada `UPDATE` é compare-and-swap; nunca imprime senha; no dry-run
  também lista quais contas ainda usam `admin123`/`secretaria123`.
- **Testes (15 novos):** unidade do módulo e a rota de login com o banco simulado (senha antiga
  entra e é regravada; hash entra sem regravar; senha errada conta falha e não abre sessão; inativa
  recusada; inexistente gasta tempo; senha gigante recusada). Foi preciso um `vitest.config.ts`
  mínimo com o alias `@` para testar rotas.
- **Sem migração de schema.** A coluna continua `String`; `db:push` não é necessário.

## 5. Como aplicar, em fases

```bash
git apply --ignore-whitespace docs/hash-senhas.patch   # a árvore de trabalho está em CRLF
```

1. **Antes de tudo**, conferir o estado real (leitura somente; usa `DATABASE_URL`, que é produção):
   ```bash
   node --no-warnings scripts/hash-passwords.mjs
   ```
   Mostra quantas contas estão em texto puro e quais usam a senha padrão do seed. Se alguma usar,
   **trocar pela tela Usuários** — hashear não torna secreta uma senha que está no README.
2. **Deploy do código.** A partir daqui cada conta migra sozinha no primeiro login. Não há janela de
   indisponibilidade: os dois formatos funcionam.
3. **Depois de alguns dias**, migrar as dormentes: `node --no-warnings scripts/hash-passwords.mjs --apply`.
4. **Só então** decidir a seção 3 e endurecer a política (mínimo de 8 caracteres; encerrar sessões
   quando o admin troca a senha de alguém; parar de semear senha padrão em produção).

**Backup:** o passo 3 não tem `db:backup` porque o backup não inclui `User` — e não deve incluir; um
backup dela seria um arquivo de senhas em claro. A operação é idempotente. O pior caso (hash gravado
errado) se resolve por "Esqueci minha senha" ou pela tela Usuários, e são poucas contas.

**Rollback:** depois que uma conta migrou, voltar o código para a versão *anterior ao patch* impede o
login dela (o código antigo compara texto puro com um hash). Nesse caso, redefinir a senha resolve.
Voltar para a versão *com* o patch é sempre seguro. Trate o deploy do passo 2 como sem volta para as
contas que já logaram.

## 6. O que não foi verificado

- Não havia Postgres local nem Docker: **`hash-passwords.mjs` nunca rodou contra um banco** (só
  confirmei que carrega e falha apenas ao conectar). Rode o dry-run primeiro e, se puder, teste o
  `--apply` num Postgres descartável.
- A rota de login foi testada com o banco simulado, não contra o Neon nem no runtime da Vercel.
- O custo do scrypt (~100 ms, 32 MiB) roda dentro da transação do login, que já segura um lock
  consultivo por conta; some ~100–250 ms ao login (um hash na conferência, mais um quando regrava).
  As demais rotas não são afetadas. O `libuv` limita a 4 hashes simultâneos por instância.
- `prisma/seed.ts` foi alterado mas não executado.
