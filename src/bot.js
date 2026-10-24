const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { token } = require('./config');

if (!token || !process.env.CLIENT_ID) {
  console.error(
    '[launar.form] Missing DISCORD_TOKEN and/or CLIENT_ID.\n' +
      '            Copy .env.example to .env and fill it in (or set the variables in your host panel).'
  );
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.commands = new Collection();

// ── Load commands ────────────────────────────────────────────────────────────
const commandsPath = path.join(__dirname, 'commands');
for (const category of fs.readdirSync(commandsPath)) {
  const categoryPath = path.join(commandsPath, category);
  if (!fs.statSync(categoryPath).isDirectory()) continue;

  for (const file of fs.readdirSync(categoryPath).filter((f) => f.endsWith('.js'))) {
    const command = require(path.join(categoryPath, file));
    if (command?.data && command?.execute) {
      client.commands.set(command.data.name, command);
    } else {
      console.warn(`[launar.form] Skipped malformed command file: commands/${category}/${file}`);
    }
  }
}

// ── Load events ──────────────────────────────────────────────────────────────
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) client.once(event.name, (...args) => event.execute(...args));
  else client.on(event.name, (...args) => event.execute(...args));
}

process.on('unhandledRejection', (error) => {
  if (String(error?.message).includes('disallowed intents')) {
    console.error(
      '[launar.form] Login failed: privileged intents are not enabled.\n' +
        '            launar.form does not need any privileged intents — check that\n' +
        '            the token belongs to the right application and try again.'
    );
    process.exit(1);
  }
  console.error('[launar.form] Unhandled rejection:', error);
});

client.login(token);
