import { sendEventMessage } from "../discord/notifier";
import { GameStartedEvent } from "../types/events";

export async function handleGameStarted(event: GameStartedEvent, guildId: string): Promise<void> {
  const content = "🚀 Game started";
  await sendEventMessage(event.name, content, guildId);
  console.info(`[game_started] ts=${event.timestamp}`);
}
