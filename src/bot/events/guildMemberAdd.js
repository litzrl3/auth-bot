const { Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { dbWrapper } = require('../../database/database.js'); 
const { clientId, redirectUri, scopes } = require('../../../config.js');
const { v4: uuidv4 } = require('uuid'); // Importa o uuid

module.exports = {
	name: Events.GuildMemberAdd,
	async execute(member) {
        // CORRIGIDO: Usa a nova função getBotConfig()
        const config = await dbWrapper.getBotConfig();
        const mainGuildId = config?.mainGuildId;
        const roleId = config?.verifiedRoleId;

        if (member.guild.id !== mainGuildId) {
            return; // Ignora se não for o servidor principal
        }

        const existingUser = await dbWrapper.getUser(member.id);
        if (existingUser) {
            console.log(`Membro ${member.user.tag} já verificado, adicionando cargo...`);
            
            if (roleId) {
                try {
                    const role = await member.guild.roles.fetch(roleId);
                    if (role) {
                        await member.roles.add(role);
                    }
                } catch (error) {
                    console.error("Erro ao adicionar cargo para membro que re-entrou:", error);
                }
            }
            return;
        }

        // Se não estiver verificado, envia DM para verificação (Puxar Membro)
        try {
            // Gera um state para o link de DM
            const state = uuidv4(); 
            await dbWrapper.saveAuthState(state, member.id, member.guild.id);

            const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}&state=${state}`;

            const embed = new EmbedBuilder()
                .setTitle(`Bem-vindo(a) ao ${member.guild.name}!`)
                .setDescription(`Para ter acesso completo ao servidor, por favor, verifique sua conta clicando no botão abaixo.`)
                .setColor('#5865F2')
                .setThumbnail(member.guild.iconURL())
                .setTimestamp();

            const button = new ButtonBuilder()
                .setLabel('Verificar Conta')
                .setURL(oauthUrl)
                .setStyle(ButtonStyle.Link)
                .setEmoji('✅');

            const row = new ActionRowBuilder().addComponents(button);

            await member.send({ embeds: [embed], components: [row] });
            console.log(`DM de verificação enviada para ${member.user.tag}`);

        } catch (error) {
            console.error(`Não foi possível enviar DM de verificação para ${member.user.tag}.`, error.message);
        }
	},
};
