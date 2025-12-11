import mysql from "mysql2/promise";
import { ENV } from "../config/env";

let pool: mysql.Pool;

export function getDb(): mysql.Pool {
  if (!pool) {
    pool = ENV.MYSQL_URL
      ? mysql.createPool({
          uri: ENV.MYSQL_URL,
          connectionLimit: 10,
        })
      : mysql.createPool({
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

  await db.query(`
    CREATE TABLE IF NOT EXISTS servers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      label VARCHAR(64) NOT NULL UNIQUE,
      token VARCHAR(128) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS server_guilds (
      server_id INT NOT NULL,
      guild_id VARCHAR(64) NOT NULL,
      default_channel_id VARCHAR(64),
      category_id VARCHAR(64),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (server_id, guild_id),
      CONSTRAINT fk_sg_server FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
      CONSTRAINT fk_sg_guild FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS server_event_channels (
      server_id INT NOT NULL,
      guild_id VARCHAR(64) NOT NULL,
      event_name VARCHAR(128) NOT NULL,
      channel_id VARCHAR(64) NOT NULL,
      PRIMARY KEY (server_id, guild_id, event_name),
      CONSTRAINT fk_sec_server FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
      CONSTRAINT fk_sec_sg FOREIGN KEY (server_id, guild_id) REFERENCES server_guilds(server_id, guild_id) ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS guild_authorized_roles (
      guild_id VARCHAR(64) NOT NULL,
      role_id VARCHAR(64) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id, role_id),
      CONSTRAINT fk_auth_roles_guild FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    )
  `);
}
