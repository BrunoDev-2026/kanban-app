// Importa os módulos necessários (mantenha os que você já tem)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
// --- As importações corretas para o Firebase Admin SDK moderno ---
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500'] // Permite o Live Server
}));
app.use(express.json());

// --- Servir arquivos estáticos do frontend ---
// Como server.js está em /backend, subimos um nível para encontrar o index.html
app.use(express.static(path.join(__dirname, '..')));

// --- Inicialização do Firebase ---
let serviceAccount;
try {
  // Tenta carregar as credenciais da variável de ambiente (Fly.io)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    console.log('✅ Credenciais carregadas da variável de ambiente.');
  } else if (require('fs').existsSync('./serviceAccountKey.json')) {
    // Fallback para o arquivo local durante o desenvolvimento
    serviceAccount = require('./serviceAccountKey.json');
    console.log('✅ Credenciais carregadas do arquivo local.');
  } else {
    throw new Error('Credenciais do Firebase não encontradas (Env ou Arquivo).');
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
app.get('/', (req, res) => {
  res.json({ 
    mensagem: "Kanban API está rodando!", 
    endpoints: ["/tarefas", "/health"] 
  });
});

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
    const {
      titulo,
      coluna,
      desc,
      date,
      tags,
      priority,
      checklist
    } = req.body;

    const docRef = await db.collection('tarefas').add({
      titulo,
      coluna,
      desc: desc || '',
      date: date || '',
      tags: Array.isArray(tags) ? tags : [],
      priority: priority || 'low',
      checklist: Array.isArray(checklist) ? checklist : [],
      createdAt: new Date()
    });

    res.status(201).json({
      id: docRef.id,
      titulo,
      coluna,
      desc: desc || '',
      date: date || '',
      tags: Array.isArray(tags) ? tags : [],
      priority: priority || 'low',
      checklist: Array.isArray(checklist) ? checklist : [],
      createdAt: new Date().toISOString()
    });
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
    const {
      titulo,
      coluna,
      desc,
      date,
      tags,
      priority,
      checklist
    } = req.body;

    const tarefaRef = db.collection('tarefas').doc(id);
    const doc = await tarefaRef.get();

    if (!doc.exists) {
      return res.status(404).json({ erro: 'Tarefa não encontrada' });
    }

    await tarefaRef.update({
      titulo,
      coluna,
      desc: desc || '',
      date: date || '',
      tags: Array.isArray(tags) ? tags : [],
      priority: priority || 'low',
      checklist: Array.isArray(checklist) ? checklist : []
    });

    res.json({
      id,
      titulo,
      coluna,
      desc: desc || '',
      date: date || '',
      tags: Array.isArray(tags) ? tags : [],
      priority: priority || 'low',
      checklist: Array.isArray(checklist) ? checklist : []
    });
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
