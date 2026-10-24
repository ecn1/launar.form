// One-time OAuth consent helper for launar.form.
//
//   node scripts/authorize.js                  → prints the Google approval link
//   node scripts/authorize.js "PASTED_CODE"    → exchanges it and prints the
//                                                refresh token for your .env
//
// Needs GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env first
// (an OAuth client of type "Desktop app" in the same Google Cloud project).

require('dotenv').config();
const {
  googleOAuthClientId,
  googleOAuthClientSecret,
  googleFormsFolderId,
} = require('../src/config');

const SCOPES = 'https://www.googleapis.com/auth/forms.body https://www.googleapis.com/auth/drive.file';
const REDIRECT = 'http://localhost:1'; // fails to load — copy the code from the address bar

const FOLDER_SCOPE_URL = googleFormsFolderId
  ? `https://www.googleapis.com/auth/drive.folder ${SCOPES}`
  : SCOPES;

function authUrl() {
  const params = new URLSearchParams({
    client_id: googleOAuthClientId,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: FOLDER_SCOPE_URL,
    access_type: 'offline',
    prompt: 'consent', // guarantees a refresh_token is returned
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchange(code) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: googleOAuthClientId,
      client_secret: googleOAuthClientSecret,
      redirect_uri: REDIRECT,
      grant_type: 'authorization_code',
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Exchange failed (${res.status}): ${body.error_description || body.error || 'unknown error'}`);
    process.exit(1);
  }
  if (!body.refresh_token) {
    console.error('No refresh_token returned — try again with prompt=consent (already included).');
    process.exit(1);
  }

  console.log('\n✅ Success! Add this line to your .env (and to your host panel):\n');
  console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${body.refresh_token}`);
  console.log('\nThen start the bot — /createform now works as your Google account. 🌙');
}

const arg = process.argv[2];

if (!googleOAuthClientId || !googleOAuthClientSecret) {
  console.error('Missing GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET in .env — create an OAuth client (type "Desktop app") first. See README §2.');
  process.exit(1);
}

if (!arg) {
  console.log('\n1. Open this link in your browser and approve access:\n');
  console.log(authUrl());
  console.log('\n2. The page will fail to load — that is normal.');
  console.log('   Copy the "code=..." value from the address bar.\n');
  console.log(`3. Then run:  node scripts/authorize.js "PASTED_CODE_OR_URL"\n`);
} else {
  const match = arg.match(/code=([^&\s]+)/);
  exchange(match ? decodeURIComponent(match[1]) : arg.trim()).catch((err) => {
    console.error('ERR:', err.message);
    process.exit(1);
  });
}
