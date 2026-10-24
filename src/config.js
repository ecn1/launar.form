require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  // Optional — when set, slash commands register instantly in this one guild.
  guildId: process.env.GUILD_ID || '',
  // Google service account: either the full JSON as a string, or a file path.
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
  googleServiceAccountFile: process.env.GOOGLE_SERVICE_ACCOUNT_FILE || '',
  // Optional Drive folder (ID or URL) shared with the service account — forms
  // are created inside it so they count against YOUR storage, not the SA's
  // (service accounts have no Drive quota of their own).
  googleFormsFolderId: process.env.GOOGLE_FORMS_FOLDER_ID || '',
};
