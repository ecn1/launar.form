// Ticket system interaction handlers: panel buttons → reason modal → ticket
// channel, plus claim / close / close-and-ban buttons on the ticket embed.

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const store = require('../utils/ticketStore');
const { COLORS, FOOTER_TEXT, error } = require('../utils/embeds');

const CHANNEL_DELETE_DELAY_MS = 10_000;

// ── helpers ──────────────────────────────────────────────────────────────────

function ephemeral(embed) {
  return { embeds: [embed], flags: MessageFlags.Ephemeral };
}

function baseTicketEmbed(color = COLORS.brand) {
  return new EmbedBuilder().setColor(color).setTimestamp().setFooter({ text: FOOTER_TEXT });
}

function isSupport(guild, member, config) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (member.id === guild.ownerId) return true;
  return member.roles.cache.some((r) => config.supportRoleIds.includes(r.id));
}

function buildTicketEmbed({ number, member, panel, reason, claimedBy = null, closed = null }) {
  const embed = baseTicketEmbed(closed ? COLORS.neutral : COLORS.brand)
    .setAuthor({ name: `🎫 Ticket #${number}`, iconURL: member.displayAvatarURL({ size: 128 }) })
    .setThumbnail(member.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: '👤 Created by', value: `${member.user}`, inline: true },
      { name: '🗂️ Panel', value: `${panel.emoji} ${panel.name}`, inline: true },
      { name: '🙋 Claimed by', value: claimedBy ? `${claimedBy}` : '_Not claimed yet — staff will be with you shortly._', inline: false },
      { name: '📝 Reason / concern', value: (reason || '_Not provided._').slice(0, 1024), inline: false }
    );

  if (closed) {
    embed.addFields(
      { name: '🔒 Closed by', value: `${closed.by}`, inline: true },
      { name: '💬 Close reason', value: closed.reason || '_No reason provided._', inline: false }
    );
  }

  return embed;
}

function ticketActionRows({ closed = false } = {}) {
  const close = new ButtonBuilder().setCustomId('ticket:close').setLabel('Close Ticket').setEmoji('🗑️').setStyle(ButtonStyle.Danger);
  const claim = new ButtonBuilder().setCustomId('ticket:claim').setLabel('Claim').setEmoji('🙋').setStyle(ButtonStyle.Success);
  const closeBan = new ButtonBuilder().setCustomId('ticket:closeban').setLabel('Close & Ticket-Ban').setEmoji('⛔').setStyle(ButtonStyle.Danger);

  if (closed) {
    close.setDisabled(true);
    claim.setDisabled(true);
    closeBan.setDisabled(true);
  }

  return [new ActionRowBuilder().addComponents(close, claim, closeBan)];
}

function sanitizeChannelName(input) {
  const cleaned = String(input)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
  return cleaned || 'ticket';
}

async function sendLogEmbed(guild, config, embed) {
  if (!config.logChannelId) return;
  const channel = guild.channels.cache.get(config.logChannelId);
  await channel?.send({ embeds: [embed] }).catch(() => null);
}

// ── panel button → reason modal ──────────────────────────────────────────────

async function handlePanelButton(interaction) {
  const panelId = interaction.customId.split(':')[2];
  const config = store.getConfig(interaction.guild.id);
  const panel = store.getPanel(interaction.guild.id, panelId);

  if (!panel) {
    return interaction.reply(ephemeral(error('This panel no longer exists — the staff member who set it up removed it.', '🎫 Panel unavailable')));
  }
  if (!config.enabled) {
    return interaction.reply(ephemeral(error('The ticket system is **currently disabled**. Please try again later.', '🎫 Tickets paused')));
  }
  if (store.blacklistHas(interaction.guild.id, interaction.user.id)) {
    return interaction.reply(ephemeral(error('You are **banned from creating tickets** in this server. Contact a staff member if you believe this is a mistake.', '⛔ Ticket-banned')));
  }
  const existing = store.getOpenByUser(interaction.guild.id, interaction.user.id);
  if (existing) {
    return interaction.reply(ephemeral(error(`You already have an open ticket: <#${existing.channelId}>`, '🎫 One ticket at a time')));
  }

  const modal = new ModalBuilder()
    .setCustomId(`ticket:reason:${panel.id}`)
    .setTitle(`🎫 ${panel.name}`.slice(0, 45));

  const reason = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Why are you opening this ticket?')
    .setPlaceholder('Describe your issue, question or concern in detail…')
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(4)
    .setMaxLength(1000)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(reason));
  await interaction.showModal(modal);
}

// ── reason modal → ticket channel ────────────────────────────────────────────

