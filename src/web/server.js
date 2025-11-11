const express = require('express');
const path = require('path');
const config = require('../../config.js');
const { dbWrapper } = require('../database/database.js'); // Importa o dbWrapper

const app = express();
const PORT = config.port; // Usa a porta do config.js

// Middleware para processar JSON (necessário para a rota /redeem/pull)
app.use(express.json());

// Servir arquivos estáticos (CSS, HTML, etc. da pasta 'public')
// O 'express.static' procura automaticamente por 'index.html' na raiz '/'
app.use(express.static(path.join(__dirname, 'public')));

// --- ROTA DE HEALTH CHECK (NOVA) ---
// O UptimeRobot vai "pingar" esta rota.
// Ela força uma verificação no banco de dados para manter TUDO acordado.
app.get('/health', async (req, res) => {
    // 1. Verifica a conexão com o MongoDB
    const dbOk = await dbWrapper.pingDb();

    if (dbOk) {
        // Se tudo estiver OK, retorna 200
        res.status(200).json({ status: 'ok', database: 'connected' });
    } else {
        // Se o DB falhar, retorna 503 (Serviço Indisponível)
        // O UptimeRobot pode (opcionalmente) te alertar sobre isso.
        res.status(503).json({ status: 'error', database: 'disconnected' });
    }
});
// --- FIM DA ROTA HEALTH CHECK ---


// Rota de autenticação OAuth2 (ex: /auth/callback)
const authRoutes = require('./routes/auth.js');
app.use('/auth', authRoutes);

// Rota de resgate de Gift (ex: /redeem/redeem/...)
const redeemRoutes = require('./routes/redeem.js');
app.use('/redeem', redeemRoutes);

// Rota "Catch-all" para 404 (Página não encontrada)
app.use((req, res) => {
    res.status(404).send('Página não encontrada.');
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor Web rodando em http://localhost:${PORT} (ou na porta ${PORT} do Render)`);
});

module.exports = app;