const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { formCardEmbed, success, error, withDetail, DEFAULT_DESCRIPTION } = require('../../utils/embeds');
const { openFormRow, jumpRow, channelPostError, imageUrlError } = require('../../utils/forms');
const { createForm, makePublic } = require('../../google/gforms');
const storage = require('../../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createform')
    .setDescription('📝 Create a Google Form and post it in a channel')
    .addStringOption((o) =>
      o.setName('title').setDescription('Form title (default: ✨ New Form)').setMaxLength(100)
    )
    .addStringOption((o) =>
      o.setName('description').setDescription('Form description').setMaxLength(1000)
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
    const title = interaction.options.getString('title') ?? '✨ New Form';
    const description = interaction.options.getString('description') ?? DEFAULT_DESCRIPTION;
    const image = interaction.options.getString('image');
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;

    const imageProblem = imageUrlError(image);
    if (imageProblem) return interaction.reply({ embeds: [error(imageProblem)], ephemeral: true });

    const postProblem = channelPostError(channel, interaction.guild.members.me);
    if (postProblem) return interaction.reply({ embeds: [error(postProblem)], ephemeral: true });

    await interaction.deferReply();

    // 1. Create the form on Google.
    let form;
    try {
      form = await createForm({ title, description });
      await makePublic(form.formId); // allow anyone with the link to respond
    } catch (err) {
      return interaction.editReply({
        embeds: [
          withDetail(
            error('I could not create the Google Form. Check that the service account is configured (see README) and the **Google Forms API** + **Google Drive API** are enabled.'),
            err
          ),
        ],
      });
    }

    // 2. Post the form card.
    const card = formCardEmbed({
      title: form.title,
      description,
      imageUrl: image,
      guild: interaction.guild,
      requester: interaction.user,
      source: 'created',
    });

    let message;
    try {
      message = await channel.send({ embeds: [card], components: [openFormRow(form.responderUri)] });
    } catch (err) {
      return interaction.editReply({
        embeds: [
          withDetail(
            error(`The form was created, but I could not post it in ${channel}. You can still share it manually: ${form.responderUri}`),
            err
          ),
        ],
      });
    }

    // 3. Register it so /formlist and /delform can manage it.
    const registered = storage.addForm(interaction.guild.id, {
      formId: form.formId,
      url: form.responderUri,
      title: form.title,
      description,
      channelId: channel.id,
      messageId: message.id,
      createdBy: interaction.user.id,
      createdAt: Date.now(),
      source: 'created',
    });

    const reply = success(
      [
        `**${form.title}** is live! 🌙`,
        `📍 Posted in ${channel}`,
        `🔗 ${form.responderUri}`,
        registered ? '' : '\n⚠️ Registry is full (25 forms) — this one is not tracked by `/formlist` or `/delform`.',
      ]
        .filter(Boolean)
        .join('\n'),
      '📝 Form created'
    );

    await interaction.editReply({ embeds: [reply], components: [jumpRow(message.url)] });
  },
};
