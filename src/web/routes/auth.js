const router = require('express').Router();
const axios = require('axios');
const { clientId, clientSecret, redirectUri, scopes } = require('../../../config.js');
const { dbWrapper } = require('../../database/database.js');
const { WebhookClient, EmbedBuilder } = require('discord.js');
const botClient = require('../../bot/index.js');

// Rota de callback
router.get('/callback', async (req, res) => {
  const { code, state } = req.query; 

  if (!code) {
    return res.redirect('/invalid-code.html?error=cancelled');
  }

  // Tenta validar o 'state' para segurança
  const authState = await dbWrapper.getAuthState(state);
  if (!authState) {
      console.warn("Auth state inválido ou expirado recebido.");
      // Não vaza o erro, apenas redireciona
      return res.redirect('/invalid-code.html?error=expired');
  }
  
  try {
    // 1. Trocar o código por um Access Token
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        scope: scopes.join(' '),
      }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token, refresh_token } = tokenResponse.data;

    // 2. Obter informações do usuário
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { 'Authorization': `Bearer ${access_token}` },
    });

    const user = userResponse.data;
    
    // Verifica se o ID do usuário bate com o state (segurança)
    if (user.id !== authState.userId) {
        console.warn(`Disparidade de usuário no Auth State! Esperado ${authState.userId}, recebido ${user.id}.`);
        return res.redirect('/invalid-code.html?error=mismatch');
    }

    // 3. Salvar usuário no banco de dados
    await dbWrapper.addUser(user.id, user.username, access_token, refresh_token);

    // 4. "Puxar" o membro para o servidor principal e adicionar o cargo
    // CORRIGIDO: Usa a nova função getBotConfig()
    const config = await dbWrapper.getBotConfig();
    const mainGuildId = config?.mainGuildId;
    const roleId = config?.verifiedRoleId;
    
    // Tenta adicionar ao servidor de onde o clique veio (se não for o principal)
    const originalGuildId = authState.guildId;
    
    // Lista de servidores para tentar adicionar (primeiro o original, depois o principal)
    // Remove duplicatas se forem o mesmo
    const guildsToAdd = [...new Set([originalGuildId, mainGuildId].filter(Boolean))];

    for (const guildId of guildsToAdd) {
        try {
            const guild = await botClient.guilds.fetch(guildId);
            const member = await guild.members.fetch(user.id).catch(() => null);

            let rolesToAdd = [];
            // Adiciona o cargo de verificado APENAS se estivermos no servidor principal
            if (guildId === mainGuildId && roleId) {
                rolesToAdd.push(roleId);
            }

            if (member) {
                // Usuário já está no servidor, apenas adiciona o cargo (se houver)
                if (rolesToAdd.length > 0) {
                    await member.roles.add(rolesToAdd);
                }
            } else {
                // Usuário não está no servidor, usa o 'guilds.join'
                await guild.members.add(user.id, {
                    accessToken: access_token,
                    roles: rolesToAdd
                });
            }

            // 5. Enviar Log (Apenas para o servidor principal)
            if (guildId === mainGuildId && config.logsWebhookUrl) {
                const webhook = new WebhookClient({ url: config.logsWebhookUrl });
                const embed = new EmbedBuilder()
                    .setTitle('✅ Novo Membro Verificado!')
                    .setColor('#00FF00')
                    .setDescription(`${user.username} (\`${user.id}\`) foi verificado com sucesso.`)
                    .setThumbnail(`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`)
                    .addFields({ name: 'Servidor de Origem', value: `${originalGuildId}` })
                    .setTimestamp();
                await webhook.send({ embeds: [embed] });
            }

        } catch (error) {
            console.error(`Erro ao adicionar membro ${user.username} ao servidor ${guildId}:`, error.message);
        }
    }

    // 6. Redirecionar para a página de sucesso
    res.redirect('/auth-success.html');

  } catch (error) {
    console.error("Erro no fluxo OAuth:", error.response?.data || error.message);
    res.status(500).send('Ocorreu um erro durante a autenticação.');
  }
});

module.exports = router;
