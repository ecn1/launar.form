const { Events, ActivityType } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`[launar.form] Online as ${client.user.tag} — serving ${client.guilds.cache.size} server(s).`);

    client.user.setPresence({
      status: 'online',
      activities: [{ name: '/help • launar.form 🌙', type: ActivityType.Watching }],
    });
  },
};
