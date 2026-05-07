require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 4000;

// CORS - permite todas as origens (desenvolvimento)
app.use(cors());
app.use(express.json());

// Carrega credenciais do Firebase
let serviceAccount;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  console.log('✅ Credenciais carregadas da variável de ambiente');
} else {
  try {
    serviceAccount = require('./serviceAccountKey.json');
    console.log('✅ Credenciais carregadas do arquivo local');
  } catch (err) {
    console.error('❌ Falha ao carregar credenciais do Firebase:', err.message);
    process.exit(1);
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Rota de teste
app.get('/tarefas', async (req, res) => {
  try {
    const snapshot = await db.collection('tarefas').get();
    const tarefas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(tarefas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: err.message });
  }
});

// 🚨 IMPORTANTE: escutar em '0.0.0.0' e porta correta
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});