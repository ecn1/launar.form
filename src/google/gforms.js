// Thin REST client for the Google Forms API (+ Drive for sharing/deleting).
// Scope note: forms.body creates/updates forms; drive manages the form file's
// link-sharing permission and deletion.

const { getAccessToken } = require('./gauth');

const SCOPES = 'https://www.googleapis.com/auth/forms.body https://www.googleapis.com/auth/drive';

const FORMS_BASE = 'https://forms.googleapis.com/v1/forms';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3/files';

async function callGoogle(url, { method = 'GET', body } = {}) {
  const token = await getAccessToken(SCOPES);

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
    const err = new Error(`Google API ${method} failed (${res.status}): ${String(message).slice(0, 500)}`);
    err.status = res.status;
    throw err;
  }

  const json = await res.json().catch(() => ({}));
  return { status: res.status, data: json };
}

/** Creates a Google Form and returns { formId, responderUri, title }. */
async function createForm({ title, description }) {
  const { data } = await callGoogle(FORMS_BASE, {
    method: 'POST',
    body: {
      info: {
        title,
        ...(description ? { description } : {}),
      },
    },
  });

  return {
    formId: data.formId,
    responderUri: data.responderUri,
    title: data.info?.title ?? title,
  };
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
