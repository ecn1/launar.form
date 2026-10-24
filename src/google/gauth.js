// Google service-account authentication without any SDK:
// builds an RS256 JWT with node:crypto, exchanges it for an access token,
// and caches the token until shortly before it expires.

const crypto = require('node:crypto');
const fs = require('node:fs');
const { googleServiceAccountJson, googleServiceAccountFile } = require('../config');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

let cached = { token: null, expiresAt: 0 };

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
    'No Google service account configured. Set GOOGLE_SERVICE_ACCOUNT_JSON (the whole key file ' +
      'as one variable) or GOOGLE_SERVICE_ACCOUNT_FILE (path to the key file). ' +
      'See the README — /shareform and /formlist work without it.'
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

/**
 * Returns a valid OAuth access token for the given scopes (space-separated),
 * refreshing and caching it as needed.
 */
async function getAccessToken(scopes) {
  if (cached.token && Date.now() < cached.expiresAt) return cached.token;

  const creds = getCredentials();
  const jwt = createJwt(creds, scopes);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status}): ${body.error_description || body.error || 'unknown error'}`);
  }

  cached = {
    token: body.access_token,
    // Refresh 5 minutes early to avoid edge-of-expiry failures.
    expiresAt: Date.now() + (body.expires_in - 300) * 1000,
  };

  return cached.token;
}

module.exports = { getAccessToken, getCredentials };
