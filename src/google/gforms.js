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
 * accounts — it persistently returns 500 INTERNAL.
 *
 * Responder access needs TWO things (missing either gives respondents
 * "This document is not published" / a sign-in wall):
 *   1. the Drive link-permission (anyone:reader), and
 *   2. the form's publish state set to published+accepting (newer Forms API).
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
      ...(folderId ? { parents: [folderId] } : {}),
    },
  });

  const formId = file.id;

  // Drive-created forms ship with one blank "Untitled Question" — drop it.
  await removeDefaultQuestion(formId);

  if (description) {
    await updateForm(formId, { description });
  }

  await makePublic(formId);
  await publishForm(formId);

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

/** Publishes the form so responders can open it without signing in.
 *  Both isPublished and isAcceptingResponses are required by the API when
 *  updating publish_state. */
async function publishForm(formId) {
  await callGoogle(`${FORMS_BASE}/${encodeURIComponent(formId)}:setPublishSettings`, {
    method: 'POST',
    body: {
      publishSettings: {
        publishState: { isPublished: true, isAcceptingResponses: true },
      },
      updateMask: 'publish_state',
    },
  });
}

/** Deletes the blank "Untitled Question" item that Drive-created forms ship with.
 *  DeleteItemRequest addresses items by location index (highest first, since
 *  indices shift as requests apply). */
async function removeDefaultQuestion(formId) {
  const { data } = await callGoogle(`${FORMS_BASE}/${encodeURIComponent(formId)}`);
  const indexes = (data.items || [])
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.title === 'Untitled Question')
    .map(({ index }) => index)
    .sort((a, b) => b - a);

  if (indexes.length === 0) return;

  await callGoogle(`${FORMS_BASE}/${encodeURIComponent(formId)}:batchUpdate`, {
    method: 'POST',
    body: { requests: indexes.map((index) => ({ deleteItem: { location: { index } } })) },
  });
}

/** Updates a form's title and/or description via the Forms API.
 *  Note: the direct PATCH /v1/forms/{id} route returns 404 in practice, so
 *  updates go through :batchUpdate — and its updateMask paths are RELATIVE to
 *  info ("title", "description"), not "info.title". */
async function updateForm(formId, { title, description }) {
  const masks = [];
  if (title !== undefined) masks.push('title');
  if (description !== undefined) masks.push('description');

  await callGoogle(`${FORMS_BASE}/${encodeURIComponent(formId)}:batchUpdate`, {
    method: 'POST',
    body: {
      requests: [
        {
          updateFormInfo: {
            info: {
              ...(title !== undefined ? { title } : {}),
              ...(description !== undefined ? { description } : {}),
            },
            updateMask: masks.join(','),
          },
        },
      ],
    },
  });
}

/** Adds short-answer questions to the form via :batchUpdate createItem. */
async function addQuestions(formId, questions) {
  const requests = questions.map((title, index) => ({
    createItem: {
      item: {
        title,
        questionItem: {
          question: { required: false, textQuestion: { paragraph: false } },
        },
      },
      location: { index },
    },
  }));

  await callGoogle(`${FORMS_BASE}/${encodeURIComponent(formId)}:batchUpdate`, {
    method: 'POST',
    body: { requests },
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

module.exports = { createForm, makePublic, updateForm, addQuestions, getForm, deleteForm };
