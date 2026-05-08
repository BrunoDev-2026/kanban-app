require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Configuração do Firebase Admin
let serviceAccount;
try {
  // Prioriza a variável de ambiente no Fly.io
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    console.log('✅ Credenciais carregadas da variável de ambiente.');
  } else {
    // Fallback para desenvolvimento local
    serviceAccount = require('./serviceAccountKey.json');
    console.log('✅ Credenciais carregadas do arquivo local.');
  }
} catch (error) {
  console.error('❌ Erro fatal ao configurar o Firebase:', error);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 🎯 Força o uso do banco de dados (default)
const db = admin.firestore('(default)');
console.log('🔥 Firestore conectado ao banco (default)');

// Rota de teste e listagem de tarefas
app.get('/tarefas', async (req, res) => {
  try {
    const colRef = db.collection('tarefas');
    const snapshot = await colRef.get();

    if (snapshot.empty) {
      console.log('Nenhuma tarefa encontrada. Retornando array vazio.');
      return res.status(200).json([]); // Garante resposta 200 com array vazio
    }

    const tarefas = [];
    snapshot.forEach(doc => {
      tarefas.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.status(200).json(tarefas);
  } catch (error) {
    console.error('Erro ao buscar tarefas:', error);
    res.status(500).json({ erro: 'Erro interno ao buscar tarefas.', details: error.message });
  }
});

// 🔥 NOVA: Rota de teste simples (apenas para verificar se o servidor está online)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
  console.log(`🔗 Acesse: http://localhost:${port}/tarefas`);
});