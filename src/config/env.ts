import dotenv from "dotenv";

dotenv.config();

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const ENV = {
  PORT: Number(process.env.PORT) || 3000,
  DISCORD_APP_ID: process.env.DISCORD_APP_ID ?? "",
  DISCORD_TOKEN: process.env.DISCORD_TOKEN ?? "",
  DISCORD_PRIMARY_GUILD_ID: process.env.DISCORD_PRIMARY_GUILD_ID ?? "",
  DB_PATH: process.env.DB_PATH,
};
