const crypto = require('crypto');
const { getSql } = require('./db');

// Regras do código de acesso
const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_EMAIL = 3; // por janela
const MAX_CODES_PER_IP = 10; // por janela
const WINDOW_MINUTES = 15;

// O hash inclui o e-mail: o mesmo código para e-mails diferentes gera hashes diferentes
function hashCode(email, code) {
  return crypto.createHash('sha256').update(`${email}:${code}`).digest('hex');
}

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : null;
}

// true quando o e-mail ou o IP já passaram do limite de códigos na janela
async function isRateLimited(email, ip) {
  const sql = getSql();
  const rows = await sql`
    SELECT
      count(*) FILTER (WHERE email = ${email}) AS by_email,
      count(*) FILTER (WHERE ip = ${ip}) AS by_ip
    FROM login_codes
    WHERE created_at > now() - make_interval(mins => ${WINDOW_MINUTES})
      AND (email = ${email} OR ip = ${ip})
  `;
  return Number(rows[0].by_email) >= MAX_CODES_PER_EMAIL || (ip && Number(rows[0].by_ip) >= MAX_CODES_PER_IP);
}

async function sendCodeEmail(email, code) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Só no desenvolvimento local: sem provedor configurado, o código vai para o log
    if (!process.env.VERCEL) {
      console.log(`[dev] Código de acesso para ${email}: ${code}`);
      return;
    }
    throw new Error('RESEND_API_KEY não configurada');
  }

  const from = process.env.EMAIL_FROM || 'Checklist Doutor Destino <acesso@nexum.id>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `${code} é o seu código de acesso`,
      text:
        `Seu código de acesso ao Checklist Doutor Destino é ${code}.\n\n` +
        `Ele vale por ${CODE_TTL_MINUTES} minutos e só pode ser usado uma vez.\n` +
        'Se você não pediu este código, ignore este e-mail.\n\n' +
        'nexum.id/drdestino',
      html:
        '<div style="font-family:system-ui,sans-serif;font-size:15px;color:#0b1020">' +
        '<p>Seu código de acesso ao <strong>Checklist Doutor Destino</strong> é:</p>' +
        `<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p>` +
        `<p>Ele vale por ${CODE_TTL_MINUTES} minutos e só pode ser usado uma vez.</p>` +
        '<p style="color:#5b6472">Se você não pediu este código, ignore este e-mail.</p>' +
        '<p style="color:#5b6472">nexum.id/drdestino</p></div>'
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Falha no envio do e-mail (HTTP ${response.status}): ${detail.slice(0, 200)}`);
  }
}

// Gera, guarda (só o hash) e envia um código. Retorna false se bloqueado pelo limite.
// Com send=false (e-mail sem cadastro) o registro conta para o limite, mas nada é enviado:
// assim o limite se comporta igual para qualquer e-mail e não revela quem tem conta.
async function issueCode(req, email, { send = true } = {}) {
  const ip = clientIp(req);
  if (await isRateLimited(email, ip)) return false;

  const sql = getSql();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  // Um código novo invalida os anteriores ainda não usados deste e-mail
  await sql`UPDATE login_codes SET used_at = now() WHERE email = ${email} AND used_at IS NULL`;
  await sql`
    INSERT INTO login_codes (email, code_hash, ip, expires_at)
    VALUES (${email}, ${hashCode(email, code)}, ${ip}, ${expiresAt.toISOString()})
  `;
  // Limpeza oportunista de códigos antigos
  await sql`DELETE FROM login_codes WHERE created_at < now() - interval '1 day'`;

  if (send) await sendCodeEmail(email, code);
  return true;
}

// Confere o código do e-mail. Retorna true uma única vez por código válido.
async function verifyCode(email, code) {
  if (!/^\d{6}$/.test(String(code || ''))) return false;

  const sql = getSql();
  const rows = await sql`
    SELECT id, code_hash, attempts
    FROM login_codes
    WHERE email = ${email} AND used_at IS NULL AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const entry = rows[0];
  if (!entry) return false;

  const expected = Buffer.from(entry.code_hash, 'hex');
  const received = Buffer.from(hashCode(email, String(code)), 'hex');
  const ok = expected.length === received.length && crypto.timingSafeEqual(expected, received);

  if (ok) {
    // used_at IS NULL na condição evita usar o mesmo código duas vezes em paralelo
    const marked = await sql`
      UPDATE login_codes SET used_at = now()
      WHERE id = ${entry.id} AND used_at IS NULL
      RETURNING id
    `;
    return marked.length === 1;
  }

  // Erro: conta a tentativa e invalida o código ao atingir o limite
  await sql`
    UPDATE login_codes
    SET attempts = attempts + 1,
        used_at = CASE WHEN attempts + 1 >= ${MAX_ATTEMPTS} THEN now() ELSE used_at END
    WHERE id = ${entry.id}
  `;
  return false;
}

module.exports = {
  issueCode,
  verifyCode,
  CODE_TTL_MINUTES
};
