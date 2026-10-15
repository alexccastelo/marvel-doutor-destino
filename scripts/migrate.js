// Cria/atualiza o esquema no Postgres (Neon). Uso: npm run db:migrate
try {
  process.loadEnvFile('.env.local');
} catch {
  // Sem .env.local: usa as variáveis já presentes no ambiente
}

const { getSql, SCHEMA_STATEMENTS } = require('../api/_lib/db');

(async () => {
  const sql = getSql();
  for (const statement of SCHEMA_STATEMENTS) {
    await sql.query(statement);
  }
  console.log(`Esquema aplicado (${SCHEMA_STATEMENTS.length} comandos).`);
})().catch(err => {
  console.error('Falha ao aplicar o esquema:', err.message);
  process.exit(1);
});
