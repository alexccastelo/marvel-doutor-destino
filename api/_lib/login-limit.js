const { getSql } = require('./db');

// Limite de tentativas de login que falharam, numa janela deslizante
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;
const WINDOW_MINUTES = 15;

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : null;
}

// true quando o e-mail ou o IP já atingiram o limite de falhas na janela
async function isLoginBlocked(email, ip) {
  const sql = getSql();
  const rows = await sql`
    SELECT
      count(*) FILTER (WHERE email = ${email}) AS by_email,
      count(*) FILTER (WHERE ip = ${ip}) AS by_ip
    FROM login_attempts
    WHERE created_at > now() - make_interval(mins => ${WINDOW_MINUTES})
      AND (email = ${email} OR ip = ${ip})
  `;
  return (
    Number(rows[0].by_email) >= MAX_FAILURES_PER_EMAIL ||
    (!!ip && Number(rows[0].by_ip) >= MAX_FAILURES_PER_IP)
  );
}

async function recordLoginFailure(email, ip) {
  const sql = getSql();
  await sql`INSERT INTO login_attempts (email, ip) VALUES (${email}, ${ip})`;
  // Limpeza oportunista de registros antigos
  await sql`DELETE FROM login_attempts WHERE created_at < now() - interval '1 day'`;
}

// Login certo zera as falhas daquele e-mail
async function clearLoginFailures(email) {
  const sql = getSql();
  await sql`DELETE FROM login_attempts WHERE email = ${email}`;
}

module.exports = {
  clientIp,
  isLoginBlocked,
  recordLoginFailure,
  clearLoginFailures
};
