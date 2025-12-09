import { Client, GatewayIntentBits, Interaction, Partials } from "discord.js";
import { ENV, requireEnv } from "../config/env";
import { handleInteraction, registerApplicationCommands } from "./commands";
import { upsertGuild, removeGuild } from "../db/channelStore";

let discordClient: Client | null = null;

export function getDiscordClient(): Client | null {
  return discordClient;
}

export async function startDiscord(): Promise<Client> {
  if (!ENV.DISCORD_TOKEN || !ENV.DISCORD_APP_ID) {
    console.warn("[discord] DISCORD_TOKEN or DISCORD_APP_ID not set; Discord client disabled.");
    throw new Error("Missing Discord env vars");
  }

  if (discordClient) {
    return discordClient;
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    partials: [Partials.GuildMember],
  });

  discordClient = client;

  client.once("ready", async () => {
    console.log(`[discord] Logged in as ${client.user?.tag}`);
    try {
      await registerApplicationCommands();
      console.log("[discord] Slash commands registered.");
    } catch (err) {
      console.error("[discord] Failed to register slash commands", err);
    }
  });

  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;
    try {
      await handleInteraction(interaction);
    } catch (err) {
      console.error("[discord] Interaction handler error", err);
      if (interaction.isRepliable() && !interaction.replied) {
        await interaction.reply({ content: "Something went wrong.", ephemeral: true });
      }
    }
  });

  client.on("guildCreate", async (guild) => {
    try {
      await upsertGuild(guild.id);
    } catch (err) {
      console.error(`[discord] Failed to upsert guild ${guild.id} on join`, err);
    }
    console.log(`[discord] Joined guild ${guild.name} (${guild.id})`);
  });

  client.on("guildDelete", async (guild) => {
    if (guild.id) {
      try {
        await removeGuild(guild.id);
      } catch (err) {
        console.error(`[discord] Failed to remove guild ${guild.id} on delete`, err);
      }
      console.log(`[discord] Removed from guild ${guild.id}`);
    }
  });

  await client.login(requireEnv("DISCORD_TOKEN"));
  return client;
}
