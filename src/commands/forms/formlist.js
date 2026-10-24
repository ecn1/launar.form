const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { baseEmbed, COLORS } = require('../../utils/embeds');
const storage = require('../../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('formlist')
    .setDescription('📋 List every form this bot has created or shared here')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const forms = storage.getForms(interaction.guild.id);

    if (forms.length === 0) {
      return interaction.reply({
        embeds: [
          baseEmbed(COLORS.info)
            .setTitle('📋 No forms yet')
            .setDescription(
              'This server has no tracked forms.\n\n' +
                '• `/createform` — create a Google Form and post it (needs Google setup)\n' +
                '• `/shareform` — post a form link you already have (no setup needed)'
            ),
        ],
      });
    }

    const lines = forms
      .slice(-15)
      .reverse()
      .map(
        (f) =>
          `📝 **[${f.title}](${f.url})**\n` +
          `> ${f.source === 'created' ? '🛠️ Created' : '🔗 Shared'} • in <#${f.channelId}> • by <@${f.createdBy}> • <t:${Math.floor(f.createdAt / 1000)}:R>`
      );

    const embed = baseEmbed(COLORS.brand)
      .setTitle(`📋 Forms — ${interaction.guild.name}`)
      .setDescription(lines.join('\n\n'))
      .addFields({ name: '🗂️ Total', value: `**${forms.length}** form(s)`, inline: true });

    if (forms.length > 15) {
      embed.addFields({ name: 'ℹ️ Note', value: 'Showing the 15 most recent.', inline: true });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
