import { sendEventMessage } from "../discord/notifier";
import { PlayerKilledEvent } from "../types/events";

export async function handlePlayerKilled(event: PlayerKilledEvent, guildId: string): Promise<void> {
  const { player, instigator, friendly } = event.data;

  const friendlyBool = coerceBool(friendly);

  if (!isNonEmptyString(player) || !isNonEmptyString(instigator) || friendlyBool === null) {
    throw new Error("Invalid player_killed payload");
  }

  const ffTag = friendlyBool ? " (friendly fire)" : "";
  const content = `💀 ${player} was killed by ${instigator}${ffTag}`;
  await sendEventMessage(event.name, content, guildId);

  console.info(
    `[player_killed] player="${player}" instigator="${instigator}" friendly=${friendlyBool} ts=${event.timestamp}`
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function coerceBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return null;
}
