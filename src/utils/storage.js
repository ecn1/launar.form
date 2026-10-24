// Lightweight JSON registry of posted forms (per guild), stored in ./data.
// Entry shape: { formId, url, title, description, channelId, messageId,
//                createdBy, createdAt, source: 'created' | 'shared' }

const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const MAX_FORMS_PER_GUILD = 25;

function read() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'forms.json'), 'utf8'));
  } catch {
    return {};
  }
}

function write(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'forms.json'), JSON.stringify(data, null, 2));
}

function getForms(guildId) {
  return read()[guildId] ?? [];
}

function getForm(guildId, formId) {
  return getForms(guildId).find((f) => f.formId === formId) ?? null;
}

function addForm(guildId, entry) {
  const all = read();
  all[guildId] ??= [];

  if (all[guildId].length >= MAX_FORMS_PER_GUILD) {
    return false; // soft cap so free Google accounts don't fill up
  }

  all[guildId].push(entry);
  write(all);
  return true;
}

function removeForm(guildId, formId) {
  const all = read();
  const list = all[guildId];
  if (!list) return false;

  const index = list.findIndex((f) => f.formId === formId);
  if (index === -1) return false;

  list.splice(index, 1);
  if (list.length === 0) delete all[guildId];
  write(all);
  return true;
}

module.exports = { getForms, getForm, addForm, removeForm, MAX_FORMS_PER_GUILD };
