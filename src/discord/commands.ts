import {
  ChannelType,
  ChatInputCommandInteraction,
  GuildMember,
  PermissionsBitField,
  PermissionResolvable,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import { ENV, requireEnv } from "../config/env";
import { SERVER_EVENT_NAMES, ServerEventName } from "../types/events";
import { setDefaultChannel, setEventChannel, setApiToken } from "../db/channelStore";
import { TextChannel, NewsChannel, ThreadChannel } from "discord.js";
import crypto from "crypto";

const setDefaultChannelCommand = new SlashCommandBuilder()
  .setName("set_default_channel")
  .setDescription("Choose the channel used by default for bot messages")
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("Text channel to use by default")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild);

const setEventChannelCommand = new SlashCommandBuilder()
  .setName("set_event_channel")
  .setDescription("Map a specific event to a channel")
  .addStringOption((option) => {
    option.setName("event").setDescription("Event name").setRequired(true);
    SERVER_EVENT_NAMES.forEach((name) => option.addChoices({ name, value: name }));
    return option;
  })
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("Text channel for this event")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild);

const setupEventChannelsCommand = new SlashCommandBuilder()
  .setName("setup_event_channels")
  .setDescription("Create a category and one text channel per event, and link them")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels);

const generateApiTokenCommand = new SlashCommandBuilder()
  .setName("generate_api_token")
  .setDescription("Generate a new API token for webhooks (guild owner only)")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

const cleanupChannelsCommand = new SlashCommandBuilder()
  .setName("cleanup_channels")
  .setDescription("Delete all text channels whose name starts with a prefix")
  .addStringOption((option) =>
    option.setName("prefix").setDescription("Prefix (e.g. sat)").setRequired(true)
  )
  .addBooleanOption((option) =>
    option
      .setName("dryrun")
      .setDescription("Only list matches without deleting (default false)")
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels);

export const commandData = [
  setDefaultChannelCommand,
  setEventChannelCommand,
  setupEventChannelsCommand,
  generateApiTokenCommand,
  cleanupChannelsCommand,
];

export async function registerApplicationCommands(): Promise<void> {
  const token = requireEnv("DISCORD_TOKEN");
  const appId = requireEnv("DISCORD_APP_ID");

  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationCommands(appId), {
    body: commandData.map((cmd) => cmd.toJSON()),
  });
  // Note: logs are in index.ts
}

export async function handleInteraction(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  switch (interaction.commandName) {
    case "set_default_channel":
      await handleSetDefaultChannel(interaction);
      break;
    case "set_event_channel":
      await handleSetEventChannel(interaction);
      break;
    case "setup_event_channels":
      await handleSetupEventChannels(interaction);
      break;
    case "generate_api_token":
      await handleGenerateApiToken(interaction);
      break;
    case "cleanup_channels":
      await handleCleanupChannels(interaction);
      break;
    default:
      await interaction.reply({ content: "Unknown command", ephemeral: true });
  }
}

async function handleSetDefaultChannel(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const channel = interaction.options.getChannel("channel", true);
  const guildId = interaction.guildId!;
  const me = interaction.guild?.members.me;
  if (!me) {
    await interaction.reply({ content: "Bot member not found in this guild.", ephemeral: true });
    return;
  }

  const missing = getChannelSendMissing(channel, me);
  if (missing.length) {
    await interaction.reply({
      content: `I need ${missing.join(", ")} in <#${channel.id}> to use it.`,
      ephemeral: true,
    });
    return;
  }

  if (channel.type !== ChannelType.GuildText) {
    await interaction.reply({ content: "Please choose a text channel.", ephemeral: true });
    return;
  }

  setDefaultChannel(guildId, channel.id);
  await interaction.reply({
    content: `Default channel set to <#${channel.id}>`,
    ephemeral: true,
  });
}

async function handleSetEventChannel(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const channel = interaction.options.getChannel("channel", true);
  const event = interaction.options.getString("event", true) as ServerEventName;
  const guildId = interaction.guildId!;
  const me = interaction.guild?.members.me;
  if (!me) {
    await interaction.reply({ content: "Bot member not found in this guild.", ephemeral: true });
    return;
  }

  if (channel.type !== ChannelType.GuildText) {
    await interaction.reply({ content: "Please choose a text channel.", ephemeral: true });
    return;
  }

  if (!SERVER_EVENT_NAMES.includes(event)) {
    await interaction.reply({ content: "Unknown event.", ephemeral: true });
    return;
  }

  const missing = getChannelSendMissing(channel, me);
  if (missing.length) {
    await interaction.reply({
      content: `I need ${missing.join(", ")} in <#${channel.id}> to use it.`,
      ephemeral: true,
    });
    return;
  }

  setEventChannel(guildId, event, channel.id);
  await interaction.reply({
    content: `Channel for **${event}** set to <#${channel.id}>`,
    ephemeral: true,
  });
}

