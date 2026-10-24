// ─────────────────────────────────────────────────────────────────────────────
// launar.form embed system — shares the lunar aesthetic with launar.mod:
// violet branding, soft accents, moonlit footer, and the signature form card.
// ─────────────────────────────────────────────────────────────────────────────
const { EmbedBuilder } = require('discord.js');

const COLORS = {
  brand: 0x8b5cf6, // lunar violet
  success: 0x34d399,
  danger: 0xf43f5e,
  info: 0x60a5fa,
  form: 0xa78bfa, // soft violet for posted form cards
};

const FOOTER_TEXT = 'launar.form • moonlit forms';

const DEFAULT_DESCRIPTION = 'Please fill out this form — it only takes a moment. ✨';

function baseEmbed(color = COLORS.brand) {
  return new EmbedBuilder()
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: FOOTER_TEXT });
}

function success(description, title = '✨ Done') {
  return baseEmbed(COLORS.success).setTitle(title).setDescription(description);
}

function error(description, title = '❌ Command failed') {
  return baseEmbed(COLORS.danger).setTitle(title).setDescription(description);
}

function info(description, title) {
  return baseEmbed(COLORS.info).setTitle(title).setDescription(description);
}

// Attaches Discord's real API error to a friendly embed (same as launar.mod).
function withDetail(embed, err) {
  const detail =
    [err?.status !== undefined && `status ${err.status}`, err?.message || String(err)]
      .filter(Boolean)
      .join(' — ') || 'Unknown error';

  console.error('[launar.form] API error:', detail);

  return embed.addFields({
    name: '🔧 Details',
    value: `\`${detail.slice(0, 1000)}\``,
    inline: false,
  });
}

/**
 * The signature form card posted into channels: violet card, form description,
 * optional banner image, and an "Open Form" link button next to it.
 */
function formCardEmbed({ title, description, imageUrl, guild, requester, source }) {
  const embed = baseEmbed(COLORS.form)
    .setAuthor({ name: '📝 New Form' })
    .setTitle(title)
    .setDescription(description || DEFAULT_DESCRIPTION)
    .addFields(
      { name: '👤 Shared by', value: `${requester}`, inline: true },
      { name: '🗂️ Source', value: source === 'created' ? 'Created via bot' : 'Shared link', inline: true }
    );

  if (imageUrl) embed.setImage(imageUrl);
  else if (guild?.iconURL()) embed.setThumbnail(guild.iconURL({ size: 256 }));

  return embed;
}

module.exports = {
  COLORS,
  FOOTER_TEXT,
  DEFAULT_DESCRIPTION,
  baseEmbed,
  success,
  error,
  info,
  withDetail,
  formCardEmbed,
};
