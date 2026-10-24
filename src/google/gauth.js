// Google authentication, two modes (OAuth takes precedence):
//
//   1. OAuth refresh token (recommended — forms are created as YOUR account,
//      so they use your Drive quota): needs GOOGLE_OAUTH_REFRESH_TOKEN +
//      GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET. Get the refresh
//      token once via `node scripts/authorize.js`.
//
//   2. Service account JWT (node:crypto, no SDK): works only where the SA may
//      own files — Google Workspace with shared drives. Free Gmail projects
//      fail with storageQuotaExceeded because SAs have no Drive storage.

const crypto = require('node:crypto');
const fs = require('node:fs');
const {
  googleServiceAccountJson,
  googleServiceAccountFile,
  googleOAuthRefreshToken,
  googleOAuthClientId,
  googleOAuthClientSecret,
  googleFormsFolderId,
} = require('../config');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Scope sets differ by mode: the service-account path can use the full Drive
// scope (no consent screens involved), while the OAuth path must stick to the
// narrow drive.file/drive.folder scopes — the full "drive" scope is
// RESTRICTED and unusable without a verified app.
const SA_SCOPES = 'https://www.googleapis.com/auth/forms.body https://www.googleapis.com/auth/drive';

const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/drive.file',
  ...(googleFormsFolderId ? ['https://www.googleapis.com/auth/drive.folder'] : []),
].join(' ');

function defaultScopes() {
  return googleOAuthRefreshToken ? OAUTH_SCOPES : SA_SCOPES;
}

let cached = { token: null, expiresAt: 0, scopes: '' };

function getCredentials() {
  if (googleServiceAccountJson) {
    try {
      return JSON.parse(googleServiceAccountJson);
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is set but is not valid JSON.');
    }
  }

  if (googleServiceAccountFile) {
    try {
      return JSON.parse(fs.readFileSync(googleServiceAccountFile, 'utf8'));
    } catch (err) {
      throw new Error(`Could not read the service-account file "${googleServiceAccountFile}": ${err.message}`);
    }
  }

  throw new Error(
    'No Google credentials configured. Set GOOGLE_OAUTH_REFRESH_TOKEN (+ client ID/secret — run ' +
      '`node scripts/authorize.js`) or a service account. See README §2.'
  );
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function createJwt(creds, scope) {
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      iss: creds.client_email,
      scope,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${payload}`;

  const privateKey = String(creds.private_key).replace(/\\n/g, '\n');
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsigned)
    .sign(privateKey, 'base64url');

  return `${unsigned}.${signature}`;
}

async function tokenExchange(form) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Google token request failed (${res.status}): ${body.error_description || body.error || 'unknown error'}`);
  }
  return body;
}

async function serviceAccountToken(scopes) {
  const creds = getCredentials();
  const jwt = createJwt(creds, scopes);
  const body = await tokenExchange({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  });
  return body.access_token;
}

async function oauthToken(scopes) {
  const body = await tokenExchange({
    grant_type: 'refresh_token',
    refresh_token: googleOAuthRefreshToken,
    client_id: googleOAuthClientId,
    client_secret: googleOAuthClientSecret,
    scopes,
  });
  return body.access_token;
}

/**
 * Returns a valid OAuth access token for the given scopes (space-separated),
 * or for the default scope set of the configured mode. Caches until shortly
 * before expiry.
 */
async function getAccessToken(scopes = defaultScopes()) {
  if (cached.token && Date.now() < cached.expiresAt && cached.scopes === scopes) {
    return cached.token;
  }

  const token = googleOAuthRefreshToken ? await oauthToken(scopes) : await serviceAccountToken(scopes);

  // Refresh 5 minutes early to avoid edge-of-expiry failures.
  cached = { token, expiresAt: Date.now() + (3600 - 300) * 1000, scopes };
  return token;
}

module.exports = { getAccessToken, getCredentials };
