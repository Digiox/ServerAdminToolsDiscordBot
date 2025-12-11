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
import {
  createOrUpdateServer,
  getServerByLabel,
  linkServerToGuild,
  regenerateServerToken,
  setServerCategory,
  setServerDefaultChannel,
  setServerEventChannel,
  isGuildLinkedToServer,
  listGuildsForServer,
} from "../db/serverStore";
import { addAuthorizedRole, removeAuthorizedRole, listAuthorizedRoles } from "../db/authzStore";
import { TextChannel, NewsChannel, ThreadChannel } from "discord.js";

const registerServerCommand = new SlashCommandBuilder()
  .setName("register_server")
  .setDescription("Register or link a server label to this guild (token optional)")
  .addStringOption((option) =>
    option.setName("label").setDescription("Unique label for this server").setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("token")
      .setDescription("Existing token (leave empty to generate)")
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild);

const setDefaultChannelCommand = new SlashCommandBuilder()
  .setName("set_default_channel")
  .setDescription("Set default channel for a server label in this guild")
  .addStringOption((option) =>
    option.setName("label").setDescription("Server label").setRequired(true)
  )
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
  .setDescription("Map a specific event to a channel for a server label")
  .addStringOption((option) =>
    option.setName("label").setDescription("Server label").setRequired(true)
  )
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
  .setDescription("Create a category and one text channel per event for a server label, and link them")
  .addStringOption((option) =>
    option.setName("label").setDescription("Server label").setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels);

const regenerateServerTokenCommand = new SlashCommandBuilder()
  .setName("regen_server_token")
  .setDescription("Regenerate API token for a server label (guild owner only)")
  .addStringOption((option) =>
    option.setName("label").setDescription("Server label").setRequired(true)
  )
  .addStringOption((option) =>
    option.setName("token").setDescription("Current token (required)").setRequired(true)
  )
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

const authorizeRoleCommand = new SlashCommandBuilder()
  .setName("authorize_role")
  .setDescription("Allow a role to manage Server Admin Tools (guild owner only)")
  .addRoleOption((option) => option.setName("role").setDescription("Role to authorize").setRequired(true))
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

const unauthorizeRoleCommand = new SlashCommandBuilder()
  .setName("unauthorize_role")
  .setDescription("Remove a role from the authorized list (guild owner only)")
  .addRoleOption((option) => option.setName("role").setDescription("Role to remove").setRequired(true))
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

export const commandData = [
  registerServerCommand,
  setDefaultChannelCommand,
  setEventChannelCommand,
  setupEventChannelsCommand,
  regenerateServerTokenCommand,
  authorizeRoleCommand,
  unauthorizeRoleCommand,
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
    case "register_server":
      await handleRegisterServer(interaction);
      break;
    case "set_default_channel":
      await handleSetDefaultChannel(interaction);
      break;
    case "set_event_channel":
      await handleSetEventChannel(interaction);
      break;
    case "setup_event_channels":
      await handleSetupEventChannels(interaction);
      break;
    case "regen_server_token":
      await handleRegenerateServerToken(interaction);
      break;
    case "authorize_role":
      await handleAuthorizeRole(interaction);
      break;
    case "unauthorize_role":
      await handleUnauthorizeRole(interaction);
      break;
    case "cleanup_channels":
      await handleCleanupChannels(interaction);
      break;
    default:
      await interaction.reply({ content: "Unknown command", ephemeral: true });
  }
}

async function handleRegisterServer(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "Use this in a server.", ephemeral: true });
    return;
  }

  const label = interaction.options.getString("label", true);
  const providedToken = interaction.options.getString("token") ?? undefined;
  const authorized = await isAuthorized(interaction);

  try {
    const server = await createOrUpdateServer(label, providedToken, { force: authorized });
    await linkServerToGuild(server.id, interaction.guild.id);
    await interaction.reply({
      content:
        !providedToken && server.token
          ? `Server **${label}** created and linked to this guild.\nToken: \`${server.token}\``
          : `Server **${label}** linked to this guild.`,
      ephemeral: true,
    });
  } catch (err) {
    if ((err as Error).message === "TOKEN_REQUIRED") {
      await interaction.reply({
        content: `Server label "${label}" already exists. Please provide its current token to link it.`,
        ephemeral: true,
      });
      return;
    }
    if ((err as Error).message === "TOKEN_INVALID") {
      await interaction.reply({
        content: `Invalid token for server label "${label}".`,
        ephemeral: true,
      });
      return;
    }
    console.error("[discord] Failed to register server", err);
    await interaction.reply({
      content: "Failed to register the server. Is the label unique?",
      ephemeral: true,
    });
  }
}

