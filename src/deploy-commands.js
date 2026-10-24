// Registers slash commands with Discord.
// Run once after inviting the bot, and again whenever commands change:
//   npm run deploy
// Global registration can take up to ~1 hour to propagate.
// If GUILD_ID is set in .env, commands register instantly in that server only.

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('./config');

if (!token || !clientId) {
  console.error('[launar.form] Missing DISCORD_TOKEN and/or CLIENT_ID — check your .env file.');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

for (const category of fs.readdirSync(commandsPath)) {
  const categoryPath = path.join(commandsPath, category);
  if (!fs.statSync(categoryPath).isDirectory()) continue;

  for (const file of fs.readdirSync(categoryPath).filter((f) => f.endsWith('.js'))) {
    const command = require(path.join(categoryPath, file));
    if (command?.data) commands.push(command.data.toJSON());
  }
}

const rest = new REST().setToken(token);

(async () => {
  console.log(`[launar.form] Deploying ${commands.length} slash command(s)...`);

  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  const data = await rest.put(route, { body: commands });

  console.log(
    `[launar.form] Deployed ${data.length} command(s) ${
      guildId ? `to guild ${guildId}` : 'globally (may take up to an hour to appear)'
    }.`
  );
})().catch((error) => {
  console.error('[launar.form] Failed to deploy commands:', error);
  process.exit(1);
});
