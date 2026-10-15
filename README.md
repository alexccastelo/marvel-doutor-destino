# Checklist — Vingadores: Doutor Destino

Checklist das 15 produções essenciais (14 filmes e 1 série) para assistir antes da estreia de
**Vingadores: Doutor Destino** (*Avengers: Doomsday*), em 17/12/2026. Funcionalidades:

- contagem regressiva até a estreia (00:00, horário de Brasília);
- cadastro e login simples, sem senha (nome, e-mail e WhatsApp), com sessão por cookie;
- marcação de "assistido" com data editável e ordem em que cada título foi visto;
- progresso salvo no Postgres (Neon) e em cache no `localStorage`.

A lista oficial está em [ListadefilmeseseriesparaVingadoresDoomsday.md](ListadefilmeseseriesparaVingadoresDoomsday.md).

## Stack

- **Frontend:** HTML, CSS e JavaScript puros em `public/doomsday/`, sem framework e sem etapa de build.
- **Backend:** handlers Node no formato de Vercel Functions em `api/`.
- **Banco:** Postgres no [Neon](https://neon.tech), provisionado pelo Marketplace da Vercel
  (recurso `marvel-doutor-destino-db`), acessado com `@neondatabase/serverless`.

## Estrutura

```
public/doomsday/     Site estático (index.html, app.js, style.css, assets/)
api/auth.js          Cadastro, login, logout e usuário da sessão
api/movies.js        GET/POST/DELETE /api/movies (progresso do usuário logado)
api/_lib/db.js       Conexão com o Neon e definição do esquema
api/_lib/session.js  Criação, leitura e remoção de sessões (cookie httpOnly)
scripts/migrate.js   Aplica o esquema no banco (npm run db:migrate)
server.js            Servidor HTTP local: serve public/ e roteia /api/*
selos/               Kit original dos selos "Desenvolvido por Nexum ID" (não publicado)
favicon/             Kit original dos ícones da marca (não publicado); a app usa favicon.ico,
                     nexum-192.png e nexum-180.png, copiados para public/doomsday/assets/icons/
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

O app sobe em http://localhost:3000/doomsday (use a variável `PORT` para trocar a porta). O `server.js` e o
`scripts/migrate.js` leem o `DATABASE_URL` do `.env.local`, que fica fora do Git.

> **Atenção:** o ambiente `development` usa o mesmo banco da produção. Dados criados localmente
> aparecem em produção; apague-os depois de testar.

## Sessão e autenticação

- Login e cadastro criam uma sessão: um token aleatório de 32 bytes vai para o cookie
  `md_session` (`HttpOnly`, `SameSite=Lax`, `Secure` na Vercel, validade de 30 dias), e só o
  hash SHA-256 do token fica na tabela `sessions`.
- As rotas de progresso identificam o usuário **apenas** pela sessão. Qualquer `userId` enviado
  pelo cliente é ignorado.
- O logout apaga a sessão no banco e expira o cookie.
- A API não envia cabeçalhos CORS: ela só é usada pela própria página, na mesma origem.

## API

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/auth` | `{ action: "register", name, email, whatsapp }` ou `{ action: "login", email, whatsapp }`. Cria a sessão. |
| `GET` | `/api/auth` | Usuário da sessão atual (401 sem sessão válida) |
| `DELETE` | `/api/auth` | Logout |
| `GET` | `/api/movies` | Filmes assistidos (`data`: id → data, `orders`: id → ordem) |
| `POST` | `/api/movies` | `{ id, watched_date: "AAAA-MM-DD", watched_order? }` |
| `DELETE` | `/api/movies?id=` | Desmarca um filme e renumera a ordem dos demais |
| `DELETE` | `/api/movies?action=reset` | Apaga todo o progresso do usuário |

Todas as rotas de `/api/movies` exigem sessão válida e retornam 401 sem ela. O `id` do filme
precisa ser um inteiro de 1 a 15. Se a lista `MOVIES` em `public/doomsday/app.js` mudar, atualize também
`TOTAL_MOVIES` em `api/movies.js` e o `CHECK` da tabela em `api/_lib/db.js`.

## Deploy

O deploy é feito na Vercel: `public/` é servido como site estático e cada arquivo em `api/` vira
uma função. O `DATABASE_URL` já está configurado em todos os ambientes pela integração com o
Neon. Se o esquema mudar, rode `npm run db:migrate` antes do deploy.

O navegador guarda `app.js` e `style.css` em cache por 1 dia. Ao alterar esses arquivos,
incremente o `?v=` nos links em `public/doomsday/index.html` para que todos recebam a versão nova.

### URLs e o prefixo `/doomsday`

| URL | Comportamento |
|---|---|
| https://nexum.id/doomsday | URL oficial da app |
| https://nexum.id/ | 404: reservado para o futuro site institucional da Nexum |
| https://www.nexum.id/* | Redireciona (308) para `nexum.id` mantendo o caminho (configuração de domínio do projeto) |
| https://marvel-doutor-destino.vercel.app/ | App na raiz (rewrite para `/doomsday`); `/doomsday` também funciona |

Os arquivos estáticos ficam em `public/doomsday/`, então a raiz do projeto não tem conteúdo. O
`vercel.json` reescreve `/doomsday/api/:path*` para as funções em `/api/*`, e reescreve `/` para
`/doomsday` em qualquer host **exceto** `nexum.id` (o `server.js` faz o mesmo localmente). A página
referencia todos os assets e a API com o prefixo absoluto `/doomsday/...`; ao criar novos links,
use sempre esse prefixo.

Quando o site institucional for publicado, o domínio `nexum.id` deve sair deste projeto e ir
para o projeto do site, que repassa `/doomsday` e `/doomsday/:path*` para
`https://marvel-doutor-destino.vercel.app/doomsday/...` com um rewrite externo.

## Limitações conhecidas

- **Login fraco:** basta saber o e-mail e o WhatsApp de alguém para entrar na conta dessa pessoa.
  Uma melhoria possível é enviar um código de verificação por e-mail.
- **Sem limite de tentativas:** não há rate limiting no login.
- Não há testes automatizados.
