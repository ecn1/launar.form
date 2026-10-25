const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { formCardEmbed, success, error, withDetail, DEFAULT_DESCRIPTION } = require('../../utils/embeds');
const { openFormRow, jumpRow, channelPostError, imageUrlError } = require('../../utils/forms');
const { createForm, makePublic, addQuestions } = require('../../google/gforms');
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
    .addStringOption((o) =>
      o.setName('question1').setDescription('A short-answer question to add (default: "Name")').setMaxLength(200)
    )
    .addStringOption((o) =>
      o.setName('question2').setDescription('Another short-answer question').setMaxLength(200)
    )
    .addStringOption((o) =>
      o.setName('question3').setDescription('Another short-answer question').setMaxLength(200)
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

    const questions = [1, 2, 3]
      .map((n) => interaction.options.getString(`question${n}`)?.trim())
      .filter(Boolean);
    if (questions.length === 0) questions.push('Name'); // an empty form cannot be submitted

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
            error('I could not create the Google Form. Check that the Google OAuth setup is complete (see README §2) and the **Google Forms API** + **Google Drive API** are enabled.'),
            err
          ),
        ],
      });
    }

    // 2. Add the questions (form still works if this fails — editable in Drive).
    let questionNote = '';
    try {
      await addQuestions(form.formId, questions);
    } catch (err) {
      questionNote = `\n⚠️ Couldn't add questions (${String(err.message).slice(0, 120)}) — add them manually in Google Forms.`;
    }

    // 3. Post the form card.
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

    // 4. Register it so /formlist and /delform can manage it.
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
        `❓ Questions: ${questions.join(' • ')}`,
        `🔗 ${form.responderUri}`,
        questionNote,
        registered ? '' : '\n⚠️ Registry is full (25 forms) — this one is not tracked by `/formlist` or `/delform`.',
        '_Want different questions, checkboxes or required fields? The form is in your Google Drive — edit it there anytime._',
      ]
        .filter(Boolean)
        .join('\n'),
      '📝 Form created'
    );

    await interaction.editReply({ embeds: [reply], components: [jumpRow(message.url)] });
  },
};
