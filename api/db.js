const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// No ambiente serverless da Vercel, o único diretório gravável é /tmp.
// Em ambiente local, salva no diretório do projeto para persistência contínua.
const isVercel = process.env.VERCEL === '1' || process.env.NOW_REGION;
const dbDir = isVercel ? '/tmp' : process.cwd();
const dbPath = path.join(dbDir, 'marvel.db');

let dbInstance = null;

function getDatabase() {
  if (!dbInstance) {
    dbInstance = new Database(dbPath);
    
    // Configurações de performance e integridade para SQLite
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('synchronous = NORMAL');
    dbInstance.pragma('foreign_keys = ON');

    // Inicializa a tabela de usuários
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        whatsapp TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_watched_movies (
        user_id INTEGER NOT NULL,
        movie_id INTEGER NOT NULL,
        watched_date TEXT NOT NULL,
        watched_order INTEGER,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, movie_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_whatsapp ON users(whatsapp);
      CREATE INDEX IF NOT EXISTS idx_user_watched ON user_watched_movies(user_id);
    `);

    // Migração segura para adicionar watched_order caso a tabela já tenha sido criada sem a coluna
    try {
      dbInstance.exec(`ALTER TABLE user_watched_movies ADD COLUMN watched_order INTEGER;`);
    } catch (e) {
      // Coluna já existe
    }
  }
  return dbInstance;
}

module.exports = {
  getDatabase,
  dbPath
};
