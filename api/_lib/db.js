const { neon } = require('@neondatabase/serverless');

// Arquivos em api/_lib não viram Vercel Functions (prefixo "_").
// A conexão é criada sob demanda para não quebrar quando DATABASE_URL ainda não existe.
let sqlInstance = null;

function getSql() {
  if (!sqlInstance) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL não configurada. Rode "vercel env pull .env.local --yes".');
    }
    sqlInstance = neon(url);
  }
  return sqlInstance;
}

// Executado por scripts/migrate.js (npm run db:migrate), não a cada requisição.
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    whatsapp TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS user_watched_movies (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id SMALLINT NOT NULL CHECK (movie_id BETWEEN 1 AND 15),
    watched_date DATE NOT NULL,
    watched_order SMALLINT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, movie_id)
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`,

  // LGPD: aceite da política de privacidade e opt-in de comunicações
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_opt_in_at TIMESTAMPTZ`,
  // Tentativas de login que falharam, para o limite por e-mail e por IP
  `CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT NOT NULL,
    ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip, created_at)`
];

module.exports = {
  getSql,
  SCHEMA_STATEMENTS
};
