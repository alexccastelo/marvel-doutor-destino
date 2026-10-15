const { getDatabase } = require('./db');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-User-Id'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const db = getDatabase();
    const url = new URL(req.url, 'http://localhost');

    // Extrai o userId da query, header ou body
    const headerUserId = req.headers['x-user-id'];
    const queryUserId = url.searchParams.get('userId') || url.searchParams.get('user_id');
    const bodyUserId = req.body && (req.body.userId || req.body.user_id);
    const userId = Number(queryUserId || headerUserId || bodyUserId);

    // GET: Buscar todos os filmes assistidos por aquele usuário
    if (req.method === 'GET') {
      if (!userId) {
        return res.status(200).json({
          success: true,
          data: {},
          orders: {},
          records: [],
          message: 'Nenhum usuário logado.'
        });
      }

      const rows = db.prepare(`
        SELECT movie_id as id, watched_date, watched_order, notes, updated_at 
        FROM user_watched_movies 
        WHERE user_id = ?
        ORDER BY movie_id ASC
      `).all(userId);

      const watchedMap = {};
      const ordersMap = {};
      rows.forEach(row => {
        watchedMap[row.id] = row.watched_date;
        ordersMap[row.id] = row.watched_order || null;
      });

      return res.status(200).json({
        success: true,
        userId,
        data: watchedMap,
        orders: ordersMap,
        records: rows
      });
    }

    // POST: Inserir ou atualizar a data assistida e ordem de visualização
    if (req.method === 'POST') {
      const body = req.body || {};
      const movieId = Number(body.id || body.movieId || body.movie_id);
      const watchedDate = body.watched_date || body.watchedDate;
      const notes = body.notes || null;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Faça login ou cadastre-se para salvar o progresso no seu perfil.'
        });
      }

      if (!movieId || !watchedDate) {
        return res.status(400).json({
          success: false,
          error: 'Os campos "id" (filme) e "watched_date" são obrigatórios.'
        });
      }

      // Calcula ou preserva o número de ordem assistido
      const existing = db.prepare(
        'SELECT watched_order FROM user_watched_movies WHERE user_id = ? AND movie_id = ?'
      ).get(userId, movieId);

      let finalOrder = body.watched_order;
      if (!finalOrder) {
        if (existing && existing.watched_order) {
          finalOrder = existing.watched_order;
        } else {
          const maxRow = db.prepare(
            'SELECT COALESCE(MAX(watched_order), 0) as maxOrder FROM user_watched_movies WHERE user_id = ?'
          ).get(userId);
          finalOrder = (maxRow ? maxRow.maxOrder : 0) + 1;
        }
      }

      const upsertStmt = db.prepare(`
        INSERT INTO user_watched_movies (user_id, movie_id, watched_date, watched_order, notes, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, movie_id) DO UPDATE SET
          watched_date = excluded.watched_date,
          watched_order = coalesce(excluded.watched_order, user_watched_movies.watched_order),
          notes = coalesce(excluded.notes, user_watched_movies.notes),
          updated_at = CURRENT_TIMESTAMP
      `);

      upsertStmt.run(userId, movieId, String(watchedDate), Number(finalOrder), notes);

      return res.status(200).json({
        success: true,
        message: 'Progresso salvo no banco SQLite.',
        item: {
          userId,
          id: movieId,
          watched_date: String(watchedDate),
          watched_order: Number(finalOrder)
        }
      });
    }

    // DELETE: Remover um filme assistido ou resetar tudo do usuário
    if (req.method === 'DELETE') {
      const action = url.searchParams.get('action') || (req.body && req.body.action);
      const movieId = url.searchParams.get('id') || (req.body && req.body.id);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Usuário não autenticado.'
        });
      }

      if (action === 'reset') {
        db.prepare('DELETE FROM user_watched_movies WHERE user_id = ?').run(userId);
        return res.status(200).json({
          success: true,
          message: 'Todo o seu progresso foi limpo do SQLite.'
        });
      }

      if (movieId) {
        db.prepare('DELETE FROM user_watched_movies WHERE user_id = ? AND movie_id = ?').run(userId, Number(movieId));

        // Renumera as ordens dos filmes restantes para manter sequência 1, 2, 3...
        const remaining = db.prepare(`
          SELECT movie_id 
          FROM user_watched_movies 
          WHERE user_id = ? 
          ORDER BY watched_order ASC, created_at ASC
        `).all(userId);

        const updateOrderStmt = db.prepare(
          'UPDATE user_watched_movies SET watched_order = ? WHERE user_id = ? AND movie_id = ?'
        );
        remaining.forEach((m, idx) => {
          updateOrderStmt.run(idx + 1, userId, m.movie_id);
        });

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
    console.error('Erro na API de filmes SQLite:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno no banco de dados SQLite.',
      details: error.message
    });
  }
};
