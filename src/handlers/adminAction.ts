import { sendEventMessage } from "../discord/notifier";
import { AdminActionEvent } from "../types/events";

export async function handleAdminAction(event: AdminActionEvent, guildId: string): Promise<void> {
  const { player, admin, action } = event.data;

  if (!isNonEmptyString(player) || !isNonEmptyString(admin) || !isNonEmptyString(action)) {
    throw new Error("Invalid admin_action payload");
  }

  const friendlyAction = action.replace(/_/g, " ").toLowerCase();
  const content = `🛠️ Admin ${admin}: ${friendlyAction} ${player}`;
  await sendEventMessage(event.name, content, guildId);

  console.info(
    `[admin_action] admin="${admin}" action="${action}" player="${player}" ts=${event.timestamp}`
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
