const express = require('express');
const path = require('path');
const { port } = require('../../config.js');

const app = express();

// --- ADICIONADO ---
// Permite que o servidor entenda JSON vindo do body de um POST/PUT
app.use(express.json());
// ------------------

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Rotas
const authRoutes = require('./routes/auth.js');
const redeemRoutes = require('./routes/redeem.js');

app.use('/auth', authRoutes);
app.use('/redeem', redeemRoutes);

// Rota principal (apenas para teste)
app.get('/', (req, res) => {
  res.send('Servidor do Bot de Autenticação está no ar!');
});

app.listen(port, () => {
  console.log(`Servidor Web rodando em http://localhost:${port}`);
});

module.exports = app;
