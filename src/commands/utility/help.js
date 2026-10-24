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
            '`/createform` — create a real Google Form (title, description, image, target channel) and post it',
            '`/shareform` — post a form link you already have (no Google setup needed)',
            '`/formlist` — list every tracked form in this server',
            '`/delform` — remove a form: deletes the post, the registry entry and the Google Form itself',
          ].join('\n'),
          inline: false,
        },
        {
          name: '✨ Good to know',
          value:
            '• `/createform` needs a **Google service account** — one-time setup in the README (enable Forms API + Drive API).\n' +
            '• `/shareform`, `/formlist` and `/help` work with zero Google setup.\n' +
            '• Form cards are posted by admins (**Manage Server**) into any channel the bot can write in.',
          inline: false,
        }
      )
      .setFooter({ text: FOOTER_TEXT });

    await interaction.reply({ embeds: [embed] });
  },
};
