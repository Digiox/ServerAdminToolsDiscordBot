import { getDb } from "./client";
import { ServerEventName } from "../types/events";
import crypto from "crypto";

const db = getDb();

export interface ServerRecord {
  id: number;
  label: string;
  token: string;
}

export async function upsertGuild(guildId: string): Promise<void> {
  await db.query("INSERT IGNORE INTO guilds (guild_id) VALUES (?)", [guildId]);
}

export async function getServerByLabel(label: string): Promise<ServerRecord | null> {
  const [rows] = await db.query("SELECT id, label, token FROM servers WHERE label = ?", [label]);
  const row = (rows as any[])[0];
  return row ? { id: row.id, label: row.label, token: row.token } : null;
}

export async function getServerByToken(token: string): Promise<ServerRecord | null> {
  const [rows] = await db.query("SELECT id, label, token FROM servers WHERE token = ?", [token]);
  const row = (rows as any[])[0];
  return row ? { id: row.id, label: row.label, token: row.token } : null;
}

export async function createOrUpdateServer(label: string, token?: string): Promise<ServerRecord> {
  const existing = await getServerByLabel(label);
  if (existing) {
    if (!token) throw new Error("TOKEN_REQUIRED");
    if (token !== existing.token) throw new Error("TOKEN_INVALID");
    return existing; // never overwrite token here
  }

  const newToken = token ?? crypto.randomBytes(32).toString("hex");
  const [result] = await db.query(
    "INSERT INTO servers (label, token) VALUES (?, ?)",
    [label, newToken]
  );
  const insertId = (result as any).insertId as number;
  return { id: insertId, label, token: newToken };
}

export async function regenerateServerToken(label: string, currentToken: string): Promise<ServerRecord> {
  const server = await getServerByLabel(label);
  if (!server) {
    throw new Error("Server not found");
  }
  if (server.token !== currentToken) {
    throw new Error("TOKEN_INVALID");
  }
  const token = crypto.randomBytes(32).toString("hex");
  await db.query("UPDATE servers SET token = ? WHERE id = ?", [token, server.id]);
  return { ...server, token };
}

export async function linkServerToGuild(serverId: number, guildId: string): Promise<void> {
  await upsertGuild(guildId);
  await db.query(
    `INSERT INTO server_guilds (server_id, guild_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE guild_id = guild_id`,
    [serverId, guildId]
  );
}

export async function setServerDefaultChannel(
  serverId: number,
  guildId: string,
  channelId: string
): Promise<void> {
  await linkServerToGuild(serverId, guildId);
  await db.query(
    `UPDATE server_guilds SET default_channel_id = ? WHERE server_id = ? AND guild_id = ?`,
    [channelId, serverId, guildId]
  );
}

export async function setServerCategory(
  serverId: number,
  guildId: string,
  categoryId: string
): Promise<void> {
  await linkServerToGuild(serverId, guildId);
  await db.query(
    `UPDATE server_guilds SET category_id = ? WHERE server_id = ? AND guild_id = ?`,
    [categoryId, serverId, guildId]
  );
}

export async function getServerDefaultChannel(
  serverId: number,
  guildId: string
): Promise<string | null> {
  const [rows] = await db.query(
    `SELECT default_channel_id AS id FROM server_guilds WHERE server_id = ? AND guild_id = ?`,
    [serverId, guildId]
  );
  const row = (rows as any[])[0];
  return row?.id ?? null;
}

export async function setServerEventChannel(
  serverId: number,
  guildId: string,
  event: ServerEventName,
  channelId: string
): Promise<void> {
  await linkServerToGuild(serverId, guildId);
  await db.query(
    `INSERT INTO server_event_channels (server_id, guild_id, event_name, channel_id)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id)`,
    [serverId, guildId, event, channelId]
  );
}

export async function getServerEventChannel(
  serverId: number,
  guildId: string,
  event: ServerEventName
): Promise<string | null> {
  const [rows] = await db.query(
    `SELECT channel_id AS id FROM server_event_channels 
     WHERE server_id = ? AND guild_id = ? AND event_name = ?`,
    [serverId, guildId, event]
  );
  const row = (rows as any[])[0];
  return row?.id ?? null;
}

export async function getServerChannelForEvent(
  serverId: number,
  guildId: string,
  event: ServerEventName
): Promise<string | null> {
  return (
    (await getServerEventChannel(serverId, guildId, event)) ||
    (await getServerDefaultChannel(serverId, guildId)) ||
    null
  );
}

export async function listGuildsForServer(serverId: number): Promise<string[]> {
  const [rows] = await db.query(
    `SELECT guild_id FROM server_guilds WHERE server_id = ?`,
    [serverId]
  );
  return (rows as any[]).map((r) => r.guild_id);
}

export async function listServersForGuild(
  guildId: string
): Promise<ServerRecord[]> {
  const [rows] = await db.query(
    `SELECT s.id, s.label, s.token
     FROM servers s
     JOIN server_guilds sg ON sg.server_id = s.id
     WHERE sg.guild_id = ?`,
    [guildId]
  );
  return (rows as any[]).map((r) => ({ id: r.id, label: r.label, token: r.token }));
}

export async function getServerConfigSnapshot(
  serverId: number,
  guildId: string
): Promise<{
  defaultChannelId: string | null;
  categoryId: string | null;
  eventChannelMap: Record<string, string>;
}> {
  const defaultChannelId = await getServerDefaultChannel(serverId, guildId);
  const [rows] = await db.query(
    `SELECT event_name, channel_id FROM server_event_channels WHERE server_id = ? AND guild_id = ?`,
    [serverId, guildId]
  );
  const eventChannelMap: Record<string, string> = {};
  (rows as any[]).forEach((r) => (eventChannelMap[r.event_name] = r.channel_id));

  const [rows2] = await db.query(
    `SELECT category_id FROM server_guilds WHERE server_id = ? AND guild_id = ?`,
    [serverId, guildId]
  );
  const row2 = (rows2 as any[])[0];
  return {
    defaultChannelId,
    categoryId: row2?.category_id ?? null,
    eventChannelMap,
  };
}
