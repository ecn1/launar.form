const { Events } = require('discord.js');
const store = require('../utils/ticketStore');

module.exports = {
  name: Events.ChannelDelete,
  async execute(channel) {
    if (!channel.guild) return;
    // Keep the registry honest when a ticket channel is deleted manually.
    store.removeOpen(channel.guild.id, channel.id);
  },
};
