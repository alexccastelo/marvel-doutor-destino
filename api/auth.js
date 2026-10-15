const { getDatabase } = require('./db');

function cleanPhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

function cleanEmail(email) {
  if (!email) return '';
  return String(email).trim().toLowerCase();
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const db = getDatabase();
    const url = new URL(req.url, 'http://localhost');
    const queryAction = url.searchParams.get('action');

    // GET /api/auth?id=X — Verificar sessão de usuário
    if (req.method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) {
        return res.status(400).json({ success: false, error: 'ID do usuário não informado.' });
      }

      const user = db.prepare('SELECT id, name, email, whatsapp, created_at FROM users WHERE id = ?').get(Number(id));
      if (!user) {
        return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
      }

      return res.status(200).json({
        success: true,
        user
      });
    }

    // POST /api/auth — Cadastro ou Login
    if (req.method === 'POST') {
      const body = req.body || {};
      const action = body.action || queryAction || 'login';
      const email = cleanEmail(body.email);
      const rawWhatsapp = body.whatsapp || '';
      const whatsapp = cleanPhone(rawWhatsapp);

      // --- 1. CADASTRO ---
      if (action === 'register') {
        const name = (body.name || '').trim();

        if (!name || name.length < 2) {
          return res.status(400).json({
            success: false,
            error: 'Por favor, informe seu nome completo (mínimo 2 caracteres).'
          });
        }

        if (!email || !email.includes('@') || !email.includes('.')) {
          return res.status(400).json({
            success: false,
            error: 'Por favor, informe um endereço de e-mail válido.'
          });
        }

        if (!whatsapp || whatsapp.length < 8) {
          return res.status(400).json({
            success: false,
            error: 'Por favor, informe um número de WhatsApp válido com DDD.'
          });
        }

        // Verifica se já existe um usuário com este e-mail
        const existing = db.prepare('SELECT id, name, email, whatsapp FROM users WHERE email = ?').get(email);
        if (existing) {
          return res.status(409).json({
            success: false,
            code: 'EMAIL_EXISTS',
            error: 'Este e-mail já está cadastrado. Faça login informando seu e-mail e WhatsApp.'
          });
        }

        // Insere o novo usuário
        const insertStmt = db.prepare(`
          INSERT INTO users (name, email, whatsapp)
          VALUES (?, ?, ?)
        `);
        const result = insertStmt.run(name, email, whatsapp);
        const newUser = {
          id: Number(result.lastInsertRowid),
          name,
          email,
          whatsapp
        };

        return res.status(201).json({
          success: true,
          message: 'Cadastro realizado com sucesso!',
          user: newUser
        });
      }

      // --- 2. LOGIN ---
      if (action === 'login') {
        if (!email) {
          return res.status(400).json({
            success: false,
            error: 'Por favor, informe seu e-mail para entrar.'
          });
        }

        if (!whatsapp) {
          return res.status(400).json({
            success: false,
            error: 'Por favor, informe seu WhatsApp para entrar.'
          });
        }

        const user = db.prepare('SELECT id, name, email, whatsapp FROM users WHERE email = ?').get(email);
        if (!user) {
          return res.status(404).json({
            success: false,
            code: 'USER_NOT_FOUND',
            error: 'Nenhum cadastro encontrado com este e-mail. Crie sua conta gratuitamente em segundos!'
          });
        }

        // Compara o número de WhatsApp limpo
        const dbPhone = cleanPhone(user.whatsapp);
        if (dbPhone !== whatsapp) {
          return res.status(401).json({
            success: false,
            code: 'INVALID_WHATSAPP',
            error: 'O número de WhatsApp informado não confere com o e-mail cadastrado.'
          });
        }

        return res.status(200).json({
          success: true,
          message: `Bem-vindo de volta, ${user.name}!`,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            whatsapp: user.whatsapp
          }
        });
      }

      return res.status(400).json({
        success: false,
        error: `Ação "${action}" desconhecida.`
      });
    }

    return res.status(405).json({
      success: false,
      error: `Método ${req.method} não suportado.`
    });
  } catch (error) {
    console.error('Erro na rota de autenticação:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro no servidor de autenticação SQLite.',
      details: error.message
    });
  }
};
