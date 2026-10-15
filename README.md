# Checklist — Vingadores: Doutor Destino

Checklist das 15 produções essenciais (14 filmes e 1 série) para assistir antes da estreia de
**Vingadores: Doutor Destino** (*Avengers: Doomsday*), em 17/12/2026. Funcionalidades:

- contagem regressiva até a estreia (00:00, horário de Brasília);
- cadastro e login simples, sem senha (nome, e-mail e WhatsApp);
- marcação de "assistido" com data editável e ordem em que cada título foi visto;
- progresso salvo no servidor (SQLite) e em cache no `localStorage`.

A lista oficial está em [ListadefilmeseseriesparaVingadoresDoomsday.md](ListadefilmeseseriesparaVingadoresDoomsday.md).

## Stack

- **Frontend:** HTML, CSS e JavaScript puros em `public/`, sem framework e sem etapa de build.
- **Backend:** handlers Node no formato de Vercel Functions em `api/`.
- **Banco:** SQLite via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3).

## Estrutura

```
public/            Site estático (index.html, app.js, style.css, assets/)
api/db.js          Conexão SQLite e criação do esquema
api/auth.js        POST /api/auth (register | login), GET /api/auth?id=
api/movies.js      GET/POST/DELETE /api/movies (progresso do usuário)
server.js          Servidor HTTP local: serve public/ e roteia /api/*
selos/             Kit original dos selos "Desenvolvido por Nexum ID" (não publicado)
vercel.json        Configuração de deploy (diretório public/, headers e cache)
```

## Rodando localmente

Requer Node.js 22 ou superior (exigência do `better-sqlite3` 13).

```bash
npm install
npm run dev
```

O app sobe em http://localhost:3000 (use a variável `PORT` para trocar a porta). O banco
`marvel.db` é criado no diretório onde o servidor é iniciado e fica fora do Git.

## API

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/auth` | `{ action: "register", name, email, whatsapp }` ou `{ action: "login", email, whatsapp }` |
| `GET` | `/api/auth?id=` | Dados do usuário |
| `GET` | `/api/movies?userId=` | Filmes assistidos (`data`: id → data, `orders`: id → ordem) |
| `POST` | `/api/movies` | `{ userId, id, watched_date: "AAAA-MM-DD", watched_order? }` |
| `DELETE` | `/api/movies?userId=&id=` | Desmarca um filme e renumera a ordem dos demais |
| `DELETE` | `/api/movies?userId=&action=reset` | Apaga todo o progresso do usuário |

O `id` do filme precisa ser um inteiro de 1 a 15. Se a lista `MOVIES` em `public/app.js` mudar,
atualize também `TOTAL_MOVIES` em `api/movies.js`.

## Deploy

O deploy é feito na Vercel: `public/` é servido como site estático e cada arquivo em `api/` vira
uma função.

## Limitações conhecidas

- **Persistência na Vercel:** o SQLite é gravado em `/tmp`, que é efêmero e separado por
  instância. Os dados se perdem em cold starts e deploys. É preciso migrar para um banco hospedado.
- **Autenticação:** não há sessão no servidor. O `userId` é enviado pelo próprio cliente, então
  qualquer pessoa pode ler ou alterar o progresso de outro usuário, e `GET /api/auth?id=` expõe os
  dados pessoais de qualquer conta.
- Não há testes automatizados.
