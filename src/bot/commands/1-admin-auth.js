const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const { dbWrapper } = require('../../database/database.js');
const config = require('../../../config.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('auth')
    .setDescription('Exibe o painel de administração do Bot Auth.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
  async execute(interaction) {
    // CORRIGIDO: 'ephemeral: true' mudou para 'flags: 64'
    await interaction.deferReply({ flags: 64 });

    const guildId = interaction.guild.id;
    
    // Busca o servidor principal e o total de usuários
    const mainGuildId = (await dbWrapper.getBotConfig())?.mainGuildId || 'Nenhum';
    const totalUsers = await dbWrapper.getTotalUsers();
    
    let serverText = "Este não é o servidor principal.";
    if (mainGuildId === 'Nenhum') {
        serverText = "Nenhum servidor principal definido.";
    } else if (mainGuildId === guildId) {
        serverText = `Este é o servidor principal. (ID: ${mainGuildId})`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`Painel de Administração - ${interaction.client.user.username}`)
      .setDescription('Use os botões abaixo para gerenciar as configurações do bot.')
      .addFields(
        { name: 'Servidor Atual', value: serverText, inline: true },
        { name: 'Usuários Válidos', value: `\`${totalUsers}\` usuários`, inline: true },
        { name: 'Total de Puxadas', value: '`0` puxadas', inline: true } // Placeholder
      );

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('push_members_button')
          .setLabel('Puxar Membros')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('👥'),
        new ButtonBuilder()
          .setCustomId('config_server_button')
          .setLabel('Configurar Servidores')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⚙️'),
        new ButtonBuilder()
          .setCustomId('create_gift_button')
          .setLabel('Criar Gift-Cards')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🎁')
      );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('send_embed_button')
                .setLabel('Enviar Mensagem Auth')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📩'),
            new ButtonBuilder()
                .setLabel('Convidar Bot')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/api/oauth2/authorize?client_id=${config.CLIENT_ID}&permissions=8&scope=bot%20applications.commands`)
        );

    await interaction.editReply({ embeds: [embed], components: [row1, row2] });
  },
};