async function handleSetDefaultChannel(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const label = interaction.options.getString("label", true);
  const channel = interaction.options.getChannel("channel", true);
  const guildId = interaction.guildId!;
  const authorized = await isAuthorized(interaction);
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

  try {
    const server = await getServerByLabel(label);
    if (!server) {
      await interaction.reply({
        content: `Server label "${label}" not registered. Use /register_server first.`,
        ephemeral: true,
      });
      return;
    }
    const linked = await isGuildLinkedToServer(server.id, guildId);
    if (!linked) {
      if (!authorized) {
        await interaction.reply({
          content: `This guild is not linked to server **${label}**. Use /register_server with its token, or have an authorized role/owner run it.`,
          ephemeral: true,
        });
        return;
      }
      await linkServerToGuild(server.id, guildId);
    }

    await setServerDefaultChannel(server.id, guildId, channel.id);
    await interaction.reply({
      content: `Default channel for **${label}** set to <#${channel.id}>`,
      ephemeral: true,
    });
  } catch (err) {
    console.error("[discord] Failed to set default channel", err);
    await interaction.reply({
      content: "Failed to save the default channel. Please try again.",
      ephemeral: true,
    });
  }
}

async function handleSetEventChannel(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const label = interaction.options.getString("label", true);
  const channel = interaction.options.getChannel("channel", true);
  const event = interaction.options.getString("event", true) as ServerEventName;
  const guildId = interaction.guildId!;
  const authorized = await isAuthorized(interaction);
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

  try {
    const server = await getServerByLabel(label);
    if (!server) {
      await interaction.reply({
        content: `Server label "${label}" not registered. Use /register_server first.`,
        ephemeral: true,
      });
      return;
    }
    const linked = await isGuildLinkedToServer(server.id, guildId);
    if (!linked) {
      if (!authorized) {
        await interaction.reply({
          content: `This guild is not linked to server **${label}**. Use /register_server with its token, or have an authorized role/owner run it.`,
          ephemeral: true,
        });
        return;
      }
      await linkServerToGuild(server.id, guildId);
    }

    await setServerEventChannel(server.id, guildId, event, channel.id);
    await interaction.reply({
      content: `Channel for **${event}** (server ${label}) set to <#${channel.id}>`,
      ephemeral: true,
    });
  } catch (err) {
    console.error(`[discord] Failed to set channel for event ${event}`, err);
    await interaction.reply({
      content: "Failed to save the event channel. Please try again.",
      ephemeral: true,
    });
  }
}

async function handleSetupEventChannels(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const label = interaction.options.getString("label", true);
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
    const server = await getServerByLabel(label);
    if (!server) {
      await interaction.editReply({
        content: `Server label "${label}" not registered. Use /register_server first.`,
      });
      return;
    }
    const authorized = await isAuthorized(interaction);
    const linked = await isGuildLinkedToServer(server.id, guild.id);
    if (!linked) {
      if (!authorized) {
        await interaction.editReply({
          content: `This guild is not linked to server **${label}**. Use /register_server with its token, or have an authorized role/owner run it.`,
        });
        return;
      }
      await linkServerToGuild(server.id, guild.id);
    }

    const category = await guild.channels.create({
      name: `sat-${label}`,
      type: ChannelType.GuildCategory,
      reason: `Setup event channels for Server Admin Tools bot (${label})`,
    });

    await setServerCategory(server.id, guild.id, category.id);

    const created: string[] = [];
    const failedToPersist: string[] = [];
    for (const event of SERVER_EVENT_NAMES) {
      const short = event.replace("serveradmintools_", "").replace(/_/g, "-");
      const channelName = `sat-${label}-${short}`.toLowerCase();
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        reason: `Channel for ${event}`,
      });
      try {
        await setServerEventChannel(server.id, guild.id, event, channel.id);
        created.push(`<#${channel.id}> - ${event}`);
      } catch (err) {
        console.error(`[discord] Failed to persist channel mapping for ${event}`, err);
        failedToPersist.push(event);
      }
    }

    // set default to first created channel
    const firstId = /\<\#(\d+)\>/.exec(created[0] ?? "")?.[1];
    if (firstId) {
      try {
        await setServerDefaultChannel(server.id, guild.id, firstId);
      } catch (err) {
        console.error("[discord] Failed to set default channel during setup", err);
      }
    }

    const details = [
      `Created category **${category.name}** for server **${label}** and mapped channels:`,
    ];
    if (created.length) {
      details.push(created.join("\n"));
    }
    if (failedToPersist.length) {
      details.push(`Failed to save mappings for: ${failedToPersist.join(", ")}`);
    }
    await interaction.editReply({ content: details.join("\n") });
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

