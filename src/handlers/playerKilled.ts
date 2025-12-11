import { sendEventMessage } from "../discord/notifier";
import { PlayerKilledEvent } from "../types/events";

export async function handlePlayerKilled(
  event: PlayerKilledEvent,
  serverId: number,
  guildId: string
): Promise<void> {
  const { player, instigator, friendly } = event.data;
  if (!isNonEmptyString(player) || !isNonEmptyString(instigator) || typeof friendly !== "boolean") {
    throw new Error("Invalid player_killed payload");
  }

  const ff = friendly ? " (friendly fire)" : "";
  const content = `Player **${player}** killed by **${instigator}**${ff}`;
  await sendEventMessage(event.name, content, serverId, guildId);

  console.info(
    `[player_killed] player="${player}" instigator=${instigator} friendly=${friendly} ts=${event.timestamp}`
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

