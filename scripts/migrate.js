// Cria/atualiza o esquema no Postgres (Neon).
//   npm run db:migrate       -> branch de desenvolvimento (.env.development.local), se existir
//   npm run db:migrate:prod  -> banco de produção (.env.local, vindo do "vercel env pull")
// loadEnvFile não sobrescreve variáveis já definidas: o primeiro arquivo carregado vence.
const isProd = process.argv.includes('--prod');
const envFiles = isProd ? ['.env.local'] : ['.env.development.local', '.env.local'];
for (const file of envFiles) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Arquivo ausente: segue para o próximo / variáveis do ambiente
  }
}
console.log(`Alvo: ${isProd ? 'PRODUÇÃO' : 'desenvolvimento'} (${new URL(process.env.DATABASE_URL).host})`);

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