async function isAuthorized(interaction: ChatInputCommandInteraction): Promise<boolean> {
  const guildId = interaction.guildId;
  if (!guildId) return false;
  const isOwner = interaction.guild?.ownerId === interaction.user.id;
  if (isOwner) return true;
  const roles = await listAuthorizedRoles(guildId);
  if (!roles.length) return false;
  const member = interaction.member as GuildMember | null;
  const memberRoleIds = member ? Array.from(member.roles.cache.keys()) : [];
  return memberRoleIds.some((r) => roles.includes(r));
}

async function handleRegenerateServerToken(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "Use this in a server.", ephemeral: true });
    return;
  }

  const isOwner = interaction.guild.ownerId === interaction.user.id;
  if (!isOwner) {
    await interaction.reply({
      content: "Only the guild owner can regenerate the API token.",
      ephemeral: true,
    });
    return;
  }

  const label = interaction.options.getString("label", true);
  const currentToken = interaction.options.getString("token", true);
  const authorized = await isAuthorized(interaction);

  try {
    const server = await getServerByLabel(label);
    if (!server) {
      await interaction.reply({
        content: `Server label "${label}" not registered.`,
        ephemeral: true,
      });
      return;
    }
    const linked = await isGuildLinkedToServer(server.id, interaction.guild.id);
    if (!linked && !authorized) {
      await interaction.reply({
        content: `This guild is not linked to server **${label}**. Only an authorized role/owner in a linked guild or someone with the current token can rotate it.`,
        ephemeral: true,
      });
      return;
    }

    const updated = await regenerateServerToken(label, currentToken, authorized);
    await interaction.reply({
      content: `New API token for **${label}** (store it safely):\n\`${updated.token}\`\nThis replaces any previous token.`,
      ephemeral: true,
    });
  } catch (err) {
    if ((err as Error).message === "TOKEN_INVALID") {
      await interaction.reply({
        content: "Current token invalid. Cannot regenerate.",
        ephemeral: true,
      });
      return;
    }
    console.error("[discord] Failed to set API token", err);
    await interaction.reply({
      content: "Failed to generate and store the API token. Please try again.",
      ephemeral: true,
    });
  }
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

async function handleAuthorizeRole(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "Use this in a server.", ephemeral: true });
    return;
  }
  const isOwner = interaction.guild.ownerId === interaction.user.id;
  if (!isOwner) {
    await interaction.reply({ content: "Only the guild owner can authorize roles.", ephemeral: true });
    return;
  }
  const role = interaction.options.getRole("role", true);
  try {
    await addAuthorizedRole(interaction.guild.id, role.id);
    await interaction.reply({
      content: `Role <@&${role.id}> authorized for Server Admin Tools commands.`,
      ephemeral: true,
    });
  } catch (err) {
    console.error("[discord] authorize_role failed", err);
    await interaction.reply({ content: "Failed to authorize role.", ephemeral: true });
  }
}

async function handleUnauthorizeRole(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "Use this in a server.", ephemeral: true });
    return;
  }
  const isOwner = interaction.guild.ownerId === interaction.user.id;
  if (!isOwner) {
    await interaction.reply({ content: "Only the guild owner can remove roles.", ephemeral: true });
    return;
  }
  const role = interaction.options.getRole("role", true);
  try {
    await removeAuthorizedRole(interaction.guild.id, role.id);
    await interaction.reply({
      content: `Role <@&${role.id}> removed from authorization list.`,
      ephemeral: true,
    });
  } catch (err) {
    console.error("[discord] unauthorize_role failed", err);
    await interaction.reply({ content: "Failed to unauthorize role.", ephemeral: true });
  }
}
