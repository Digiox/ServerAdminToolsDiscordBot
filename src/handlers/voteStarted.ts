import { sendEventMessage } from "../discord/notifier";
import { VoteStartedEvent } from "../types/events";

export async function handleVoteStarted(
  event: VoteStartedEvent,
  serverId: number,
  guildId: string
): Promise<void> {
  const { type, initiator, target } = event.data;
  const targetPart = target ? ` on **${target}**` : "";
  const content = `Vote started: **${type}** by **${initiator}**${targetPart}`;
  await sendEventMessage(event.name, content, serverId, guildId);
  console.info(`[vote_started] type=${type} initiator=${initiator} target=${target ?? "n/a"}`);
}