async function handleReasonModal(interaction) {
  const panelId = interaction.customId.split(':')[2];
  const config = store.getConfig(interaction.guild.id);
  const panel = store.getPanel(interaction.guild.id, panelId);
  const reason = interaction.fields.getTextInputValue('reason').trim();

  if (!panel || !config.enabled) {
    return interaction.reply(ephemeral(error('The ticket system is **currently disabled** — your ticket was not created.', '🎫 Tickets paused')));
  }
  if (store.blacklistHas(interaction.guild.id, interaction.user.id)) {
    return interaction.reply(ephemeral(error('You are **banned from creating tickets** in this server.', '⛔ Ticket-banned')));
  }
  if (store.getOpenByUser(interaction.guild.id, interaction.user.id)) {
    return interaction.reply(ephemeral(error('You already have an open ticket.', '🎫 One ticket at a time')));
  }

  const me = interaction.guild.members.me;
  // If the configured category was deleted, create the channel without a parent.
  const parentId = config.categoryId && interaction.guild.channels.cache.has(config.categoryId) ? config.categoryId : null;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const number = store.nextTicketNumber(interaction.guild.id);
  const channelName = sanitizeChannelName(`${panel.name}-${interaction.member.displayName}`);

  let channel;
  try {
    channel = await interaction.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      ...(parentId ? { parent: parentId } : {}),
      topic: `Ticket #${number} • ${interaction.user.tag} • Panel: ${panel.name}`,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
          ],
        },
        ...config.supportRoleIds.map((roleId) => ({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
          ],
        })),
        {
          id: me.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages,
          ],
        },
      ],
      reason: `ticket by ${interaction.user.tag}`,
    });
  } catch {
    return interaction.editReply({
      embeds: [
        baseTicketEmbed(COLORS.danger)
          .setTitle('❌ Could not create ticket')
          .setDescription(
            'I could not create the ticket channel. Make sure I have **Manage Channels** permission' +
              (parentId ? ' and access to the ticket category' : '') +
              ', then try again.'
          ),
      ],
    });
  }

  const embed = buildTicketEmbed({ number, member: interaction.member, panel, reason });
  const message = await channel.send({
    content: `${interaction.user} ${config.supportRoleIds.map((r) => `<@&${r}>`).join(' ')}`.trim(),
    embeds: [embed],
    components: ticketActionRows(),
  });

  store.addOpen(interaction.guild.id, {
    channelId: channel.id,
    userId: interaction.user.id,
    panelId: panel.id,
    embedMessageId: message.id,
    number,
    reason,
    createdAt: Date.now(),
  });

  await interaction.editReply({
    embeds: [
      baseTicketEmbed(COLORS.success)
        .setTitle('🎫 Ticket created')
        .setDescription(
          `Your ticket is ready: ${channel}\n\n` +
            'A staff member will be with you shortly — feel free to add screenshots and extra details there.'
        ),
    ],
  });
}

// ── claim ────────────────────────────────────────────────────────────────────

async function handleClaim(interaction) {
  const config = store.getConfig(interaction.guild.id);
  const ticket = store.getOpenByChannel(interaction.guild.id, interaction.channel.id);

  if (!ticket) return interaction.reply(ephemeral(error('This channel is not a tracked ticket.')));
  if (!isSupport(interaction.guild, interaction.member, config)) {
    return interaction.reply(ephemeral(error('Only **staff** can claim tickets.', '🙋 Staff only')));
  }

  store.updateOpen(interaction.guild.id, interaction.channel.id, { claimedBy: interaction.user.id });

  const panel = store.getPanel(interaction.guild.id, ticket.panelId) ?? { name: 'Unknown', emoji: '🎫' };
  const creator = await interaction.guild.members.fetch(ticket.userId).catch(() => null);

  const embed = buildTicketEmbed({
    number: ticket.number,
    member: creator ?? interaction.member,
    panel,
    reason: ticket.reason,
    claimedBy: interaction.user,
  });

  await interaction.message.edit({ embeds: [embed] });
  await interaction.reply({
    embeds: [baseTicketEmbed(COLORS.success).setDescription(`🙋 ${interaction.user} claimed this ticket and will handle it from here.`)],
  });
}

// ── close & close-and-ban ────────────────────────────────────────────────────

function showCloseModal(interaction, mode) {
  const modal = new ModalBuilder()
    .setCustomId(`ticket:closemodal:${mode}`)
    .setTitle(mode === 'closeban' ? '⛔ Close & Ban' : '🗑️ Close Ticket');

  const reason = new TextInputBuilder()
    .setCustomId('closereason')
    .setLabel('Close reason (optional)')
    .setPlaceholder('e.g. issue resolved')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(500)
    .setRequired(false);

  modal.addComponents(new ActionRowBuilder().addComponents(reason));
  return interaction.showModal(modal);
}

