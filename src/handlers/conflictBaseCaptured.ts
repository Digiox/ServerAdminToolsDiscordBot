import { sendEventMessage } from "../discord/notifier";
import { ConflictBaseCapturedEvent } from "../types/events";

export async function handleConflictBaseCaptured(
  event: ConflictBaseCapturedEvent,
  guildId: string
): Promise<void> {
  const { faction, base } = event.data;

  if (!isNonEmptyString(faction) || !isNonEmptyString(base)) {
    throw new Error("Invalid conflict_base_captured payload");
  }

  const content = `🏳️ Base captured: ${base} by ${faction}`;
  await sendEventMessage(event.name, content, guildId);

  console.info(`[conflict_base_captured] base="${base}" faction="${faction}" ts=${event.timestamp}`);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
