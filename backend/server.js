// Importa os módulos necessários (mantenha os que você já tem)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
// --- As importações corretas para o Firebase Admin SDK moderno ---
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// --- Inicialização do Firebase ---
let serviceAccount;
try {
  // Tenta carregar as credenciais da variável de ambiente (Fly.io)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    console.log('✅ Credenciais carregadas da variável de ambiente.');
  } else {
    // Fallback para o arquivo local durante o desenvolvimento
    serviceAccount = require('./serviceAccountKey.json');
    console.log('✅ Credenciais carregadas do arquivo local.');
  }
} catch (error) {
  console.error('❌ Erro fatal ao carregar as credenciais:', error);
  process.exit(1);
}

// Inicializa o app do Firebase Admin
const firebaseApp = initializeApp({
  credential: cert(serviceAccount)
});

// Obtém a instância do Firestore para o banco de dados '(default)'
// Esta é a sintaxe moderna e correta
const db = getFirestore(firebaseApp, '(default)');
console.log('🔥 Firebase Admin inicializado e conectado ao banco (default).');

// --- Suas rotas da API (mantenha como estão) ---
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

app.post('/tarefas', async (req, res) => {
  try {
    const { titulo, coluna } = req.body;
    const docRef = await db.collection('tarefas').add({
      titulo,
      coluna,
      createdAt: new Date()
    });
    res.status(201).json({ id: docRef.id, titulo, coluna });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// PUT /tarefas/:id – atualizar uma tarefa existente
app.put('/tarefas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, coluna } = req.body;

    const tarefaRef = db.collection('tarefas').doc(id);
    const doc = await tarefaRef.get();

    if (!doc.exists) {
      return res.status(404).json({ erro: 'Tarefa não encontrada' });
    }

    await tarefaRef.update({ titulo, coluna });
    res.json({ id, titulo, coluna });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: err.message });
  }
});

// DELETE /tarefas/:id – remover uma tarefa
app.delete('/tarefas/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const tarefaRef = db.collection('tarefas').doc(id);
    const doc = await tarefaRef.get();

    if (!doc.exists) {
      return res.status(404).json({ erro: 'Tarefa não encontrada' });
    }

    await tarefaRef.delete();
    res.json({ mensagem: 'Tarefa removida com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: err.message });
  }
});

// --- Inicia o servidor escutando em todas as interfaces ---
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
