import { sendEventMessage } from "../discord/notifier";
import { VoteEndedEvent } from "../types/events";

export async function handleVoteEnded(
  event: VoteEndedEvent,
  serverId: number,
  guildId: string
): Promise<void> {
  const { type, winner, target } = event.data;
  const result = winner === "failed" ? "failed" : `won by **${winner}**`;
  const targetPart = target ? ` on **${target}**` : "";
  const content = `Vote ended: **${type}** ${result}${targetPart}`;
  await sendEventMessage(event.name, content, serverId, guildId);
  console.info(`[vote_ended] type=${type} winner=${winner} target=${target ?? "n/a"}`);
}

