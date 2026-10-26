const { getSql } = require('./_lib/db');
const { createSession, getSessionUser, destroySession } = require('./_lib/session');
const { issueCode, verifyCode } = require('./_lib/login-codes');

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

// Resposta idêntica para qualquer e-mail: não revela quem tem cadastro
const CODE_SENT = {
  success: true,
  step: 'code',
  message: 'Se o e-mail estiver cadastrado, enviamos um código de acesso. Confira sua caixa de entrada.'
};

const RATE_LIMITED = {
  success: false,
  error: 'Muitos pedidos de código em pouco tempo. Aguarde alguns minutos e tente de novo.'
};

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
    const action = body.action || queryAction;
    const email = cleanEmail(body.email);

    // --- 1. CADASTRO: grava os dados com o aceite e envia o código de confirmação ---
    if (action === 'register') {
      const name = String(body.name || '').trim().slice(0, 100);
      const whatsapp = cleanPhone(body.whatsapp);
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

      // LGPD: o aceite é validado aqui, não só na tela
      if (body.privacy_accepted !== true) {
        return res.status(400).json({
          success: false,
          code: 'PRIVACY_REQUIRED',
          error: 'Para se cadastrar, é preciso aceitar a Política de Privacidade.'
        });
      }

      const existing = await sql`SELECT id, email_verified_at FROM users WHERE email = ${email}`;

      if (existing.length === 0) {
        await sql`
          INSERT INTO users (name, email, whatsapp, privacy_accepted_at, marketing_opt_in, marketing_opt_in_at)
          VALUES (${name}, ${email}, ${whatsapp}, now(), ${marketingOptIn}, ${marketingOptIn ? new Date().toISOString() : null})
          ON CONFLICT (email) DO NOTHING
        `;
      } else if (!existing[0].email_verified_at) {
        // Cadastro nunca confirmado: os dados anteriores não foram validados, então valem os novos
        await sql`
          UPDATE users
          SET name = ${name}, whatsapp = ${whatsapp}, privacy_accepted_at = now(),
              marketing_opt_in = ${marketingOptIn},
              marketing_opt_in_at = ${marketingOptIn ? new Date().toISOString() : null},
              updated_at = now()
          WHERE id = ${existing[0].id}
        `;
      }
      // Cadastro já confirmado: nada muda; o dono do e-mail só recebe um código de acesso

      const issued = await issueCode(req, email);
      if (!issued) return res.status(429).json(RATE_LIMITED);
      return res.status(200).json(CODE_SENT);
    }

    // --- 2. LOGIN: pede o código de acesso por e-mail ---
    if (action === 'request_code') {
      if (!isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          error: 'Por favor, informe um endereço de e-mail válido.'
        });
      }

      const rows = await sql`SELECT id FROM users WHERE email = ${email}`;
      const issued = await issueCode(req, email, { send: rows.length > 0 });
      if (!issued) return res.status(429).json(RATE_LIMITED);
      return res.status(200).json(CODE_SENT);
    }

    // --- 3. Confere o código e abre a sessão ---
    if (action === 'verify_code') {
      const ok = isValidEmail(email) && (await verifyCode(email, String(body.code || '').trim()));
      const rows = ok ? await sql`SELECT id FROM users WHERE email = ${email}` : [];

      if (!ok || rows.length === 0) {
        return res.status(401).json({
          success: false,
          code: 'INVALID_CODE',
          error: 'Código inválido ou expirado. Confira o código ou peça um novo.'
        });
      }

      await sql`
        UPDATE users SET email_verified_at = COALESCE(email_verified_at, now())
        WHERE id = ${rows[0].id}
      `;
      await createSession(res, rows[0].id);
      const user = await loadUser(sql, rows[0].id);

      return res.status(200).json({
        success: true,
        message: `Bem-vindo, ${user.name}!`,
        user
      });
    }

    // Ações abaixo exigem sessão
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      // Clientes antigos ainda podem chamar o login por e-mail + WhatsApp
      const error = action === 'login'
        ? 'O acesso agora é feito com um código enviado para o seu e-mail. Recarregue a página.'
        : 'Sessão inválida ou expirada.';
      return res.status(401).json({ success: false, error });
    }

    // --- 4. Aceite da política por quem se cadastrou antes do aviso ---
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

    // --- 5. Exclusão do perfil (o CASCADE apaga progresso e sessões) ---
    if (action === 'delete_account') {
      await sql`DELETE FROM users WHERE id = ${sessionUser.id}`;
      await sql`DELETE FROM login_codes WHERE email = ${sessionUser.email}`;
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
