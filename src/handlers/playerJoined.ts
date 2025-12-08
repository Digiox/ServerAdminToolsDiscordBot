import { sendEventMessage } from "../discord/notifier";
import { PlayerJoinedEvent } from "../types/events";

export async function handlePlayerJoined(event: PlayerJoinedEvent, guildId: string): Promise<void> {
  const { player, identity, playerId } = event.data;

  if (!isNonEmptyString(player) || !isNonEmptyString(identity) || typeof playerId !== "number") {
    throw new Error("Invalid player_joined payload");
  }

  const content = `🟢 Player joined: **${player}** (id: ${playerId}, identity: ${identity})`;
  await sendEventMessage(event.name, content, guildId);

  console.info(
    `[player_joined] player="${player}" id=${playerId} identity=${identity} ts=${event.timestamp}`
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
