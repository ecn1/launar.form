const { Events, MessageFlags } = require('discord.js');
const { error } = require('../utils/embeds');
const { handleComponent } = require('../components/tickets');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Ticket system buttons and modals (customId starts with "ticket:") come
    // first — buttons/modals have no commandName.
    if (
      (interaction.isButton() || interaction.isModalSubmit()) &&
      interaction.customId.startsWith('ticket:')
    ) {
      try {
        await handleComponent(interaction);
      } catch (err) {
        console.error(`[launar.form] ticket component "${interaction.customId}" failed:`, err);
        const payload = {
          embeds: [error('Something went wrong with that ticket action. The error has been logged — please try again.', '🎫 Ticket error')],
          flags: MessageFlags.Ephemeral,
        };
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
        else await interaction.reply(payload).catch(() => null);
      }
      return;
    }

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
