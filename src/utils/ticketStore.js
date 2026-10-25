// Ticket system storage: config, panels, support roles, blacklist, open
// tickets — one JSON file per guild key in ./data/tickets.json.

const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FILE = 'tickets.json';

const MAX_PANELS = 25; // Discord hard limit: 5 button rows × 5 buttons

const DEFAULTS = () => ({
  enabled: false,
  categoryId: null,
  logChannelId: null,
  supportRoleIds: [],
  panels: [],
  counter: 0,
  blacklist: [],
  open: [],
});

function read() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, FILE), 'utf8'));
  } catch {
    return {};
  }
}

function write(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, FILE), JSON.stringify(data, null, 2));
}

function getConfig(guildId) {
  const all = read();
  return { ...DEFAULTS(), ...(all[guildId] || {}) };
}

function updateConfig(guildId, patch) {
  const all = read();
  all[guildId] = { ...getConfig(guildId), ...patch };
  write(all);
  return all[guildId];
}

// ── Panels ───────────────────────────────────────────────────────────────────
function addPanel(guildId, { name, emoji, description }) {
  const config = getConfig(guildId);
  if (config.panels.length >= MAX_PANELS) return null;

  const panel = {
    id: `p_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    name,
    emoji: emoji || '🎫',
    description: description || '',
  };
  config.panels.push(panel);
  write({ ...read(), [guildId]: config });
  return panel;
}

function removePanel(guildId, idOrName) {
  const config = getConfig(guildId);
  const key = String(idOrName).toLowerCase();
  const index = config.panels.findIndex(
    (p) => p.id === idOrName || p.name.toLowerCase() === key
  );
  if (index === -1) return null;
  const [removed] = config.panels.splice(index, 1);
  updateConfig(guildId, { panels: config.panels });
  return removed;
}

function getPanel(guildId, panelId) {
  return getConfig(guildId).panels.find((p) => p.id === panelId) ?? null;
}

// ── Support roles ────────────────────────────────────────────────────────────
function addSupportRole(guildId, roleId) {
  const config = getConfig(guildId);
  if (!config.supportRoleIds.includes(roleId)) config.supportRoleIds.push(roleId);
  updateConfig(guildId, { supportRoleIds: config.supportRoleIds });
}

function removeSupportRole(guildId, roleId) {
  const config = getConfig(guildId);
  updateConfig(guildId, { supportRoleIds: config.supportRoleIds.filter((r) => r !== roleId) });
}

// ── Ticket blacklist ─────────────────────────────────────────────────────────
function blacklistAdd(guildId, userId) {
  const config = getConfig(guildId);
  if (!config.blacklist.includes(userId)) config.blacklist.push(userId);
  updateConfig(guildId, { blacklist: config.blacklist });
}

function blacklistRemove(guildId, userId) {
  const config = getConfig(guildId);
  updateConfig(guildId, { blacklist: config.blacklist.filter((u) => u !== userId) });
}

function blacklistHas(guildId, userId) {
  return getConfig(guildId).blacklist.includes(userId);
}

// ── Ticket counter ───────────────────────────────────────────────────────────
function nextTicketNumber(guildId) {
  const config = getConfig(guildId);
  const number = config.counter + 1;
  updateConfig(guildId, { counter: number });
  return number;
}

// ── Open tickets ─────────────────────────────────────────────────────────────
function addOpen(guildId, entry) {
  const config = getConfig(guildId);
  config.open.push(entry);
  updateConfig(guildId, { open: config.open });
}

function getOpenByUser(guildId, userId) {
  return getConfig(guildId).open.find((t) => t.userId === userId) ?? null;
}

function getOpenByChannel(guildId, channelId) {
  return getConfig(guildId).open.find((t) => t.channelId === channelId) ?? null;
}

function updateOpen(guildId, channelId, patch) {
  const config = getConfig(guildId);
  const ticket = config.open.find((t) => t.channelId === channelId);
  if (!ticket) return;
  Object.assign(ticket, patch);
  updateConfig(guildId, { open: config.open });
}

function removeOpen(guildId, channelId) {
  const config = getConfig(guildId);
  updateConfig(guildId, { open: config.open.filter((t) => t.channelId !== channelId) });
}

module.exports = {
  MAX_PANELS,
  getConfig,
  updateConfig,
  addPanel,
  removePanel,
  getPanel,
  addSupportRole,
  removeSupportRole,
  blacklistAdd,
  blacklistRemove,
  blacklistHas,
  nextTicketNumber,
  addOpen,
  getOpenByUser,
  getOpenByChannel,
  updateOpen,
  removeOpen,
};
