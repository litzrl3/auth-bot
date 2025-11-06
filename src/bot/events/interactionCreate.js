const { 
    Events, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    EmbedBuilder, 
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} = require('discord.js');
const db = require('../../database/database.js');
const { clientId, redirectUri, scopes, baseUrl } = require('../../../config.js');
const crypto = require('crypto');
// const client = require('../index.js'); // Removido na correção anterior

// ... (Funções buildPreviewEmbed e sendEmbedConfigMenu permanecem iguais) ...
function buildPreviewEmbed(config) {
    const embed = new EmbedBuilder()
        .setTitle(config?.title || 'Verifique-se')
        .setDescription(config?.description || 'Clique no botão abaixo para se verificar e ter acesso ao servidor.')
        .setColor(config?.color || '#5865F2')
        .setFooter({ text: 'PREVIEW - Esta é uma visualização.' });
    try {
        if (config?.image_url) embed.setImage(config.image_url);
        if (config?.thumbnail_url) embed.setThumbnail(config.thumbnail_url);
    } catch(e) { console.warn("URL de imagem/thumbnail inválida no preview:", e.message); }
    return embed;
}
async function sendEmbedConfigMenu(interaction) {
   const config = db.getEmbedConfig(interaction.guildId);
   const previewEmbed = buildPreviewEmbed(config);
   const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('embed_element_select')
      .setPlaceholder('Selecione um elemento da embed para editar')
      .addOptions(
          { label: 'Título', value: 'title', description: 'Muda o título da mensagem de AUTH', emoji: '🇹' },
          { label: 'Descrição', value: 'description', description: 'Muda a descrição da mensagem de AUTH', emoji: '📄' },
          { label: 'Cor (Hex)', value: 'color', description: 'Muda a cor da mensagem (Ex: #FFFFFF)', emoji: '🎨' },
          { label: 'Imagem (URL)', value: 'image_url', description: 'Muda a imagem principal (grande)', emoji: '🖼️' },
          { label: 'Thumbnail (URL)', value: 'thumbnail_url', description: 'Muda a imagem no canto (pequena)', emoji: '📌' },
          { label: 'Texto do Botão', value: 'button_text', description: 'Muda o texto do botão de verificação', emoji: '🔘' }
      );
   const buttons = new ActionRowBuilder()
      .addComponents(
          new ButtonBuilder().setCustomId('send_embed_button').setLabel('Enviar').setStyle(ButtonStyle.Success).setEmoji('▶️'),
          new ButtonBuilder().setCustomId('reset_embed_button').setLabel('Resetar').setStyle(ButtonStyle.Danger).setEmoji('🔄'),
      );
   await interaction.reply({
      content: 'Configure a mensagem que o usuário verá ao se autenticar.',
      embeds: [previewEmbed],
      components: [new ActionRowBuilder().addComponents(selectMenu), buttons],
      ephemeral: true
   });
}
// --- FIM DAS FUNÇÕES AUXILIARES ---


