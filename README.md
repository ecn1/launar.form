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

## 📖 Commands (6 top-level)

| | Command | Description |
|---|---|---|
| 📝 | `/createform` `[title] [description] [question1-3] [image] [channel]` | Create a Google Form **with questions** and post its card. Omit options to use defaults. |
| 🔗 | `/shareform` `link [title] [description] [image] [channel]` | Post an existing Google Forms link as a card |
| 📋 | `/formlist` | List every tracked form in this server |
| 🗑️ | `/delform` `form` | Remove a tracked form (post + registry + the Google Form file) |
| 🎫 | `/tickets …` | Full ticket system — see below |
| 🌙 | `/help` | Command guide |

### 🎫 Ticket system

Admins (**Manage Server**) configure everything under `/tickets`:

1. `/tickets panel add name:Support emoji:🛠️ description:Help from staff` — add panels (up to 25)
2. `/tickets panel post` — post the panel selector embed with a button per panel
3. `/tickets category` — where ticket channels are created
4. `/tickets support-add @Role` — roles that see & manage tickets (admins always can)
5. `/tickets logs #log-channel` — closed tickets are summarized here
6. `/tickets enable` — turn it on (`/tickets disable` pauses it anytime)

**How a ticket works:** a member clicks a panel button → a modal asks **why they're opening the ticket** → the bot creates a private channel named `<panel>-<display-name>` visible only to the creator, support roles and admins → an embed shows the creator, panel, reason and ticket number, with **🗑️ Close** (reason modal), **🙋 Claim** (staff) and **⛔ Close & Ticket-Ban** buttons. Closing edits the embed, logs a summary to the log channel and deletes the channel after 10 seconds. One open ticket per member; `/tickets ban/unban/blacklist` manage abusers.

All management commands require **Manage Server**. `/formlist` and `/help` are open to everyone.

## 🚀 Setup

### 1. Create the Discord application

1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** (e.g. `launar.form`).
2. **Bot** tab → **Reset Token** → copy it. *(No privileged intents are needed for this bot.)*
3. **General Information** → copy the **Application ID**.

Invite it (View/Send/Embed/History + Manage Channels for ticket channels):

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_APP_ID&permissions=85008&scope=bot%20applications.commands
```

### 2. Google authorization (only for `/createform` & `/delform`)

#### Option A — OAuth as your own account (recommended, works on free Gmail)

Forms are created **as you** — they land in your Drive and use your quota. One-time setup, ~5 minutes:

1. [console.cloud.google.com](https://console.cloud.google.com) → pick your `launar-form` project.
2. **APIs & Services → Library** → enable **Google Forms API** and **Google Drive API** (already done if you followed the service-account route).
3. **APIs & Services → OAuth consent screen** → user type **External** → app name `launar.form` + your email → save → under **Audience/Publishing** press **Publish app** (the "unverified" warning is expected; you approve only your own account).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** → type **Desktop app** → copy the **Client ID** and **Client secret** into `.env` as `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`.
5. Run the helper and follow it:
   ```bash
   node scripts/authorize.js
   # open the printed link, approve, copy the ?code=… from the address bar, then:
   node scripts/authorize.js "PASTED_CODE_OR_URL"
   ```
6. Put the printed `GOOGLE_OAUTH_REFRESH_TOKEN=…` line into `.env` (and later into your host panel). Done — forever, unless you revoke it.

> The bot requests only `forms.body` + `drive.file` (+ `drive.folder` if you set `GOOGLE_FORMS_FOLDER_ID`) — it can only manage the forms it creates itself.

#### Option B — Service account (advanced)

A service-account key also works, but **only on Google Workspace** (where forms can be created in a shared drive). On free Gmail projects, service accounts have **no Drive storage quota** and files they create are owned by them — creation fails with `403 storageQuotaExceeded` no matter what folders you share (verified the hard way). Skip this on free accounts.

To use it anyway: enable Forms + Drive APIs, create a service account, download its JSON key, and set `GOOGLE_SERVICE_ACCOUNT_JSON` (whole file as one variable) or `GOOGLE_SERVICE_ACCOUNT_FILE=path`. `/shareform`, `/formlist` and `/help` never need any of this.

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

- **Pterodactyl-style panels** ([Silly Development](https://sillydev.co.uk), HeavenCloud, Bot-Hosting.net, …): upload the project (no `node_modules`), set the env variables (`DISCORD_TOKEN`, `CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`), entry point `index.js`, Node 18+, start. On SillyDev's free plan there are **no renewals** and dependencies install from `package.json` automatically; if the panel has no variable UI, upload a `.env` with those values instead — the bot reads both.
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
