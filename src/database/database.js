const { MongoClient } = require('mongodb');
const config = require('../../config');

let db;
let collections = {};

// Função centralizada para conectar ao DB
async function connectDb() {
    if (db) return db;

    try {
        const client = new MongoClient(config.mongodbUri);
        await client.connect();
        db = client.db(); // Usa o banco de dados padrão da URI
        console.log('MongoDB conectado com sucesso.');

        // Inicializa as coleções que o bot usa
        collections.users = db.collection('users');
        collections.config = db.collection('config');
        collections.gifts = db.collection('gifts');
        collections.authStates = db.collection('authStates');

        // Garante a configuração de expiração (TTL) para os authStates
        // Isso remove automaticamente documentos após 1 hora (3600 segundos)
        const authStates = collections.authStates;
        
        // Verifica se o índice já existe com o nome correto
        const indexes = await authStates.indexes();
        const ttlIndexExists = indexes.some(index => index.name === "createdAt_1_ttl");

        if (!ttlIndexExists) {
            try {
                // Tenta remover índices antigos (se houver algum com nome padrão)
                await authStates.dropIndex("createdAt_1").catch(e => console.log("Índice createdAt_1 (antigo) não encontrado, ignorando."));
            } catch (e) {
                 console.log("Nenhum índice antigo para limpar.");
            }
            // Cria o novo índice TTL
            await authStates.createIndex(
                { "createdAt": 1 }, 
                { expireAfterSeconds: 3600, name: "createdAt_1_ttl" }
            );
            console.log('Índice TTL de 1 hora para authStates garantido.');
        }


        // Inicializa a configuração padrão do bot se não existir
        const botConfig = await collections.config.findOne({ _id: 'botConfig' });
        if (!botConfig) {
            console.log('Nenhuma configuração encontrada. Criando configuração padrão...');
            await collections.config.insertOne({
                _id: 'botConfig',
                mainGuildId: null,
                logChannelWebhook: null,
                verifiedRoleId: null,
                embedConfig: {
                    title: 'Verificação do Servidor',
                    description: 'Clique no botão abaixo para se verificar.',
                    color: '#0099ff',
                    buttonLabel: 'Verificar-se',
                    buttonEmoji: '✅'
                }
            });
        }
        return db;
    } catch (error) {
        console.error('Falha ao conectar ao MongoDB:', error);
        process.exit(1); // Para a aplicação se não conseguir conectar ao DB
    }
}

// Wrapper do banco de dados para ser usado em outros arquivos
const dbWrapper = {
    // --- Funções de Configuração ---
    getBotConfig: async () => {
        if (!collections.config) await connectDb();
        return collections.config.findOne({ _id: 'botConfig' });
    },
    saveBotConfig: async (configData) => {
        if (!collections.config) await connectDb();
        return collections.config.updateOne(
            { _id: 'botConfig' },
            { $set: configData },
            { upsert: true }
        );
    },
     // Função para a embed (separada para facilitar)
     getEmbedConfig: async () => {
        if (!collections.config) await connectDb();
        const config = await collections.config.findOne({ _id: 'botConfig' });
        return config.embedConfig; // Retorna apenas a parte da embed
    },
    saveEmbedConfig: async (embedData) => {
        if (!collections.config) await connectDb();
        return collections.config.updateOne(
            { _id: 'botConfig' },
            { $set: { embedConfig: embedData } }
            // Não usa upsert aqui, pois a config principal já deve existir
        );
    },


    // --- Funções de Usuário ---
    getTotalUsers: async () => {
        if (!collections.users) await connectDb();
        return collections.users.countDocuments();
    },
    getUser: async (userId) => {
        if (!collections.users) await connectDb();
        return collections.users.findOne({ _id: userId });
    },
    saveUser: async (userData) => {
        if (!collections.users) await connectDb();
        return collections.users.updateOne(
            { _id: userData.id }, // O ID do usuário do Discord é o _id
            {
                $set: {
                    username: userData.username,
                    accessToken: userData.accessToken,
                    refreshToken: userData.refreshToken,
                    expiresIn: userData.expiresIn,
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );
    },
    getRandomUsers: async (count) => {
        if (!collections.users) await connectDb();
        // $sample é o método aggregate do MongoDB para pegar documentos aleatórios
        return collections.users.aggregate([{ $sample: { size: count } }]).toArray();
    },

    // --- Funções de Auth State ---
    saveAuthState: async (state, userId = '@everyone', guildId) => {
        if (!collections.authStates) await connectDb();
        return collections.authStates.insertOne({
            _id: state,
            userId: userId,
            guildId: guildId, // Salva o ID do servidor
            createdAt: new Date()
        });
    },
    getAuthState: async (state) => {
        if (!collections.authStates) await connectDb();
        // O findOneAndDelete é atômico, garante que o state só seja usado uma vez
        const doc = await collections.authStates.findOneAndDelete({ _id: state });
        return doc; // Retorna o documento encontrado (ou null)
    },

    // --- Funções de Gift ---
    createGift: async (code, memberCount) => {
        if (!collections.gifts) await connectDb();
        return collections.gifts.insertOne({
            _id: code,
            member_count: memberCount,
            is_used: false,
            createdAt: new Date()
        });
    },
    getGift: async (code) => {
        if (!collections.gifts) await connectDb();
        return collections.gifts.findOne({ _id: code });
    },
    useGift: async (code) => {
        if (!collections.gifts) await connectDb();
        // Marca o gift como usado
        const result = await collections.gifts.updateOne(
            { _id: code, is_used: false }, // Condição atômica
            { $set: { is_used: true, usedAt: new Date() } }
        );
        return result.modifiedCount > 0; // Retorna true se foi modificado
    },

    // --- NOVA FUNÇÃO DE HEALTH CHECK ---
    pingDb: async () => {
        if (!db) await connectDb();
        try {
            // 'ping' é o comando mais leve para verificar a conexão
            await db.command({ ping: 1 });
            return true;
        } catch (error) {
            console.error("Ping do MongoDB falhou:", error);
            return false;
        }
    }
};

module.exports = { connectDb, dbWrapper };