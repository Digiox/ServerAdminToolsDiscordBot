import { sendEventMessage } from "../discord/notifier";
import { ServerFpsLowEvent } from "../types/events";

export async function handleServerFpsLow(event: ServerFpsLowEvent, guildId: string): Promise<void> {
  const { fps, players, ai_characters } = event.data;

  if (typeof fps !== "number" || typeof players !== "number" || typeof ai_characters !== "number") {
    throw new Error("Invalid server_fps_low payload");
  }

  const content = `⚠️ Server FPS low: ${fps.toFixed(1)} | players: ${players} | AI: ${ai_characters}`;
  await sendEventMessage(event.name, content, guildId);

  console.info(
    `[server_fps_low] fps=${fps} players=${players} ai=${ai_characters} ts=${event.timestamp}`
  );
}
