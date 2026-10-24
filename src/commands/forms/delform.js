const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { success, error } = require('../../utils/embeds');
const { deleteForm } = require('../../google/gforms');
const storage = require('../../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delform')
    .setDescription('🗑️ Remove a tracked form (post, registry, and the Google Form itself)')
    .addStringOption((o) =>
      o.setName('form').setDescription('The form to remove — start typing to search').setRequired(true).setAutocomplete(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  // Suggest tracked forms while the user types.
  async autocomplete(interaction) {
    const query = interaction.options.getFocused().toLowerCase();
    const choices = storage
      .getForms(interaction.guild.id)
      .filter((f) => f.title.toLowerCase().includes(query))
      .slice(0, 25)
      .map((f) => ({ name: `${f.source === 'created' ? '🛠️' : '🔗'} ${f.title}`.slice(0, 100), value: f.formId }));

    await interaction.respond(choices);
  },

  async execute(interaction) {
    const formId = interaction.options.getString('form', true);
    const entry = storage.getForm(interaction.guild.id, formId);

    if (!entry) {
      return interaction.reply({
        embeds: [error('I could not find that form in this server\'s registry. Use `/formlist` to see tracked forms.')],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const notes = [];

    // 1. Delete the Discord post (ignore if already gone / channel missing).
    try {
      const channel = interaction.guild.channels.cache.get(entry.channelId);
      const message = await channel?.messages.fetch(entry.messageId).catch(() => null);
      if (message) await message.delete();
      else notes.push('• The Discord post was already gone.');
    } catch {
      notes.push('• I could not delete the Discord post (missing permissions?).');
    }

    // 2. Delete the actual Google Form if the bot created it.
    if (entry.source === 'created') {
      try {
        await deleteForm(entry.formId);
      } catch (err) {
        notes.push(`• The Google Form file could not be deleted (${String(err.message).slice(0, 120)}) — you can remove it manually in Drive.`);
      }
    }

    // 3. Drop it from the registry.
    storage.removeForm(interaction.guild.id, formId);

    const embed = success(
      [`Removed **${entry.title}** from the registry.`, ...notes].join('\n'),
      '🗑️ Form removed'
    );

    await interaction.editReply({ embeds: [embed] });
  },
};
