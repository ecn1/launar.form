const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { baseEmbed, COLORS, error, success, info, FOOTER_TEXT } = require('../../utils/embeds');
const store = require('../../utils/ticketStore');

const PANELS_PER_ROW = 5;
const ROWS_MAX = 5;

// ── panel message builder ────────────────────────────────────────────────────

function buildPanelMessage(guild, config) {
  const lines = config.panels.map(
    (p) => `${p.emoji} **${p.name}**${p.description ? ` — ${p.description}` : ''}`
  );

  const embed = baseEmbed(COLORS.brand)
    .setTitle('🎫 Support Tickets')
    .setThumbnail(guild.iconURL({ size: 256 }))
    .setDescription(
      [
        'Need help? Open a private ticket with the staff team.',
        '',
        '**Available panels:**',
        ...lines,
        '',
        '_Click a button below — you will be asked for a short reason, and a private channel will be created for you._',
      ].join('\n')
    )
    .addFields(
      { name: '🔒 Privacy', value: 'Only you, the staff team and server administrators can see your ticket.', inline: false },
      { name: 'ℹ️ Rules', value: 'One open ticket per member • Be respectful • Ticket-bans are issued for abuse', inline: false }
    )
    .setFooter({ text: FOOTER_TEXT });

  const rows = [];
  for (let i = 0; i < config.panels.length; i += PANELS_PER_ROW) {
    const row = new ActionRowBuilder();
    for (const panel of config.panels.slice(i, i + PANELS_PER_ROW)) {
      const button = new ButtonBuilder()
        .setCustomId(`ticket:open:${panel.id}`)
        .setLabel(panel.name.slice(0, 80))
        .setStyle(ButtonStyle.Primary);
      try {
        button.setEmoji(panel.emoji);
      } catch {
        // invalid emoji string — the label alone is fine
      }
      row.addComponents(button);
    }
    rows.push(row);
  }

  return { embeds: [embed], components: rows };
}

// ── subcommand dispatch ──────────────────────────────────────────────────────

