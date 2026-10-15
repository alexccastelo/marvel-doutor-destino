const { getSql } = require('./_lib/db');
const { getSessionUser } = require('./_lib/session');

// Deve acompanhar o tamanho da lista MOVIES em public/app.js
const TOTAL_MOVIES = 15;

function parseMovieId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id >= 1 && id <= TOTAL_MOVIES ? id : null;
}

// Aceita apenas datas reais no formato YYYY-MM-DD
function isValidISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

module.exports = async function handler(req, res) {
  // A app é servida na mesma origem: sem cabeçalhos CORS de propósito.
  try {
    const sql = getSql();
    const url = new URL(req.url, 'http://localhost');

    // O usuário vem exclusivamente da sessão (cookie httpOnly), nunca do cliente
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Faça login ou cadastre-se para salvar o progresso no seu perfil.'
      });
    }
    const userId = user.id;

    // GET: Buscar todos os filmes assistidos pelo usuário
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT movie_id AS id, watched_date::text AS watched_date, watched_order, notes, updated_at
        FROM user_watched_movies
        WHERE user_id = ${userId}
        ORDER BY movie_id ASC
      `;

      const watchedMap = {};
      const ordersMap = {};
      rows.forEach(row => {
        watchedMap[row.id] = row.watched_date;
        ordersMap[row.id] = row.watched_order || null;
      });

      return res.status(200).json({
        success: true,
        data: watchedMap,
        orders: ordersMap,
        records: rows
      });
    }

    // POST: Inserir ou atualizar a data assistida e ordem de visualização
    if (req.method === 'POST') {
      const body = req.body || {};
      const movieId = parseMovieId(body.id || body.movieId || body.movie_id);
      const watchedDate = body.watched_date || body.watchedDate;
      const notes = body.notes ? String(body.notes).slice(0, 500) : null;

      if (!movieId) {
        return res.status(400).json({
          success: false,
          error: `O campo "id" deve ser um número inteiro entre 1 e ${TOTAL_MOVIES}.`
        });
      }

      if (!isValidISODate(watchedDate)) {
        return res.status(400).json({
          success: false,
          error: 'O campo "watched_date" deve ser uma data válida no formato AAAA-MM-DD.'
        });
      }

      if (
        body.watched_order != null &&
        !(Number.isInteger(Number(body.watched_order)) &&
          Number(body.watched_order) >= 1 &&
          Number(body.watched_order) <= TOTAL_MOVIES)
      ) {
        return res.status(400).json({
          success: false,
          error: `O campo "watched_order" deve ser um número inteiro entre 1 e ${TOTAL_MOVIES}.`
        });
      }

      // Usa a ordem enviada; senão preserva a existente; senão vai para o fim da fila
      const requestedOrder = body.watched_order != null ? Number(body.watched_order) : null;

      const rows = await sql`
        INSERT INTO user_watched_movies (user_id, movie_id, watched_date, watched_order, notes, updated_at)
        VALUES (
          ${userId},
          ${movieId},
          ${watchedDate},
          COALESCE(
            ${requestedOrder}::smallint,
            (SELECT COALESCE(MAX(watched_order), 0) + 1 FROM user_watched_movies WHERE user_id = ${userId})
          ),
          ${notes},
          now()
        )
        ON CONFLICT (user_id, movie_id) DO UPDATE SET
          watched_date = EXCLUDED.watched_date,
          watched_order = COALESCE(${requestedOrder}::smallint, user_watched_movies.watched_order, EXCLUDED.watched_order),
          notes = COALESCE(EXCLUDED.notes, user_watched_movies.notes),
          updated_at = now()
        RETURNING watched_order
      `;

      return res.status(200).json({
        success: true,
        message: 'Progresso salvo.',
        item: {
          id: movieId,
          watched_date: watchedDate,
          watched_order: rows[0].watched_order
        }
      });
    }

    // DELETE: Remover um filme assistido ou resetar tudo do usuário
    if (req.method === 'DELETE') {
      const action = url.searchParams.get('action') || (req.body && req.body.action);
      const rawMovieId = url.searchParams.get('id') || (req.body && req.body.id);
      const movieId = rawMovieId ? parseMovieId(rawMovieId) : null;

      if (action === 'reset') {
        await sql`DELETE FROM user_watched_movies WHERE user_id = ${userId}`;
        return res.status(200).json({
          success: true,
          message: 'Todo o seu progresso foi limpo.'
        });
      }

      if (rawMovieId && !movieId) {
        return res.status(400).json({
          success: false,
          error: `O campo "id" deve ser um número inteiro entre 1 e ${TOTAL_MOVIES}.`
        });
      }

      if (movieId) {
        // Remove e renumera as ordens restantes (1, 2, 3...) numa única transação
        await sql.transaction([
          sql`DELETE FROM user_watched_movies WHERE user_id = ${userId} AND movie_id = ${movieId}`,
          sql`
            UPDATE user_watched_movies u
            SET watched_order = r.rn
            FROM (
              SELECT movie_id, ROW_NUMBER() OVER (ORDER BY watched_order ASC, created_at ASC) AS rn
              FROM user_watched_movies
              WHERE user_id = ${userId}
            ) r
            WHERE u.user_id = ${userId} AND u.movie_id = r.movie_id
          `
        ]);

        return res.status(200).json({
          success: true,
          message: `Filme ${movieId} desmarcado com sucesso.`
        });
      }

      return res.status(400).json({
        success: false,
        error: 'ID do filme não informado para exclusão.'
      });
    }

    return res.status(405).json({
      success: false,
      error: `Método ${req.method} não suportado.`
    });
  } catch (error) {
    console.error('Erro na API de filmes:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno no servidor.'
    });
  }
};
