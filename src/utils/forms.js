// Shared helpers for posting form cards and managing their registry entries.

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

/** Link-button row that opens the form. */
function openFormRow(url) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Open Form').setEmoji('📝').setStyle(ButtonStyle.Link).setURL(url)
  );
}

function jumpRow(url) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Jump to Post').setEmoji('🚀').setStyle(ButtonStyle.Link).setURL(url)
  );
}

/** Returns an error string if the bot cannot post in the channel, else null. */
function channelPostError(channel, me) {
  if (!channel?.isTextBased() || channel.isDMBased()) {
    return 'I can only post forms in **server text channels**.';
  }
  const perms = channel.permissionsFor(me);
  if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    return `I need **View Channel**, **Send Messages** and **Embed Links** in ${channel}.`;
  }
  return null;
}

/** Validates an optional image URL, returning an error string or null. */
function imageUrlError(imageUrl) {
  if (!imageUrl) return null;
  try {
    const url = new URL(imageUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('bad protocol');
    return null;
  } catch {
    return 'The `image` option must be a direct link starting with `http://` or `https://` (e.g. an imgur or CDN link).';
  }
}

/** Pulls the form ID out of a Google Forms URL, or null if it isn't one. */
function extractFormId(url) {
  const match = String(url).match(/docs\.google\.com\/forms\/d(?:\/e)?\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

module.exports = { openFormRow, jumpRow, channelPostError, imageUrlError, extractFormId };
