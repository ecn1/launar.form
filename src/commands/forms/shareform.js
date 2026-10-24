const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { formCardEmbed, success, error } = require('../../utils/embeds');
const { openFormRow, jumpRow, channelPostError, imageUrlError, extractFormId } = require('../../utils/forms');
const storage = require('../../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shareform')
    .setDescription('🔗 Post an existing Google Form link as an embed card')
    .addStringOption((o) =>
      o.setName('link').setDescription('The Google Forms link (…/viewform)').setRequired(true).setMaxLength(500)
    )
    .addStringOption((o) =>
      o.setName('title').setDescription('Card title (default: form ID or "📝 Form")').setMaxLength(100)
    )
    .addStringOption((o) =>
      o.setName('description').setDescription('Card description').setMaxLength(1000)
    )
    .addStringOption((o) =>
      o.setName('image').setDescription('Banner image URL shown on the form card').setMaxLength(500)
    )
    .addChannelOption((o) =>
      o.setName('channel').setDescription('Channel to post the form card in (default: here)')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const link = interaction.options.getString('link', true).trim();
    const description = interaction.options.getString('description');
    const image = interaction.options.getString('image');
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;

    if (!/^https?:\/\/(docs\.google\.com\/forms|forms\.gle)\//i.test(link)) {
      return interaction.reply({
        embeds: [error('That does not look like a **Google Forms** link. It should look like `https://docs.google.com/forms/d/…/viewform` or a `forms.gle/…` short link.')],
        ephemeral: true,
      });
    }

    const imageProblem = imageUrlError(image);
    if (imageProblem) return interaction.reply({ embeds: [error(imageProblem)], ephemeral: true });

    const postProblem = channelPostError(channel, interaction.guild.members.me);
    if (postProblem) return interaction.reply({ embeds: [error(postProblem)], ephemeral: true });

    await interaction.deferReply();

    const formId = extractFormId(link) ?? `shared-${Date.now()}`;
    const title = interaction.options.getString('title') ?? '📝 Form';

    const card = formCardEmbed({
      title,
      description,
      imageUrl: image,
      guild: interaction.guild,
      requester: interaction.user,
      source: 'shared',
    });

    let message;
    try {
      message = await channel.send({ embeds: [card], components: [openFormRow(link)] });
    } catch (err) {
      return interaction.editReply({
        embeds: [error(`I could not post in ${channel}, even though permissions looked fine. ${err.message.slice(0, 200)}`)],
      });
    }

    const registered = storage.addForm(interaction.guild.id, {
      formId,
      url: link,
      title,
      description: description ?? '',
      channelId: channel.id,
      messageId: message.id,
      createdBy: interaction.user.id,
      createdAt: Date.now(),
      source: 'shared',
    });

    const reply = success(
      [
        `Form card posted in ${channel} 🌙`,
        `🔗 ${link}`,
        registered ? '' : '\n⚠️ Registry is full (25 forms) — not tracked by `/formlist` or `/delform`.',
      ]
        .filter(Boolean)
        .join('\n'),
      '🔗 Form shared'
    );

    await interaction.editReply({ embeds: [reply], components: [jumpRow(message.url)] });
  },
};