async function runSubcommand(interaction) {
  const sub = interaction.options.getSubcommand();
  const group = interaction.options.getSubcommandGroup(false);
  const guildId = interaction.guild.id;
  const config = store.getConfig(guildId);

  // ── panel group ──
  if (group === 'panel') {
    if (sub === 'add') {
      const name = interaction.options.getString('name', true).trim();
      const emoji = interaction.options.getString('emoji')?.trim();
      const description = interaction.options.getString('description')?.trim();

      if (name.length < 2) return interaction.reply({ embeds: [error('Panel names need at least **2 characters**.')], flags: MessageFlags.Ephemeral });

      const panel = store.addPanel(guildId, { name, emoji, description });
      if (!panel) {
        return interaction.reply({
          embeds: [error(`The panel limit is **${store.MAX_PANELS}** (Discord allows 5 rows × 5 buttons). Remove one with \`/tickets panel remove\` first.`)],
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        embeds: [
          success(
            [
              `Panel **${panel.name}** added (${config.panels.length + 1} panel(s) total).`,
              `Emoji: ${panel.emoji}${panel.description ? ` • Description: _${panel.description}_` : ''}`,
              '',
              '_Use `/tickets panel post` to (re)post the panel selector with the new buttons._',
            ].join('\n'),
            '🎫 Panel added'
          ),
        ],
      });
    }

    if (sub === 'remove') {
      const removed = store.removePanel(guildId, interaction.options.getString('name', true));
      if (!removed) return interaction.reply({ embeds: [error('No panel with that **name** exists. Check `/tickets status`.')], flags: MessageFlags.Ephemeral });
      return interaction.reply({
        embeds: [success(`Panel **${removed.name}** removed. Repost the selector to update its buttons.`, '🎫 Panel removed')],
      });
    }

    if (sub === 'post') {
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      const fresh = store.getConfig(guildId);

      if (fresh.panels.length === 0) {
        return interaction.reply({ embeds: [error('Add at least one panel first: `/tickets panel add`.')], flags: MessageFlags.Ephemeral });
      }

      const perms = channel.permissionsFor(interaction.guild.members.me);
      if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
        return interaction.reply({ embeds: [error(`I need **View Channel**, **Send Messages** and **Embed Links** in ${channel}.`)], flags: MessageFlags.Ephemeral });
      }

      await channel.send(buildPanelMessage(channel.guild, fresh));
      return interaction.reply({
        embeds: [success(`Panel selector posted in ${channel} with **${fresh.panels.length}** button(s).`, '📣 Panels posted')],
      });
    }
  }

  // ── enable / disable ──
  if (sub === 'enable') {
    store.updateConfig(guildId, { enabled: true });
    return interaction.reply({ embeds: [success('The ticket system is now **enabled** — panel buttons will open tickets.', '🟢 Tickets enabled')] });
  }

  if (sub === 'disable') {
    store.updateConfig(guildId, { enabled: false });
    return interaction.reply({
      embeds: [info(`The ticket system is now **disabled** — panel buttons will politely refuse. Open tickets are unaffected.\n\n_Re-enable with \`/tickets enable\`._`, '🔴 Tickets disabled')],
    });
  }

  // ── status ──
  if (sub === 'status') {
    const embed = baseEmbed(COLORS.brand)
      .setTitle('🎫 Ticket system — status')
      .setDescription(
        [
          `**State:** ${config.enabled ? '🟢 Enabled' : '🔴 Disabled'}`,
          `**Category:** ${config.categoryId ? `<#${config.categoryId}>` : '_not set — channels land at server top_'}`,
          `**Log channel:** ${config.logChannelId ? `<#${config.logChannelId}>` : '_not set_'}`,
          `**Support roles:** ${config.supportRoleIds.length ? config.supportRoleIds.map((r) => `<@&${r}>`).join(' ') : '_none set_'}`,
          `**Open tickets:** **${config.open.length}**`,
          `**Ticket-banned members:** **${config.blacklist.length}**`,
          '',
          '**Panels** (' + config.panels.length + '):',
          config.panels.length
            ? config.panels.map((p) => `${p.emoji} ${p.name}`).join('\n') || '_none_'
            : '_none — add with `/tickets panel add`_',
          '',
          '_Post or refresh the selector with `/tickets panel post`._',
        ].join('\n')
      );
    return interaction.reply({ embeds: [embed] });
  }

  // ── category / logs ──
  if (sub === 'category') {
    const category = interaction.options.getChannel('category', true);
    if (category.type !== ChannelType.GuildCategory) {
      return interaction.reply({ embeds: [error('Pick a **category** (the grey channel groups), not a text channel.')], flags: MessageFlags.Ephemeral });
    }
    store.updateConfig(guildId, { categoryId: category.id });
    return interaction.reply({ embeds: [success(`New tickets will be created inside **${category.name}**.`, '🗂️ Category set')] });
  }

  if (sub === 'logs') {
    const channel = interaction.options.getChannel('channel', true);
    const perms = channel.permissionsFor(interaction.guild.members.me);
    if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
      return interaction.reply({ embeds: [error(`I need **View Channel**, **Send Messages** and **Embed Links** in ${channel}.`)], flags: MessageFlags.Ephemeral });
    }
    store.updateConfig(guildId, { logChannelId: channel.id });
    return interaction.reply({ embeds: [success(`Closed tickets will be logged in ${channel}.`, '🧾 Log channel set')] });
  }

  // ── support roles ──
  if (sub === 'support-add') {
    const role = interaction.options.getRole('role', true);
    if (role.id === interaction.guild.id) return interaction.reply({ embeds: [error('@everyone cannot be a support role.')], flags: MessageFlags.Ephemeral });
    store.addSupportRole(guildId, role.id);
    return interaction.reply({ embeds: [success(`${role} can now see and manage tickets.`, '🛡️ Support role added')] });
  }

  if (sub === 'support-remove') {
    store.removeSupportRole(guildId, interaction.options.getRole('role', true).id);
    return interaction.reply({ embeds: [success('That role no longer has ticket access.', '🛡️ Support role removed')] });
  }

  // ── blacklist ──
  if (sub === 'ban') {
    const user = interaction.options.getUser('user', true);
    store.blacklistAdd(guildId, user.id);
    return interaction.reply({ embeds: [success(`⛔ ${user} can no longer create tickets.`)], flags: MessageFlags.Ephemeral });
  }

  if (sub === 'unban') {
    const user = interaction.options.getUser('user', true);
    store.blacklistRemove(guildId, user.id);
    return interaction.reply({ embeds: [success(`${user} can create tickets again.`)], flags: MessageFlags.Ephemeral });
  }

  if (sub === 'blacklist') {
    if (config.blacklist.length === 0) {
      return interaction.reply({ embeds: [info('No members are ticket-banned.', '⛔ Ticket blacklist')] });
    }
    return interaction.reply({
      embeds: [
        baseEmbed(COLORS.danger)
          .setTitle('⛔ Ticket-banned members')
          .setDescription(config.blacklist.map((id) => `<@${id}> (\`${id}\`)`).join('\n')),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }

  return interaction.reply({ embeds: [error('Unknown subcommand.')], flags: MessageFlags.Ephemeral });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('🎫 Set up and manage the ticket system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommandGroup((g) =>
      g
        .setName('panel')
        .setDescription('Manage ticket panels (the buttons members click)')
        .addSubcommand((s) =>
          s
            .setName('add')
            .setDescription('Add a panel button')
            .addStringOption((o) => o.setName('name').setDescription('Panel name, e.g. Support / Report / Appeal').setRequired(true).setMaxLength(60))
            .addStringOption((o) => o.setName('emoji').setDescription('Panel emoji, e.g. 🛠️ (default 🎫)').setMaxLength(16))
            .addStringOption((o) => o.setName('description').setDescription('Short description shown on the panel embed').setMaxLength(150))
        )
        .addSubcommand((s) =>
          s
            .setName('remove')
            .setDescription('Remove a panel button')
            .addStringOption((o) => o.setName('name').setDescription('Panel to remove').setRequired(true).setAutocomplete(true))
        )
        .addSubcommand((s) =>
          s
            .setName('post')
            .setDescription('Post (or refresh) the panel selector embed with buttons')
            .addChannelOption((o) => o.setName('channel').setDescription('Channel to post in (default: here)').addChannelTypes(ChannelType.GuildText))
        )
    )
    .addSubcommand((s) => s.setName('enable').setDescription('🟢 Enable the ticket system'))
    .addSubcommand((s) => s.setName('disable').setDescription('🔴 Disable the ticket system (open tickets unaffected)'))
    .addSubcommand((s) => s.setName('status').setDescription('📋 Show the ticket system configuration'))
    .addSubcommand((s) =>
      s
        .setName('category')
        .setDescription('🗂️ Choose the category where ticket channels are created')
        .addChannelOption((o) => o.setName('category').setDescription('Ticket category').setRequired(true).addChannelTypes(ChannelType.GuildCategory))
    )
    .addSubcommand((s) =>
      s
        .setName('logs')
        .setDescription('🧾 Choose the channel where closed tickets are logged')
        .addChannelOption((o) => o.setName('channel').setDescription('Log channel').setRequired(true).addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand((s) =>
      s
        .setName('support-add')
        .setDescription('🛡️ Give a role access to all tickets')
        .addRoleOption((o) => o.setName('role').setDescription('Support role').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('support-remove')
        .setDescription('🛡️ Remove a role\'s ticket access')
        .addRoleOption((o) => o.setName('role').setDescription('Support role').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('ban')
        .setDescription('⛔ Ban a member from creating tickets')
        .addUserOption((o) => o.setName('user').setDescription('Member to ticket-ban').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('unban')
        .setDescription('✅ Allow a member to create tickets again')
        .addUserOption((o) => o.setName('user').setDescription('Member to unban').setRequired(true))
    )
    .addSubcommand((s) => s.setName('blacklist').setDescription('⛔ List ticket-banned members')),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused[0]?.name !== 'name') return interaction.respond([]);

    const isRemove = interaction.options.getSubcommandGroup(false) === 'panel' && interaction.options.getSubcommand() === 'remove';
    if (!isRemove) return interaction.respond([]);

    const query = String(focused[0].value).toLowerCase();
    const choices = store
      .getConfig(interaction.guild.id)
      .panels.filter((p) => p.name.toLowerCase().includes(query))
      .slice(0, 25)
      .map((p) => ({ name: `${p.emoji} ${p.name}`.slice(0, 100), value: p.name }));

    await interaction.respond(choices);
  },

  async execute(interaction) {
    await runSubcommand(interaction);
  },
};
