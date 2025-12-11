import { sendEventMessage } from "../discord/notifier";
import { AdminActionEvent } from "../types/events";

export async function handleAdminAction(
  event: AdminActionEvent,
  serverId: number,
  guildId: string
): Promise<void> {
  const { player, admin, action } = event.data;
  const content = `Admin action: **${admin}** ${action} **${player}**`;
  await sendEventMessage(event.name, content, serverId, guildId);
  console.info(`[admin_action] admin=${admin} action=${action} player=${player}`);
}

