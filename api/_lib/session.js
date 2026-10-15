const crypto = require('crypto');
const { getSql } = require('./db');

const COOKIE_NAME = 'md_session';
const SESSION_DAYS = 30;
const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

// Só o hash do token fica no banco: um vazamento da tabela não expõe sessões válidas.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

function buildCookie(value, maxAge) {
  const parts = [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`
  ];
  // Em produção (Vercel) sempre HTTPS; no localhost o cookie precisa funcionar via HTTP.
  if (process.env.VERCEL) parts.push('Secure');
  return parts.join('; ');
}

async function createSession(res, userId) {
  const sql = getSql();
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  await sql`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (${hashToken(token)}, ${userId}, ${expiresAt.toISOString()})
  `;
  // Limpeza oportunista de sessões expiradas deste usuário
  await sql`DELETE FROM sessions WHERE user_id = ${userId} AND expires_at < now()`;

  res.setHeader('Set-Cookie', buildCookie(token, SESSION_MAX_AGE));
}

// Retorna o usuário da sessão atual ou null
async function getSessionUser(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return null;

  const sql = getSql();
  const rows = await sql`
    SELECT u.id, u.name, u.email, u.whatsapp
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > now()
  `;
  return rows[0] || null;
}

async function destroySession(req, res) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (token) {
    const sql = getSql();
    await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
  }
  res.setHeader('Set-Cookie', buildCookie('', 0));
}

module.exports = {
  createSession,
  getSessionUser,
  destroySession
};
