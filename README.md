# Checklist — Vingadores: Doutor Destino

Checklist das 15 produções essenciais (14 filmes e 1 série) para assistir antes da estreia de
**Vingadores: Doutor Destino** (*Avengers: Doomsday*), em 17/12/2026. Funcionalidades:

- contagem regressiva até a estreia (00:00, horário de Brasília);
- cadastro e login simples, sem senha (nome, e-mail e WhatsApp), com sessão por cookie,
  consentimento LGPD e exclusão do perfil;
- marcação de "assistido" com data editável e ordem em que cada título foi visto;
- progresso salvo no Postgres (Neon) e em cache no `localStorage`.

A lista oficial está em [ListadefilmeseseriesparaVingadoresDoomsday.md](ListadefilmeseseriesparaVingadoresDoomsday.md).

## Stack

- **Frontend:** HTML, CSS e JavaScript puros em `public/drdestino/`, sem framework e sem etapa de build.
- **Backend:** handlers Node no formato de Vercel Functions em `api/`.
- **Banco:** Postgres no [Neon](https://neon.tech), provisionado pelo Marketplace da Vercel
  (recurso `marvel-doutor-destino-db`), acessado com `@neondatabase/serverless`.

## Estrutura

```
public/drdestino/     Site estático (index.html, app.js, style.css, assets/)
api/auth.js          Cadastro, login, logout, aceite de privacidade, exclusão do perfil
api/movies.js        GET/POST/DELETE /api/movies (progresso do usuário logado)
api/_lib/db.js       Conexão com o Neon e definição do esquema
api/_lib/session.js  Criação, leitura e remoção de sessões (cookie httpOnly)
api/_lib/login-limit.js  Limite de tentativas de login por e-mail e por IP
scripts/migrate.js   Aplica o esquema no banco (npm run db:migrate / db:migrate:prod)
server.js            Servidor HTTP local: serve public/ e roteia /api/*
selos/               Kit original dos selos "Desenvolvido por Nexum ID" (não publicado)
favicon/             Kit dos ícones da marca, versão colorida com fundo branco (não publicado; ver
                     LEIA-ME.md). A app usa favicon.svg, favicon.ico, apple-touch-icon.png e
                     android-chrome-192.png, copiados para public/drdestino/assets/icons/ como
                     nexum-branco.*; ao trocar o ícone, use nomes novos (cache de 1 ano)
vercel.json          Configuração de deploy (diretório public/, headers e cache)
```

Arquivos em `api/_lib/` começam com `_` para que a Vercel não os publique como funções.

## Rodando localmente

Requer Node.js 22 ou superior e a [Vercel CLI](https://vercel.com/docs/cli) logada no time do
projeto.

```bash
npm install
vercel link --project marvel-doutor-destino
vercel env pull .env.local --yes
npm run db:migrate
npm run dev
```

O app sobe em http://localhost:3000/drdestino (use a variável `PORT` para trocar a porta), e o
servidor mostra no terminal qual banco está usando.

**Banco de desenvolvimento.** O `.env.local` (do `vercel env pull`) aponta para o banco de
**produção**. Para testar sem tocar nos dados reais, crie uma branch no Neon (Vercel → Storage →
`marvel-doutor-destino-db` → Open in Neon → Branches; de preferência *schema only*) e crie na
raiz o arquivo `.env.development.local` com a linha `DATABASE_URL=<connection string da branch>`.
O `server.js` e o `npm run db:migrate` leem esse arquivo antes do `.env.local`, e o
`vercel env pull` não o sobrescreve. Ambos ficam fora do Git (`.env*`).

> **Sem o `.env.development.local`, o ambiente local usa o banco de produção.** Apague os dados de
> teste depois de testar.

## Sessão e autenticação

- Login e cadastro criam uma sessão: um token aleatório de 32 bytes vai para o cookie
  `md_session` (`HttpOnly`, `SameSite=Lax`, `Secure` na Vercel, validade de 30 dias), e só o
  hash SHA-256 do token fica na tabela `sessions`.
- As rotas de progresso identificam o usuário **apenas** pela sessão. Qualquer `userId` enviado
  pelo cliente é ignorado.
- O logout apaga a sessão no banco e expira o cookie.
- A API não envia cabeçalhos CORS: ela só é usada pela própria página, na mesma origem.
- **Login:** e-mail + WhatsApp. E-mail inexistente e WhatsApp errado recebem a mesma resposta
  (401, "E-mail ou WhatsApp não conferem."), para não revelar quem tem cadastro. Cada falha fica
  em `login_attempts`; com 5 falhas do mesmo e-mail ou 20 do mesmo IP em 15 minutos, o login
  responde 429 até a janela passar. Um login certo zera as falhas daquele e-mail.

## Privacidade (LGPD)

- O cadastro exige marcar o aceite da [Política de Privacidade](https://nexum.id/privacidade) (o
  botão só é liberado com a caixa marcada) e a API recusa com 400 um cadastro sem
  `privacy_accepted: true`. O aceite fica em `users.privacy_accepted_at`.
- A caixa "Quero receber novidades da Nexum.iD" é opcional e vem desmarcada; grava
  `users.marketing_opt_in` e `marketing_opt_in_at`.
- Quem se cadastrou antes do aviso (`privacy_accepted_at IS NULL`) vê, depois de entrar, um aviso
  único com as mesmas duas caixas. Pode aceitar (`action: "accept_privacy"`) ou sair.
- "Excluir perfil", no menu do usuário, apaga o registro em `users` após confirmação; o
  `ON DELETE CASCADE` remove o progresso e as sessões.

Coluna/tabela | Conteúdo
---|---
`users.privacy_accepted_at` | Data do aceite da política
`users.marketing_opt_in`, `marketing_opt_in_at` | Opt-in de comunicações e a data
`login_attempts` | Falhas de login (e-mail, IP, data), apagadas após 1 dia

Depois de mudar o esquema em `api/_lib/db.js`, rode `npm run db:migrate` (branch de
desenvolvimento) e `npm run db:migrate:prod` (produção) antes do deploy.

## API

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/auth` | `{ action: "register", name, email, whatsapp, privacy_accepted: true, marketing_opt_in? }` ou `{ action: "login", email, whatsapp }`. Cria a sessão. |
| `POST` | `/api/auth` | Com sessão: `{ action: "accept_privacy", privacy_accepted: true, marketing_opt_in? }` ou `{ action: "delete_account" }` |
| `GET` | `/api/auth` | Usuário da sessão atual (401 sem sessão válida) |
| `DELETE` | `/api/auth` | Logout |
| `GET` | `/api/movies` | Filmes assistidos (`data`: id → data, `orders`: id → ordem) |
| `POST` | `/api/movies` | `{ id, watched_date: "AAAA-MM-DD", watched_order? }` |
| `DELETE` | `/api/movies?id=` | Desmarca um filme e renumera a ordem dos demais |
| `DELETE` | `/api/movies?action=reset` | Apaga todo o progresso do usuário |

Todas as rotas de `/api/movies` exigem sessão válida e retornam 401 sem ela. O `id` do filme
precisa ser um inteiro de 1 a 15. Se a lista `MOVIES` em `public/drdestino/app.js` mudar, atualize também
`TOTAL_MOVIES` em `api/movies.js` e o `CHECK` da tabela em `api/_lib/db.js`.

## Deploy

O deploy é feito na Vercel: `public/` é servido como site estático e cada arquivo em `api/` vira
uma função. O `DATABASE_URL` já está configurado em todos os ambientes pela integração com o
Neon. Se o esquema mudar, rode `npm run db:migrate:prod` antes do deploy.

O navegador guarda `app.js` e `style.css` em cache por 1 dia. Ao alterar esses arquivos,
incremente o `?v=` nos links em `public/drdestino/index.html` para que todos recebam a versão nova.

### URLs e o prefixo `/drdestino`

| URL | Comportamento |
|---|---|
| https://nexum.id/drdestino | URL principal da app, servida por proxy pelo site institucional |
| https://nexum.id/doomsday | Endereço antigo: redireciona (308) para `/drdestino`, mantendo o resto do caminho |
| https://nexum.id/ | Site institucional da Nexum (projeto `nexum-site-institucional`) |
| https://www.nexum.id/* | Redireciona (308) para `nexum.id` mantendo o caminho (configuração de domínio do site institucional) |
| https://marvel-doutor-destino.vercel.app/ | App na raiz (rewrite para `/drdestino`); `/drdestino` também funciona |

Os arquivos estáticos ficam em `public/drdestino/`, então a raiz do projeto não tem conteúdo. O
`vercel.json` reescreve `/drdestino/api/:path*` para as funções em `/api/*`, reescreve `/` para
`/drdestino` e redireciona o caminho antigo `/doomsday/*` para `/drdestino/*` (o `server.js` faz o
mesmo localmente). A página referencia todos os assets e a API com o prefixo absoluto
`/drdestino/...`; ao criar novos links, use sempre esse prefixo.

Os domínios `nexum.id` e `www.nexum.id` pertencem ao projeto `nexum-site-institucional`
(repositório `alexccastelo/nexum-site-institucional`). O `vercel.json` dele repassa `/drdestino` e
`/drdestino/:path*` para `https://marvel-doutor-destino.vercel.app/drdestino/...` com um rewrite
externo e redireciona `/doomsday/*` para `/drdestino/*`. O navegador só fala com `nexum.id`, então o cookie de sessão e as chamadas à API
funcionam através do proxy. Este projeto não precisa de nenhum domínio próprio além do
`.vercel.app`, que precisa continuar público, sem proteção de deploy.

## Limitações conhecidas

- **Login ainda fraco:** com o limite de tentativas fica difícil adivinhar, mas quem souber o
  e-mail e o WhatsApp de alguém entra na conta dessa pessoa. O login com código de uso único por
  e-mail está pronto no branch `feat/login-codigo-email` e aguarda um provedor de e-mail (a
  integração do Resend pela Vercel exige plano pago; a conta gratuita direto no resend.com
  funciona com a variável `RESEND_API_KEY`).
- **O cadastro revela e-mails existentes:** tentar cadastrar um e-mail já usado devolve 409. Só o
  login com código resolve isso sem atrapalhar o cadastro.
- Não há testes automatizados.
