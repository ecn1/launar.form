const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { baseEmbed, COLORS, FOOTER_TEXT } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('🌙 See everything launar.form can do')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const embed = baseEmbed(COLORS.brand)
      .setTitle('🌙 launar.form — Command Guide')
      .setThumbnail(interaction.client.user.displayAvatarURL({ size: 256 }))
      .setDescription(
        'Create **Google Forms** and share them as aesthetic embed cards with an **Open Form** button. ' +
          'Every card shows a title, description and optional banner image — or falls back to tasteful defaults.'
      )
      .addFields(
        {
          name: '📝 Forms',
          value: [
            '`/createform` — create a real Google Form (title, description, questions, image, target channel) and post it',
            '`/shareform` — post a form link you already have (no Google setup needed)',
            '`/formlist` — list every tracked form in this server',
            '`/delform` — remove a form: deletes the post, the registry entry and the Google Form itself',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🎫 Ticket system',
          value: [
            '`/tickets panel add` / `remove` / `post` — build the panel selector (unlimited panels in practice, up to 25 buttons)',
            '`/tickets enable` / `disable` — turn the whole system on or off',
            '`/tickets category` / `logs` — where ticket channels are created and where closed tickets are logged',
            '`/tickets support-add` / `support-remove` — roles that can see and manage tickets',
            '`/tickets ban` / `unban` / `blacklist` — members forbidden from creating tickets',
            '`/tickets status` — full configuration overview',
          ].join('\n'),
          inline: false,
        },
        {
          name: '✨ Good to know',
          value:
            '• `/createform` needs the **Google OAuth setup** — one-time, in the README (§2).\n' +
            '• `/shareform`, `/formlist` and `/help` work with zero Google setup.\n' +
            '• Members click a panel button, write a reason, and get a **private channel** with staff + admins.\n' +
            '• Every ticket has Close, Close & Ticket-Ban, and Claim buttons; closed tickets are logged.',
          inline: false,
        }
      )
      .setFooter({ text: FOOTER_TEXT });

    await interaction.reply({ embeds: [embed] });
  },
};
