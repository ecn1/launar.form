<div align="center">

# 🌙 launar.form

**A Discord bot that creates Google Forms and posts them as aesthetic embed cards with an Open Form button.**

`discord.js v14` • `Node.js 18+` • no SDK — talks to Google's REST API directly

</div>

---

## ✨ Features

- 📝 **Real Google Form creation** — `/createform` builds an actual form on Google (custom title + description, or tasteful defaults), flips it to *anyone with the link can respond*, and posts it.
- 🎴 **Aesthetic form cards** — every form is posted as a lunar-violet embed with an **📝 Open Form** link button. Custom banner image, or the server icon as a thumbnail by default.
- 🔗 **Zero-setup mode** — already made a form by hand? `/shareform` posts it as a card without any Google configuration.
- 🗂️ **Form registry** — `/formlist` shows everything tracked in the server; `/delform` (with type-to-search autocomplete) removes the Discord post, the registry entry **and** the Google Form file itself.
- 🪶 **Tiny footprint** — no `googleapis` package; a ~4 KB JWT/REST client instead. Comfortably fits free hosts with a few hundred MB of disk.

## 📖 Commands (5)

| | Command | Description |
|---|---|---|
| 📝 | `/createform` `[title] [description] [image] [channel]` | Create a Google Form and post its card. Omit options to use defaults. |
| 🔗 | `/shareform` `link [title] [description] [image] [channel]` | Post an existing Google Forms link as a card |
| 📋 | `/formlist` | List every tracked form in this server |
| 🗑️ | `/delform` `form` | Remove a tracked form (post + registry + the Google Form file) |
| 🌙 | `/help` | Command guide |

All management commands require **Manage Server**. `/formlist` and `/help` are open to everyone.

## 🚀 Setup

### 1. Create the Discord application

1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** (e.g. `launar.form`).
2. **Bot** tab → **Reset Token** → copy it. *(No privileged intents are needed for this bot.)*
3. **General Information** → copy the **Application ID**.

Invite it (Manage Server + Embed Links + history are all it needs):

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_APP_ID&permissions=805825536&scope=bot%20applications.commands
```

### 2. Google service account (only for `/createform` & `/delform`)

One-time, ~5 minutes:

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project (any name, e.g. `launar-form`).
2. **APIs & Services → Library** → enable **Google Forms API** and **Google Drive API**.
3. **APIs & Services → Credentials → Create credentials → Service account** → name it → **Create and continue** (skip roles) → **Done**.
4. Click the new service account → **Keys → Add key → Create new key → JSON** → the key file downloads. **Keep it secret** — it's a password.
5. Give the bot the key: either
   - set `GOOGLE_SERVICE_ACCOUNT_JSON` to the **entire contents** of that file (easiest on Pterodactyl panels), or
   - upload the file next to the bot and set `GOOGLE_SERVICE_ACCOUNT_FILE=service-account.json`.

> Forms created by the bot live in the service account's own Drive — nobody needs to share anything with you, and respondents just see a normal form.

### 3. Configure & run

```bash
git clone https://github.com/YOUR_NAME/launar.form
cd launar.form
npm install

cp .env.example .env     # fill in DISCORD_TOKEN + CLIENT_ID (and Google key if using /createform)

npm run deploy           # register slash commands (instant if GUILD_ID is set)
npm start
```

### 4. Hosting

Same story as [launar.mod](https://github.com/ecn1/launar.mod): any free Node.js host works.

- **Pterodactyl-style panels** (HeavenCloud, Bot-Hosting.net, …): upload the project (no `node_modules`), set the env variables (`DISCORD_TOKEN`, `CLIENT_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`), entry point `index.js`, Node 18+, start. The startup script's automatic `npm install` covers dependencies.
- If the panel can't hold a giant single-line variable, upload a `.env` file via the File Manager instead — the bot reads both.
- `/shareform`, `/formlist` and `/help` work even without the Google key — handy if you want the bot live before finishing the Google setup.

## 🗂️ Project structure

```
launar.form/
├── index.js                  # entry point (node index.js)
├── src/
│   ├── bot.js                # client boot, command/event loader
│   ├── config.js             # env handling
│   ├── deploy-commands.js    # slash command registration (npm run deploy)
│   ├── commands/
│   │   ├── forms/            # createform, shareform, formlist, delform
│   │   └── utility/          # help
│   ├── events/               # ready, interactionCreate (+autocomplete)
│   ├── google/
│   │   ├── gauth.js          # service-account JWT → access token (node:crypto)
│   │   └── gforms.js         # Forms API create/update + Drive share/delete
│   └── utils/
│       ├── embeds.js         # 🎨 form card + lunar aesthetic system
│       ├── forms.js          # posting helpers, URL validation, link buttons
│       └── storage.js        # JSON registry of tracked forms
└── data/                     # runtime JSON registry (created automatically)
```

## 🛠️ Notes & limits

- Form titles/descriptions from commands are capped at 100/1000 characters (well within Google's limits).
- The registry holds up to **25 forms per server** (protects free Google Drive quota); `/delform` frees slots.
- `/delform` permanently deletes bot-created Google Forms. Forms added via `/shareform` are only untracked, never deleted — they're yours.
- Deleting a form's Discord post by hand is fine; use `/delform` to also clear the registry.

## 📄 License

[MIT](LICENSE)
