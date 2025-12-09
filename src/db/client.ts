import mysql from "mysql2/promise";
import { ENV } from "../config/env";

let pool: mysql.Pool;

export function getDb(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: ENV.MYSQL_HOST,
      port: ENV.MYSQL_PORT,
      user: ENV.MYSQL_USER,
      password: ENV.MYSQL_PASSWORD,
      database: ENV.MYSQL_DATABASE,
      connectionLimit: 10,
    });
  }
  return pool;
}

export async function initMigrations(): Promise<void> {
  const db = getDb();

  await db.query(`
    CREATE TABLE IF NOT EXISTS guilds (
      guild_id VARCHAR(64) PRIMARY KEY,
      default_channel_id VARCHAR(64),
      api_token VARCHAR(128),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY idx_api_token (api_token)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS event_channels (
      guild_id VARCHAR(64) NOT NULL,
      event_name VARCHAR(128) NOT NULL,
      channel_id VARCHAR(64) NOT NULL,
      PRIMARY KEY (guild_id, event_name),
      CONSTRAINT fk_guilds FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    )
  `);
}
