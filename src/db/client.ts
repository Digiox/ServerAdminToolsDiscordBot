import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { ENV } from "../config/env";

const DB_PATH = ENV.DB_PATH || path.join(process.cwd(), "data", "bot.sqlite");

// Ensure directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initMigrations(): void {
  const createGuilds = `
    CREATE TABLE IF NOT EXISTS guilds (
      guild_id TEXT PRIMARY KEY,
      default_channel_id TEXT,
      api_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createEventChannels = `
    CREATE TABLE IF NOT EXISTS event_channels (
      guild_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      PRIMARY KEY (guild_id, event_name),
      FOREIGN KEY (guild_id) REFERENCES guilds (guild_id) ON DELETE CASCADE
    );
  `;

  db.exec(createGuilds);
  db.exec(createEventChannels);

  // Add api_token column if missing
  const hasApiToken = db
    .prepare("PRAGMA table_info(guilds)")
    .all()
    .some((col: any) => col.name === "api_token");
  if (!hasApiToken) {
    db.exec("ALTER TABLE guilds ADD COLUMN api_token TEXT");
  }

  // Ensure token uniqueness
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_guilds_api_token ON guilds(api_token)"
  );
}

export function getDb(): Database.Database {
  return db;
}
