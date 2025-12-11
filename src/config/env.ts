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
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET ?? "",
  DISCORD_PRIMARY_GUILD_ID: process.env.DISCORD_PRIMARY_GUILD_ID ?? "",
  SESSION_SECRET: process.env.SESSION_SECRET ?? "",
  OAUTH_CALLBACK_URL: process.env.OAUTH_CALLBACK_URL ?? "",
  MYSQL_URL: process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL || "",
  MYSQL_HOST: process.env.MYSQLHOST || process.env.MYSQL_HOST || "localhost",
  MYSQL_PORT: Number(process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306),
  MYSQL_USER: process.env.MYSQLUSER || process.env.MYSQL_USER || "root",
  MYSQL_PASSWORD: process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || "",
  MYSQL_DATABASE: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || "sat_bot",
};
