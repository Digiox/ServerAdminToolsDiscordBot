import { sendEventMessage } from "../discord/notifier";
import { GameEndedEvent } from "../types/events";

export async function handleGameEnded(event: GameEndedEvent, guildId: string): Promise<void> {
  const { reason, winner } = event.data;

  if (!isNonEmptyString(reason)) {
    throw new Error("Invalid game_ended payload: missing reason");
  }

  const winnerPart = isNonEmptyString(winner) ? ` — winner: ${winner}` : "";
  const content = `🏁 Game ended: ${reason}${winnerPart}`;
  await sendEventMessage(event.name, content, guildId);
  console.info(`[game_ended] reason="${reason}" winner="${winner ?? ""}" ts=${event.timestamp}`);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
