import { sendEventMessage } from "../discord/notifier";
import { GameEndedEvent } from "../types/events";

export async function handleGameEnded(
  event: GameEndedEvent,
  serverId: number,
  guildId: string
): Promise<void> {
  const { reason, winner } = event.data;
  const winnerPart = winner ? ` Winner: ${winner}.` : "";
  const content = `Game ended. Reason: ${reason}.${winnerPart}`;
  await sendEventMessage(event.name, content, serverId, guildId);
  console.info(`[game_ended] reason=${reason} winner=${winner ?? "n/a"} ts=${event.timestamp}`);
}

