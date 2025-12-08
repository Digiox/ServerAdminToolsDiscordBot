import { sendEventMessage } from "../discord/notifier";
import { VoteEndedEvent } from "../types/events";

export async function handleVoteEnded(event: VoteEndedEvent, guildId: string): Promise<void> {
  const { type, winner, target } = event.data;

  if (!isNonEmptyString(type) || !isNonEmptyString(winner) || !isNonEmptyString(target)) {
    throw new Error("Invalid vote_ended payload");
  }

  const success = winner !== "failed";
  const result = success ? `passed, winner: ${winner}` : "failed";
  const targetPart = target !== "none" ? ` on ${target}` : "";
  const content = `✅ Vote ended: ${type}${targetPart} ${result}`;
  await sendEventMessage(event.name, content, guildId);

  console.info(
    `[vote_ended] type="${type}" winner="${winner}" target="${target}" ts=${event.timestamp}`
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
