const { getSql } = require('./_lib/db');
const { createSession, getSessionUser, destroySession } = require('./_lib/session');
const { clientIp, isLoginBlocked, recordLoginFailure, clearLoginFailures } = require('./_lib/login-limit');

function cleanPhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

function cleanEmail(email) {
  if (!email) return '';
  return String(email).trim().toLowerCase();
}

function isValidEmail(email) {
  return !!email && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function loadUser(sql, id) {
  const rows = await sql`
    SELECT id, name, email, whatsapp,
           (privacy_accepted_at IS NOT NULL) AS privacy_accepted, marketing_opt_in
    FROM users WHERE id = ${id}
  `;
  return rows[0] || null;
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

    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: `Método ${req.method} não suportado.` });
    }

    const body = req.body || {};
    const action = body.action || queryAction || 'login';
    const email = cleanEmail(body.email);
    const whatsapp = cleanPhone(body.whatsapp);

    // --- 1. CADASTRO (exige o aceite da política, validado aqui) ---
    if (action === 'register') {
      const name = String(body.name || '').trim().slice(0, 100);
      const marketingOptIn = body.marketing_opt_in === true;

      if (!name || name.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Por favor, informe seu nome completo (mínimo 2 caracteres).'
        });
      }

      if (!isValidEmail(email)) {
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

      if (body.privacy_accepted !== true) {
        return res.status(400).json({
          success: false,
          code: 'PRIVACY_REQUIRED',
          error: 'Para se cadastrar, é preciso aceitar a Política de Privacidade.'
        });
      }

      const inserted = await sql`
        INSERT INTO users (name, email, whatsapp, privacy_accepted_at, marketing_opt_in, marketing_opt_in_at)
        VALUES (${name}, ${email}, ${whatsapp}, now(), ${marketingOptIn},
                ${marketingOptIn ? new Date().toISOString() : null})
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `;

      if (inserted.length === 0) {
        return res.status(409).json({
          success: false,
          error: 'Não foi possível concluir o cadastro com esses dados. Se você já tem perfil, use a aba "Já sou cadastrado".'
        });
      }

      await createSession(res, inserted[0].id);
      return res.status(201).json({
        success: true,
        message: 'Cadastro realizado com sucesso!',
        user: await loadUser(sql, inserted[0].id)
      });
    }

    // --- 2. LOGIN (e-mail + WhatsApp, com limite de tentativas e erro genérico) ---
    if (action === 'login') {
      if (!email || !whatsapp) {
        return res.status(400).json({
          success: false,
          error: 'Por favor, informe o e-mail e o WhatsApp.'
        });
      }

      const ip = clientIp(req);
      if (await isLoginBlocked(email, ip)) {
        return res.status(429).json({
          success: false,
          error: 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.'
        });
      }

      const rows = await sql`SELECT id, whatsapp FROM users WHERE email = ${email}`;
      const user = rows[0];

      // Mesma resposta para e-mail inexistente e WhatsApp errado: não revela quem tem cadastro
      if (!user || cleanPhone(user.whatsapp) !== whatsapp) {
        await recordLoginFailure(email, ip);
        return res.status(401).json({
          success: false,
          error: 'E-mail ou WhatsApp não conferem.'
        });
      }

      await clearLoginFailures(email);
      await createSession(res, user.id);
      const fullUser = await loadUser(sql, user.id);
      return res.status(200).json({
        success: true,
        message: `Bem-vindo de volta, ${fullUser.name}!`,
        user: fullUser
      });
    }

    // Ações abaixo exigem sessão
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      return res.status(401).json({ success: false, error: 'Sessão inválida ou expirada.' });
    }

    // --- 3. Aceite da política por quem se cadastrou antes do aviso ---
    if (action === 'accept_privacy') {
      if (body.privacy_accepted !== true) {
        return res.status(400).json({
          success: false,
          code: 'PRIVACY_REQUIRED',
          error: 'É preciso aceitar a Política de Privacidade para continuar.'
        });
      }
      const marketingOptIn = body.marketing_opt_in === true;
      await sql`
        UPDATE users
        SET privacy_accepted_at = COALESCE(privacy_accepted_at, now()),
            marketing_opt_in = ${marketingOptIn}::boolean,
            marketing_opt_in_at = CASE
              WHEN ${marketingOptIn}::boolean AND NOT marketing_opt_in THEN now()
              WHEN NOT ${marketingOptIn}::boolean THEN NULL
              ELSE marketing_opt_in_at END,
            updated_at = now()
        WHERE id = ${sessionUser.id}
      `;
      return res.status(200).json({ success: true, user: await loadUser(sql, sessionUser.id) });
    }

    // --- 4. Exclusão do perfil (o CASCADE apaga progresso e sessões) ---
    if (action === 'delete_account') {
      await sql`DELETE FROM users WHERE id = ${sessionUser.id}`;
      await clearLoginFailures(sessionUser.email);
      await destroySession(req, res);
      return res.status(200).json({ success: true, message: 'Perfil excluído.' });
    }

    return res.status(400).json({ success: false, error: 'Ação desconhecida.' });
  } catch (error) {
    console.error('Erro na rota de autenticação:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro no servidor de autenticação.'
    });
  }
};
