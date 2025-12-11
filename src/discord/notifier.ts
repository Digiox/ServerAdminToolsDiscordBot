import { Channel, DMChannel, NewsChannel, TextChannel, ThreadChannel } from "discord.js";
import { getServerChannelForEvent } from "../db/serverStore";
import { getDiscordClient } from "./client";

type SendableChannel = TextChannel | NewsChannel | ThreadChannel | DMChannel;

export async function sendEventMessage(
  eventName: string,
  content: string,
  serverId: number,
  guildId: string
): Promise<void> {
  const client = getDiscordClient();
  if (!client) {
    throw new Error("Discord client not ready");
  }

  const channelId = await getServerChannelForEvent(serverId, guildId, eventName as any);
  if (!channelId) {
    console.warn(
      `[notify] No channel mapped for event ${eventName} in guild ${guildId} (server ${serverId})`
    );
    return;
  }

  const channel = (await client.channels.fetch(channelId)) as Channel | null;
  const sendable = toSendable(channel);
  if (!sendable) {
    console.warn(`[notify] Channel ${channelId} not text-based or not found`);
    return;
  }

  if (sendable.isTextBased() && "permissionsFor" in sendable && client.user) {
    const perms = sendable.permissionsFor(client.user.id);
    const missing = perms?.missing(["ViewChannel", "SendMessages"]);
    if (missing && missing.length) {
      throw new Error(
        `Missing permissions in channel ${channelId}: ${missing.join(", ")}`
      );
    }
  }

  await sendable.send({ content });
}

function toSendable(channel: Channel | null): SendableChannel | null {
  if (!channel) return null;
  if (channel.isTextBased() && "send" in channel) {
    return channel as SendableChannel;
  }
  return null;
}
