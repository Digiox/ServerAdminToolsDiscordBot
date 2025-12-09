import { getDb } from "./client";
import { ServerEventName } from "../types/events";

const db = getDb();

export async function upsertGuild(guildId: string): Promise<void> {
  await db.query("INSERT IGNORE INTO guilds (guild_id) VALUES (?)", [guildId]);
}

export async function removeGuild(guildId: string): Promise<void> {
  await db.query("DELETE FROM guilds WHERE guild_id = ?", [guildId]);
}

export async function setDefaultChannel(guildId: string, channelId: string): Promise<void> {
  await upsertGuild(guildId);
  await db.query("UPDATE guilds SET default_channel_id = ? WHERE guild_id = ?", [channelId, guildId]);
}

export async function getDefaultChannel(guildId: string): Promise<string | null> {
  const [rows] = await db.query("SELECT default_channel_id AS id FROM guilds WHERE guild_id = ?", [
    guildId,
  ]);
  const row = (rows as any[])[0];
  return row?.id ?? null;
}

export async function setEventChannel(
  guildId: string,
  event: ServerEventName,
  channelId: string
): Promise<void> {
  await upsertGuild(guildId);
  await db.query(
    `INSERT INTO event_channels (guild_id, event_name, channel_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id)`,
    [guildId, event, channelId]
  );
}

export async function getEventChannel(
  guildId: string,
  event: ServerEventName
): Promise<string | null> {
  const [rows] = await db.query(
    "SELECT channel_id AS id FROM event_channels WHERE guild_id = ? AND event_name = ?",
    [guildId, event]
  );
  const row = (rows as any[])[0];
  return row?.id ?? null;
}

export async function getConfigSnapshot(guildId: string): Promise<{
  defaultChannelId: string | null;
  eventChannelMap: Record<string, string>;
}> {
  const defaultChannelId = await getDefaultChannel(guildId);
  const [rows] = await db.query(
    "SELECT event_name, channel_id FROM event_channels WHERE guild_id = ?",
    [guildId]
  );
  const eventChannelMap: Record<string, string> = {};
  (rows as any[]).forEach((r) => (eventChannelMap[r.event_name] = r.channel_id));
  return { defaultChannelId, eventChannelMap };
}

export async function listGuildIds(): Promise<string[]> {
  const [rows] = await db.query("SELECT guild_id FROM guilds");
  return (rows as any[]).map((r) => r.guild_id);
}

export async function setApiToken(guildId: string, token: string): Promise<void> {
  await upsertGuild(guildId);
  await db.query("UPDATE guilds SET api_token = ? WHERE guild_id = ?", [token, guildId]);
}

export async function getApiToken(guildId: string): Promise<string | null> {
  const [rows] = await db.query("SELECT api_token AS token FROM guilds WHERE guild_id = ?", [
    guildId,
  ]);
  const row = (rows as any[])[0];
  return row?.token ?? null;
}

export async function findGuildIdByToken(token: string): Promise<string | null> {
  const [rows] = await db.query("SELECT guild_id FROM guilds WHERE api_token = ?", [token]);
  const row = (rows as any[])[0];
  return row?.guild_id ?? null;
}