module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    
    // 1. Chat Input Command (só /auth)
    if (interaction.isChatInputCommand()) {
      // ... (Lógica do /auth não muda) ...
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: 'Houve um erro ao executar este comando!', ephemeral: true });
        } else {
          await interaction.reply({ content: 'Houve um erro ao executar este comando!', ephemeral: true });
        }
      }
      return;
    }

    // 2. Button Clicks
    if (interaction.isButton()) {
      const customId = interaction.customId;

      // --- Botão: Configurar Servidor (Não muda) ---
      if (customId === 'config_server_button') {
        // ... (Modal de Config não muda) ...
        const config = db.getConfig(interaction.guildId) || {};
        const mainGuildId = db.getMainGuild()?.value || interaction.guildId;
        const modal = new ModalBuilder().setCustomId('config_server_modal').setTitle('Configurar Servidores');
        const mainGuildInput = new TextInputBuilder().setCustomId('main_guild_id_input').setLabel('ID do Servidor Principal (para puxar)').setStyle(TextInputStyle.Short).setValue(mainGuildId).setRequired(true);
        const roleInput = new TextInputBuilder().setCustomId('role_id_input').setLabel('ID do Cargo de Verificado').setStyle(TextInputStyle.Short).setValue(config.verified_role_id || '').setPlaceholder('Ex: 108530... (deixe em branco para não dar cargo)').setRequired(false);
        const webhookInput = new TextInputBuilder().setCustomId('webhook_url_input').setLabel('URL do Webhook de Logs').setStyle(TextInputStyle.Short).setValue(config.log_webhook_url || '').setPlaceholder('https://discord.com/api/webhooks/...').setRequired(false);
        modal.addComponents(new ActionRowBuilder().addComponents(mainGuildInput), new ActionRowBuilder().addComponents(roleInput), new ActionRowBuilder().addComponents(webhookInput));
        await interaction.showModal(modal);
      }

      // --- Botão: Configurar Mensagem (Não muda) ---
      if (customId === 'config_message_button') {
        await sendEmbedConfigMenu(interaction);
      }

      // --- Botão: Criar Gift (MUDADO - Foto 2) ---
      if (customId === 'create_gift_button') {
        const userCount = db.getUserCount();
        const modal = new ModalBuilder()
          .setCustomId('create_gift_modal_v2') // Novo ID
          .setTitle('Generate Gifts Members');
        
        const membersInput = new TextInputBuilder()
          .setCustomId('member_count_input')
          .setLabel('QUAL QUANTIDADE DE MEMBROS ESSE GIFT TERÁ?')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(`Lembre-se: ${userCount} Membro(s) disponíveis.`)
          .setRequired(true);

        const amountInput = new TextInputBuilder()
          .setCustomId('gift_amount_input')
          .setLabel('QUANTOS GIFT(S) QUER GERAR?')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Exemplo: 3')
          .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(membersInput),
            new ActionRowBuilder().addComponents(amountInput)
        );
        await interaction.showModal(modal);
      }

      // --- Botão: Puxar Membros (MUDADO - Foto 1) ---
      // (Antigo sync_members_button)
      if (customId === 'push_members_button') { 
        const userCount = db.getUserCount();
        const modal = new ModalBuilder()
          .setCustomId('push_members_modal')
          .setTitle('Solicitação de Push');
        
        const guildIdInput = new TextInputBuilder()
          .setCustomId('guild_id_input')
          .setLabel('QUAL ID DO SERVIDOR DESEJA PUXAR?')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Qual id do servidor deseja puxar? EX: 124...')
          .setRequired(true);
        
        const amountInput = new TextInputBuilder()
          .setCustomId('amount_input')
          .setLabel('QUAL QUANTIDADE DESEJA PUXAR?')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(`Usuários disponíveis: ${userCount}`)
          .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(guildIdInput),
            new ActionRowBuilder().addComponents(amountInput)
        );
        await interaction.showModal(modal);
      }

      // --- Botões do Menu da Embed (Não mudam) ---
      if (customId === 'send_embed_button') {
        // ... (Modal de enviar não muda) ...
        const modal = new ModalBuilder().setCustomId('send_embed_channel_modal').setTitle('Enviar Mensagem de Auth');
        const channelInput = new TextInputBuilder().setCustomId('channel_id_input').setLabel('ID do Canal para enviar').setPlaceholder('Ex: 108530...').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(channelInput));
        await interaction.showModal(modal);
      }
      if (customId === 'reset_embed_button') {
        // ... (Reset não muda) ...
        db.resetEmbedConfig(interaction.guildId);
        const newEmbed = buildPreviewEmbed(null); 
        await interaction.update({ content: 'Configuração da embed resetada.', embeds: [newEmbed] });
      }
    }

    // 3. Modal Submissions
    if (interaction.isModalSubmit()) {
      const customId = interaction.customId;

      // --- Modal: Configurar Servidor (Não muda) ---
      if (customId === 'config_server_modal') {
        // ... (Lógica não muda) ...
        await interaction.deferReply({ ephemeral: true });
        const roleId = interaction.fields.getTextInputValue('role_id_input') || null;
        const webhookUrl = interaction.fields.getTextInputValue('webhook_url_input') || null;
        const mainGuildId = interaction.fields.getTextInputValue('main_guild_id_input');
        if (webhookUrl && !webhookUrl.startsWith('https://discord.com/api/webhooks/')) { return interaction.editReply('URL de Webhook inválida.'); }
        try { await interaction.client.guilds.fetch(mainGuildId); } catch { return interaction.editReply('ID do Servidor Principal inválido.'); }
        db.setConfig(interaction.guildId, roleId, webhookUrl);
        db.setMainGuild(mainGuildId);
        await interaction.editReply('Configurações salvas com sucesso!');
      }

      // --- Modal: Criar Gift (MUDADO - Lógica Foto 2) ---
      if (customId === 'create_gift_modal_v2') {
        await interaction.deferReply({ ephemeral: true });

        const memberCount = parseInt(interaction.fields.getTextInputValue('member_count_input'));
        const amount = parseInt(interaction.fields.getTextInputValue('gift_amount_input'));
        const userCount = db.getUserCount();

        if (isNaN(memberCount) || isNaN(amount) || memberCount <= 0 || amount <= 0) {
            return interaction.editReply({ content: 'Valores devem ser números maiores que zero.' });
        }
        if (amount > 20) {
            return interaction.editReply({ content: 'Você só pode gerar no máximo 20 links por vez.' });
        }
        if (memberCount > userCount) {
             return interaction.editReply({ content: `Você não tem membros suficientes. (Disponíveis: ${userCount})` });
        }

        const generatedLinks = [];
        for (let i = 0; i < amount; i++) {
            const code = crypto.randomBytes(8).toString('hex'); // Código mais longo
            try {
                db.createGift(code, memberCount, interaction.user.id);
                // MUDADO: Rota agora é /redeem/redeem/<code>
                generatedLinks.push(`${baseUrl}/redeem/redeem/${code} - ${memberCount} Membro(s)`);
            } catch (error) { i--; } 
        }
        
        // Envia links na DM (Foto 4)
        try {
            const dmChannel = await interaction.user.createDM();
            await dmChannel.send(`**Seus Links de Gift Gerados:**\n\n${generatedLinks.join('\n')}`);
            await interaction.editReply({ content: `Sucesso! Enviei ${amount} link(s) para sua DM.` });
        } catch (error) {
            console.error("Falha ao enviar DM:", error);
            await interaction.editReply({ content: 'Falha ao enviar DM. Verifique se suas DMs estão abertas.' });
        }
      }
      
      // --- Modal: Puxar Membros (MUDADO - Lógica Foto 1) ---
      if (customId === 'push_members_modal') {
          await interaction.deferReply({ ephemeral: true });

          const guildId = interaction.fields.getTextInputValue('guild_id_input');
          const amount = parseInt(interaction.fields.getTextInputValue('amount_input'));
          const userCount = db.getUserCount();

          if (isNaN(amount) || amount <= 0) {
               return interaction.editReply({ content: 'Quantidade inválida.' });
          }
          if (amount > userCount) {
               return interaction.editReply({ content: `Você não tem membros suficientes. (Disponíveis: ${userCount})` });
          }

          let guild;
          try {
              guild = await interaction.client.guilds.fetch(guildId);
          } catch {
              return interaction.editReply({ content: 'ID do Servidor inválido ou o bot não está nele.' });
          }

          const usersToPull = db.getRandomUsers(amount);
          let successCount = 0;
          let failCount = 0;

          // Aviso de processamento
          await interaction.editReply(`Iniciando o push de ${amount} membros para ${guild.name}. Isso pode levar um tempo...`);

          for (const user of usersToPull) {
              try {
                  await guild.members.add(user.user_id, {
                      accessToken: user.access_token
                  });
                  successCount++;
              } catch (error) {
                  // console.warn(`Falha ao puxar ${user.username}: ${error.message}`);
                  failCount++;
              }
          }
          
          await interaction.followUp({ content: `Push concluído!\n\n✅ Sucesso: ${successCount}\n❌ Falha (tokens expirados/banido): ${failCount}`, ephemeral: true });
      }

      // --- Modais de Configuração da Embed (Não mudam) ---
      if (customId.startsWith('embed_edit_modal_')) {
        // ... (Lógica não muda) ...
        const element = customId.replace('embed_edit_modal_', ''); 
        const value = interaction.fields.getTextInputValue('element_value_input');
        if (element === 'color' && value && !/^#[0-9A-F]{6}$/i.test(value)) { await interaction.reply({ content: 'Cor inválida. Use o formato Hex (Ex: #5865F2)', ephemeral: true }); return; }
        db.setEmbedConfigField(interaction.guildId, element, value || null); 
        const config = db.getEmbedConfig(interaction.guildId);
        const newEmbed = buildPreviewEmbed(config);
        await interaction.update({ embeds: [newEmbed] });
      }
      if (customId === 'send_embed_channel_modal') {
          // ... (Lógica não muda) ...
          await interaction.deferReply({ ephemeral: true });
          const channelId = interaction.fields.getTextInputValue('channel_id_input');
          const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
          if (!channel || channel.type !== ChannelType.GuildText) { return interaction.editReply('Canal de texto não encontrado ou inválido.'); }
          const config = db.getEmbedConfig(interaction.guildId);
          const embed = new EmbedBuilder().setTitle(config?.title || 'Verifique-se').setDescription(config?.description || 'Clique no botão abaixo para se verificar e ter acesso ao servidor.').setColor(config?.color || '#5865F2');
          try { if (config?.image_url) embed.setImage(config.image_url); if (config?.thumbnail_url) embed.setThumbnail(config.thumbnail_url); } catch(e) {/* Ignora */}
          const buttonText = config?.button_text || 'Verificar';
          const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}`;
          const button = new ButtonBuilder().setLabel(buttonText).setURL(oauthUrl).setStyle(ButtonStyle.Link).setEmoji('✅');
          const row = new ActionRowBuilder().addComponents(button);
          try { await channel.send({ embeds: [embed], components: [row] }); await interaction.editReply(`Mensagem de autenticação enviada para ${channel}!`); } catch (e) { console.error(e); await interaction.editReply('Erro ao enviar mensagem. Verifique se eu tenho permissão para falar nesse canal.'); }
      }
    }

    // 4. String Select Menu (Dropdown do editor de Embed)
    if (interaction.isStringSelectMenu()) {
      // ... (Lógica não muda) ...
      const customId = interaction.customId;
      if (customId === 'embed_element_select') {
        const elementToEdit = interaction.values[0]; 
        const config = db.getEmbedConfig(interaction.guildId) || {};
        const modal = new ModalBuilder().setCustomId(`embed_edit_modal_${elementToEdit}`).setTitle(`Editar: ${elementToEdit.charAt(0).toUpperCase() + elementToEdit.slice(1)}`);
        const input = new TextInputBuilder().setCustomId('element_value_input').setLabel('Novo valor (deixe vazio para remover)').setStyle(elementToEdit === 'description' ? TextInputStyle.Paragraph : TextInputStyle.Short).setValue(config[elementToEdit] || '').setPlaceholder(elementToEdit === 'color' ? '#5865F2' : '...').setRequired(false);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
      }
    }
  },
};
