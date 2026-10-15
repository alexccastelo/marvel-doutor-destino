const { getSql } = require('./_lib/db');
const { createSession, getSessionUser, destroySession } = require('./_lib/session');

function cleanPhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

function cleanEmail(email) {
  if (!email) return '';
  return String(email).trim().toLowerCase();
}

module.exports = async function handler(req, res) {
  // A app é servida na mesma origem: sem cabeçalhos CORS de propósito.
  try {
    const sql = getSql();
    const url = new URL(req.url, 'http://localhost');
    const queryAction = url.searchParams.get('action');

    // GET /api/auth — Usuário da sessão atual (cookie)
    if (req.method === 'GET') {
      const user = await getSessionUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: 'Sessão inválida ou expirada.' });
      }
      return res.status(200).json({ success: true, user });
    }

    // DELETE /api/auth — Logout
    if (req.method === 'DELETE') {
      await destroySession(req, res);
      return res.status(200).json({ success: true, message: 'Sessão encerrada.' });
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
        const name = String(body.name || '').trim().slice(0, 100);

        if (!name || name.length < 2) {
          return res.status(400).json({
            success: false,
            error: 'Por favor, informe seu nome completo (mínimo 2 caracteres).'
          });
        }

        if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return res.status(400).json({
            success: false,
            error: 'Por favor, informe um endereço de e-mail válido.'
          });
        }

        if (!whatsapp || whatsapp.length < 10 || whatsapp.length > 13) {
          return res.status(400).json({
            success: false,
            error: 'Por favor, informe um número de WhatsApp válido com DDD.'
          });
        }

        // Insere o novo usuário; se o e-mail já existir, nada é inserido
        const inserted = await sql`
          INSERT INTO users (name, email, whatsapp)
          VALUES (${name}, ${email}, ${whatsapp})
          ON CONFLICT (email) DO NOTHING
          RETURNING id, name, email, whatsapp
        `;

        if (inserted.length === 0) {
          return res.status(409).json({
            success: false,
            code: 'EMAIL_EXISTS',
            error: 'Este e-mail já está cadastrado. Faça login informando seu e-mail e WhatsApp.'
          });
        }

        const newUser = inserted[0];
        await createSession(res, newUser.id);

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

        const rows = await sql`SELECT id, name, email, whatsapp FROM users WHERE email = ${email}`;
        const user = rows[0];
        if (!user) {
          return res.status(404).json({
            success: false,
            code: 'USER_NOT_FOUND',
            error: 'Nenhum cadastro encontrado com este e-mail. Crie sua conta gratuitamente em segundos!'
          });
        }

        // Compara o número de WhatsApp limpo
        if (cleanPhone(user.whatsapp) !== whatsapp) {
          return res.status(401).json({
            success: false,
            code: 'INVALID_WHATSAPP',
            error: 'O número de WhatsApp informado não confere com o e-mail cadastrado.'
          });
        }

        await createSession(res, user.id);

        return res.status(200).json({
          success: true,
          message: `Bem-vindo de volta, ${user.name}!`,
          user
        });
      }

      return res.status(400).json({
        success: false,
        error: 'Ação desconhecida.'
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
      error: 'Erro no servidor de autenticação.'
    });
  }
};
