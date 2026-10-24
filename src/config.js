require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  // Optional — when set, slash commands register instantly in this one guild.
  guildId: process.env.GUILD_ID || '',
  // ── Google auth — pick ONE mode ────────────────────────────────────────────
  // Mode 1 (recommended on free Gmail): OAuth as your own account. Get the
  // refresh token once with `node scripts/authorize.js` (see README §2).
  googleOAuthRefreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN || '',
  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
  googleOAuthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
  // Mode 2 (advanced): service account — works out of the box only on Google
  // Workspace (shared drives), because service accounts have no Drive quota.
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
  googleServiceAccountFile: process.env.GOOGLE_SERVICE_ACCOUNT_FILE || '',
  // Optional Drive folder (ID or URL) for organizing created forms.
  googleFormsFolderId: process.env.GOOGLE_FORMS_FOLDER_ID || '',
};
