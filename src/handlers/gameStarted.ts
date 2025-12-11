import { sendEventMessage } from "../discord/notifier";
import { GameStartedEvent } from "../types/events";

export async function handleGameStarted(
  event: GameStartedEvent,
  serverId: number,
  guildId: string
): Promise<void> {
  const content = "Game started.";
  await sendEventMessage(event.name, content, serverId, guildId);
  console.info(`[game_started] ts=${event.timestamp}`);
}

