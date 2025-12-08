import { sendEventMessage } from "../discord/notifier";
import { VoteStartedEvent } from "../types/events";

export async function handleVoteStarted(event: VoteStartedEvent, guildId: string): Promise<void> {
  const { type, initiator, target } = event.data;

  if (!isNonEmptyString(type) || !isNonEmptyString(initiator) || !isNonEmptyString(target)) {
    throw new Error("Invalid vote_started payload");
  }

  const targetPart = target !== "none" ? ` on ${target}` : "";
  const content = `🗳️ Vote started by ${initiator}: ${type}${targetPart}`;
  await sendEventMessage(event.name, content, guildId);

  console.info(
    `[vote_started] initiator="${initiator}" type="${type}" target="${target}" ts=${event.timestamp}`
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
