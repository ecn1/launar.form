const { Events, MessageFlags } = require('discord.js');
const { error } = require('../utils/embeds');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    // Autocomplete suggestions (e.g. /delform form picker).
    if (interaction.isAutocomplete()) {
      if (!command.autocomplete) return;
      try {
        await command.autocomplete(interaction);
      } catch (err) {
        console.error(`[launar.form] /${interaction.commandName} autocomplete failed:`, err);
        await interaction.respond([]).catch(() => null);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`[launar.form] /${interaction.commandName} failed:`, err);

      const payload = {
        embeds: [
          error(
            'Something went wrong while running that command. The error has been logged — please try again.',
            '❌ Something broke'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => null);
      } else {
        await interaction.reply(payload).catch(() => null);
      }
    }
  },
};
