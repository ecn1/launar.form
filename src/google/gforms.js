// Thin REST client for the Google Forms API (+ Drive for sharing/deleting).
// Scopes are chosen by gauth based on the configured auth mode.

const { getAccessToken, isOAuthMode } = require('./gauth');
const { googleFormsFolderId } = require('../config');

const FORMS_BASE = 'https://forms.googleapis.com/v1/forms';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3/files';

async function callGoogle(url, { method = 'GET', body } = {}) {
  const token = await getAccessToken();

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.error?.message || text;
    } catch {
      // keep raw text
    }

    if (res.status === 403 && /storage quota/i.test(String(message))) {
      message +=
        ' — Service accounts have no Drive storage of their own, and files they create are owned by them. ' +
        'Use the OAuth setup instead (README §2 Option A) so forms are created as your own account.';
    }

    const err = new Error(`Google API ${method} failed (${res.status}): ${String(message).slice(0, 500)}`);
    err.status = res.status;
    throw err;
  }

  const json = await res.json().catch(() => ({}));
  return { status: res.status, data: json };
}

/** Accepts a raw folder ID or a full Drive folder URL. */
function resolveFolderId(input) {
  if (!input) return null;
  const match = String(input).match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input.trim() || null;
}

/**
 * Creates a Google Form and returns { formId, responderUri, title }.
 *
 * Implemented through the Drive API (mimeType application/vnd.google-apps.form)
 * because the Forms API's forms.create endpoint is unreliable with service
 * accounts — it persistently returns 500 INTERNAL. The Drive route creates an
 * identical form; its description is then set through the Forms API.
 */
async function createForm({ title, description }) {
  // OAuth's drive.file scope cannot place files into pre-existing folders the
  // app didn't create, so folder organization only applies to SA mode.
  const folderId = isOAuthMode() ? null : resolveFolderId(googleFormsFolderId);

  const { data: file } = await callGoogle(`${DRIVE_BASE}?fields=id`, {
    method: 'POST',
    body: {
      name: title,
      mimeType: 'application/vnd.google-apps.form',
      // When set, the form is created inside the user-shared folder so it
      // counts against the sharing user's storage quota, not the SA's.
      ...(folderId ? { parents: [folderId] } : {}),
    },
  });

  const formId = file.id;

  if (description) {
    await updateForm(formId, { description });
  }

  const { data: form } = await callGoogle(`${FORMS_BASE}/${encodeURIComponent(formId)}`);
  return { formId, responderUri: form.responderUri, title: form.info?.title ?? title };
}

/** Makes the form accessible to "anyone with the link" via Drive permissions. */
async function makePublic(formId) {
  await callGoogle(`${DRIVE_BASE}/${encodeURIComponent(formId)}/permissions`, {
    method: 'POST',
    body: { role: 'reader', type: 'anyone' },
  });
}

/** Updates a form's title and/or description via the Forms API. */
async function updateForm(formId, { title, description }) {
  const masks = [];
  if (title !== undefined) masks.push('info.title');
  if (description !== undefined) masks.push('info.description');

  await callGoogle(`${FORMS_BASE}/${encodeURIComponent(formId)}?updateMask=${masks.join(',')}`, {
    method: 'PATCH',
    body: { info: { ...(title !== undefined ? { title } : {}), ...(description !== undefined ? { description } : {}) } },
  });
}

/** Fetches a form's metadata (title, responderUri). */
async function getForm(formId) {
  const { data } = await callGoogle(`${FORMS_BASE}/${encodeURIComponent(formId)}`);
  return { formId: data.formId, title: data.info?.title, responderUri: data.responderUri };
}

/** Deletes the form file permanently via the Drive API. */
async function deleteForm(formId) {
  await callGoogle(`${DRIVE_BASE}/${encodeURIComponent(formId)}`, { method: 'DELETE' });
}

module.exports = { createForm, makePublic, updateForm, getForm, deleteForm };
