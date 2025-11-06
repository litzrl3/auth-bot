const Database = require('better-sqlite3');
const db = new Database('authbot.db');

db.pragma('journal_mode = WAL');

// Tabela de Configurações por Servidor
db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    guild_id TEXT PRIMARY KEY,
    verified_role_id TEXT,
    log_webhook_url TEXT
  )
`);

// Configuração Global (qual é o servidor principal)
db.exec(`
  CREATE TABLE IF NOT EXISTS global_config (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

// Tabela de Usuários Verificados
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    access_token TEXT,
    refresh_token TEXT,
    auth_date INTEGER
  )
`);

// Tabela de "Gift Cards"
db.exec(`
  CREATE TABLE IF NOT EXISTS gifts (
    code TEXT PRIMARY KEY,
    member_count INTEGER,
    is_used INTEGER DEFAULT 0,
    created_by TEXT
  )
`);

// NOVA Tabela: Configuração da Embed de Autenticação
db.exec(`
  CREATE TABLE IF NOT EXISTS embed_config (
    guild_id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    color TEXT,
    image_url TEXT,
    thumbnail_url TEXT,
    button_text TEXT
  )
`);

const dbWrapper = {
  // Config
  setConfig: (guildId, roleId, webhookUrl) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO config (guild_id, verified_role_id, log_webhook_url) VALUES (?, ?, ?)');
    stmt.run(guildId, roleId, webhookUrl);
  },
  getConfig: (guildId) => {
    return db.prepare('SELECT * FROM config WHERE guild_id = ?').get(guildId);
  },
  setMainGuild: (guildId) => {
    db.prepare('INSERT OR REPLACE INTO global_config (key, value) VALUES (?, ?)').run('main_guild_id', guildId);
  },
  getMainGuild: () => {
    return db.prepare('SELECT value FROM global_config WHERE key = ?').get('main_guild_id');
  },

    // Users
  addUser: (userId, username, accessToken, refreshToken) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO users (user_id, username, access_token, refresh_token, auth_date) VALUES (?, ?, ?, ?, ?)');
    stmt.run(userId, username, accessToken, refreshToken, Math.floor(Date.now() / 1000));
  },
  getUser: (userId) => {
    return db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  },
  getAllUsers: () => {
    return db.prepare('SELECT * FROM users').all();
  },
  // NOVA FUNÇÃO: Pega N usuários aleatórios
  getRandomUsers: (limit) => {
    return db.prepare('SELECT * FROM users ORDER BY RANDOM() LIMIT ?').all(limit);
  },
  getUserCount: () => {
    return db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  },

  // Gifts (MUDADO)
  createGift: (code, memberCount, createdBy) => {
    const stmt = db.prepare('INSERT INTO gifts (code, member_count, created_by) VALUES (?, ?, ?)');
    stmt.run(code, memberCount, createdBy);
  },
  getGift: (code) => {
    return db.prepare('SELECT * FROM gifts WHERE code = ?').get(code);
  },
  // MUDADO: Marca o gift como usado
  // Retorna true se a atualização foi bem-sucedida
  useGift: (code) => {
    const stmt = db.prepare('UPDATE gifts SET is_used = 1 WHERE code = ? AND is_used = 0');
    const result = stmt.run(code);
    return result.changes > 0;
  },
  getGiftCount: () => {
    return db.prepare('SELECT COUNT(*) as count FROM gifts').get().count;
  },

  // Embed Config
  getEmbedConfig: (guildId) => {
    return db.prepare('SELECT * FROM embed_config WHERE guild_id = ?').get(guildId);
  },
  setEmbedConfigField: (guildId, field, value) => {
    // Garante que a linha exista
    db.prepare('INSERT OR IGNORE INTO embed_config (guild_id) VALUES (?)').run(guildId);
    // Atualiza o campo específico
    const stmt = db.prepare(`UPDATE embed_config SET ${field} = ? WHERE guild_id = ?`);
    stmt.run(value, guildId);
  },
  resetEmbedConfig: (guildId) => {
     db.prepare('DELETE FROM embed_config WHERE guild_id = ?').run(guildId);
  }
};

module.exports = dbWrapper;