async function handleSetupEventChannels(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "Use this in a server.", ephemeral: true });
    return;
  }

  const me = interaction.guild.members.me;
  if (!me) {
    await interaction.reply({ content: "Bot member not found in this guild.", ephemeral: true });
    return;
  }

  const missing = getMissingPerms(me, [PermissionsBitField.Flags.ManageChannels]);
  if (missing.length) {
    await interaction.reply({
      content: `I need these permissions to run this command: ${missing.join(", ")}`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  try {
    const category = await guild.channels.create({
      name: "server-admin-tools",
      type: ChannelType.GuildCategory,
      reason: "Setup event channels for Server Admin Tools bot",
    });

    const created: string[] = [];
    for (const event of SERVER_EVENT_NAMES) {
      const channelName = `sat-${event.replace("serveradmintools_", "").replace(/_/g, "-")}`;
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        reason: `Channel for ${event}`,
      });
      setEventChannel(guild.id, event, channel.id);
      created.push(`<#${channel.id}> ↔ ${event}`);
    }

    // set default to first created channel
    const first = created.length ? created[0] : null;
    if (first) {
      const firstId = /\<\#(\d+)\>/.exec(first)?.[1];
      if (firstId) setDefaultChannel(guild.id, firstId);
    }

    const summary = created.join("\n");
    await interaction.editReply({
      content: `Created category **${category.name}** and mapped channels:\n${summary}`,
    });
  } catch (error) {
    console.error("[discord] setup_event_channels failed", error);
    await interaction.editReply({
      content: "Failed to create channels. Do I have Manage Channels permission?",
    });
  }
}

function getMissingPerms(
  member: GuildMember,
  required: PermissionResolvable[]
): string[] {
  const missing = member.permissions.missing(required);
  return missing.map((m) => m.toString());
}

function getChannelSendMissing(channel: any, member: GuildMember): string[] {
  if (!channel?.permissionsFor) return ["VIEW_CHANNEL", "SEND_MESSAGES"];
  const perms = channel.permissionsFor(member);
  if (!perms) return ["VIEW_CHANNEL", "SEND_MESSAGES"];
  return perms.missing([
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
  ]);
}

async function handleGenerateApiToken(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "Use this in a server.", ephemeral: true });
    return;
  }

  const isOwner = interaction.guild.ownerId === interaction.user.id;
  if (!isOwner) {
    await interaction.reply({
      content: "Only the guild owner can generate the API token.",
      ephemeral: true,
    });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  setApiToken(interaction.guild.id, token);

  await interaction.reply({
    content: `New API token (store it safely):\n\`${token}\`\nThis replaces any previous token.`,
    ephemeral: true,
  });
}

async function handleCleanupChannels(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "Use this in a server.", ephemeral: true });
    return;
  }

  const prefix = interaction.options.getString("prefix", true).toLowerCase();
  const dryrun = interaction.options.getBoolean("dryrun") ?? false;

  const me = interaction.guild.members.me;
  if (!me) {
    await interaction.reply({ content: "Bot member not found in this guild.", ephemeral: true });
    return;
  }

  const missing = getMissingPerms(me, [PermissionsBitField.Flags.ManageChannels]);
  if (missing.length) {
    await interaction.reply({
      content: `I need Manage Channels to delete channels. Missing: ${missing.join(", ")}`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const channels = await interaction.guild.channels.fetch();
  const matches: Array<TextChannel | NewsChannel | ThreadChannel> = [];
  const cannotAccess: string[] = [];
  const failed: string[] = [];

  channels.forEach((ch) => {
    if (!ch) return;
    if (!ch.isTextBased()) return;
    if ("name" in ch && typeof ch.name === "string") {
      if (ch.name.toLowerCase().startsWith(prefix)) {
        const perms = ch.permissionsFor(me);
        const missingCh = perms?.missing([PermissionsBitField.Flags.ManageChannels]) ?? [];
        if (missingCh.length) {
          cannotAccess.push(`#${ch.name} (missing: ${missingCh.join(",")})`);
          return;
        }
        matches.push(ch as TextChannel | NewsChannel | ThreadChannel);
      }
    }
  });

  if (!matches.length && !cannotAccess.length) {
    await interaction.editReply({ content: `No channels found with prefix "${prefix}".` });
    return;
  }

  if (dryrun) {
    const list = matches.map((c) => `#${c.name}`).join(", ");
    await interaction.editReply({
      content: `Dry run: found ${matches.length} channel(s): ${list}${
        cannotAccess.length ? `\nCannot access (${cannotAccess.length}): ${cannotAccess.join(", ")}` : ""
      }`,
    });
    return;
  }

  for (const ch of matches) {
    try {
      await ch.delete(`cleanup_channels prefix=${prefix} by ${interaction.user.tag}`);
    } catch (err) {
      console.error("[cleanup_channels] Failed to delete", ch.id, err);
      const channelId = (ch as any).id ?? "unknown";
      const channelName = (ch as any).name ?? channelId;
      failed.push(`#${channelName}`);
    }
  }

  await interaction.editReply({
    content: `Deleted ${matches.length - failed.length} channel(s) with prefix "${prefix}".${
      cannotAccess.length ? `\nSkipped (no access) ${cannotAccess.length}: ${cannotAccess.join(", ")}` : ""
    }${failed.length ? `\nFailed ${failed.length}: ${failed.join(", ")}` : ""}`,
  });
}
