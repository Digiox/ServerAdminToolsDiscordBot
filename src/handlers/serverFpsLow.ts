import { sendEventMessage } from "../discord/notifier";
import { ServerFpsLowEvent } from "../types/events";

export async function handleServerFpsLow(
  event: ServerFpsLowEvent,
  serverId: number,
  guildId: string
): Promise<void> {
  const { fps, players, ai_characters } = event.data;
  const content = `Server FPS low: **${fps.toFixed?.(1) ?? fps}** (players: ${players}, ai: ${ai_characters})`;
  await sendEventMessage(event.name, content, serverId, guildId);
  console.info(`[server_fps_low] fps=${fps} players=${players} ai=${ai_characters}`);
}