async function handleCloseModal(interaction) {
  const mode = interaction.customId.split(':')[2]; // 'close' | 'closeban'
  const config = store.getConfig(interaction.guild.id);
  const ticket = store.getOpenByChannel(interaction.guild.id, interaction.channel.id);

  if (!ticket) return interaction.reply(ephemeral(error('This channel is not a tracked ticket.')));

  const isCreator = interaction.user.id === ticket.userId;
  if (!isCreator && !isSupport(interaction.guild, interaction.member, config)) {
    return interaction.reply(ephemeral(error('Only the ticket creator or **staff** can close tickets.', '🔒 Not allowed')));
  }
  if (mode === 'closeban' && !isSupport(interaction.guild, interaction.member, config)) {
    return interaction.reply(ephemeral(error('Only **staff** can ticket-ban members.', '⛔ Staff only')));
  }

  await interaction.deferReply();

  const closeReason = interaction.fields.getTextInputValue('closereason').trim();
  const creator = await interaction.guild.members.fetch(ticket.userId).catch(() => null);
  const panel = store.getPanel(interaction.guild.id, ticket.panelId) ?? { name: 'Unknown', emoji: '🎫' };

  if (mode === 'closeban') store.blacklistAdd(interaction.guild.id, ticket.userId);

  const embed = buildTicketEmbed({
    number: ticket.number,
    member: creator ?? interaction.member,
    panel,
    reason: ticket.reason,
    claimedBy: ticket.claimedBy ? `<@${ticket.claimedBy}>` : null,
    closed: { by: interaction.user, reason: closeReason },
  });
  embed.setTitle(`🔒 Ticket #${ticket.number} — closed`);

  await interaction.message.edit({ embeds: [embed], components: ticketActionRows({ closed: true }) });

  await interaction.channel.setName(`closed-${interaction.channel.name}`.slice(0, 100)).catch(() => null);
  await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false }).catch(() => null);

  const durationMs = Date.now() - ticket.createdAt;
  const hours = Math.floor(durationMs / 3600000);
  const minutes = Math.floor((durationMs % 3600000) / 60000);

  const logEmbed = baseTicketEmbed(COLORS.neutral)
    .setTitle(`🔒 Ticket #${ticket.number} closed`)
    .addFields(
      { name: '👤 Creator', value: creator ? `${creator} (${creator.user.tag})` : `<@${ticket.userId}>`, inline: true },
      { name: '🗂️ Panel', value: `${panel.emoji} ${panel.name}`, inline: true },
      { name: '⏱️ Opened', value: `<t:${Math.floor(ticket.createdAt / 1000)}:R> • ${hours}h ${minutes}m`, inline: true },
      { name: '📝 Reason / concern', value: (ticket.reason ?? '_unavailable_').slice(0, 1024), inline: false },
      { name: '🔒 Closed by', value: `${interaction.user}`, inline: true },
      { name: '💬 Close reason', value: closeReason || '_No reason provided._', inline: false },
      ...(mode === 'closeban'
        ? [{ name: '⛔ Ticket-ban', value: `<@${ticket.userId}> can no longer create tickets here.`, inline: false }]
        : [])
    );

  await sendLogEmbed(interaction.guild, config, logEmbed);
  store.removeOpen(interaction.guild.id, interaction.channel.id);

  await interaction.editReply({
    embeds: [
      baseTicketEmbed(COLORS.success).setDescription(
        [
          `Ticket closed by ${interaction.user}.${closeReason ? ` Reason: **${closeReason}**` : ''}`,
          mode === 'closeban' ? `⛔ <@${ticket.userId}> has been **banned from creating tickets**.` : '',
          '_A copy of this ticket was sent to the staff log. This channel will be deleted in 10 seconds…_',
        ]
          .filter(Boolean)
          .join('\n')
      ),
    ],
  });

  setTimeout(() => interaction.channel?.delete(`ticket #${ticket.number} closed`).catch(() => null), CHANNEL_DELETE_DELAY_MS);
}

// ── router ───────────────────────────────────────────────────────────────────

async function handleComponent(interaction) {
  const [, action] = interaction.customId.split(':');

  switch (action) {
    case 'open':
      return handlePanelButton(interaction);
    case 'reason':
      return handleReasonModal(interaction);
    case 'claim':
      return handleClaim(interaction);
    case 'close':
      return showCloseModal(interaction, 'close');
    case 'closeban':
      return showCloseModal(interaction, 'closeban');
    case 'closemodal':
      return handleCloseModal(interaction);
    default:
      console.warn(`[launar.form] unknown ticket component: ${interaction.customId}`);
      return null;
  }
}

module.exports = { handleComponent, buildTicketEmbed, ticketActionRows };
