import { getDb } from "./client";
import { ServerEventName } from "../types/events";

const db = getDb();

export function upsertGuild(guildId: string): void {
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO guilds (guild_id) VALUES (@guildId)"
  );
  stmt.run({ guildId });
}

export function removeGuild(guildId: string): void {
  db.prepare("DELETE FROM guilds WHERE guild_id=@guildId").run({ guildId });
}

export function setDefaultChannel(guildId: string, channelId: string): void {
  upsertGuild(guildId);
  const stmt = db.prepare(
    "UPDATE guilds SET default_channel_id=@channelId WHERE guild_id=@guildId"
  );
  stmt.run({ guildId, channelId });
}

export function getDefaultChannel(guildId: string): string | null {
  const row = db
    .prepare("SELECT default_channel_id AS id FROM guilds WHERE guild_id=@guildId")
    .get({ guildId }) as { id?: string } | undefined;
  return row?.id ?? null;
}

export function setEventChannel(
  guildId: string,
  event: ServerEventName,
  channelId: string
): void {
  upsertGuild(guildId);
  db.prepare(
    `INSERT INTO event_channels (guild_id, event_name, channel_id)
     VALUES (@guildId, @event, @channelId)
     ON CONFLICT(guild_id, event_name) DO UPDATE SET channel_id=excluded.channel_id`
  ).run({ guildId, event, channelId });
}

export function getEventChannel(
  guildId: string,
  event: ServerEventName
): string | null {
  const row = db
    .prepare(
      "SELECT channel_id AS id FROM event_channels WHERE guild_id=@guildId AND event_name=@event"
    )
    .get({ guildId, event }) as { id?: string } | undefined;
  return row?.id ?? null;
}

export function getConfigSnapshot(guildId: string): {
  defaultChannelId: string | null;
  eventChannelMap: Record<string, string>;
} {
  const defaultChannelId = getDefaultChannel(guildId);
  const rows = db
    .prepare(
      "SELECT event_name, channel_id FROM event_channels WHERE guild_id=@guildId"
    )
    .all({ guildId }) as { event_name: string; channel_id: string }[];
  const eventChannelMap: Record<string, string> = {};
  rows.forEach((r) => (eventChannelMap[r.event_name] = r.channel_id));
  return { defaultChannelId, eventChannelMap };
}

export function listGuildIds(): string[] {
  const rows = db.prepare("SELECT guild_id FROM guilds").all() as { guild_id: string }[];
  return rows.map((r) => r.guild_id);
}

export function setApiToken(guildId: string, token: string): void {
  upsertGuild(guildId);
  db.prepare("UPDATE guilds SET api_token=@token WHERE guild_id=@guildId").run({ guildId, token });
}

export function getApiToken(guildId: string): string | null {
  const row = db
    .prepare("SELECT api_token AS token FROM guilds WHERE guild_id=@guildId")
    .get({ guildId }) as { token?: string } | undefined;
  return row?.token ?? null;
}

export function findGuildIdByToken(token: string): string | null {
  const row = db
    .prepare("SELECT guild_id FROM guilds WHERE api_token=@token")
    .get({ token }) as { guild_id?: string } | undefined;
  return row?.guild_id ?? null;
}
