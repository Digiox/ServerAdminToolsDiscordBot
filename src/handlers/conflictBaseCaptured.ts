import { sendEventMessage } from "../discord/notifier";
import { ConflictBaseCapturedEvent } from "../types/events";

export async function handleConflictBaseCaptured(
  event: ConflictBaseCapturedEvent,
  serverId: number,
  guildId: string
): Promise<void> {
  const { faction, base } = event.data;
  const content = `Base **${base}** captured by **${faction}**`;
  await sendEventMessage(event.name, content, serverId, guildId);
  console.info(`[conflict_base_captured] faction=${faction} base=${base}`);
}

