// Importa os módulos necessários (mantenha os que você já tem)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: '*', // Permite qualquer origem (frontend local, Fly.io, etc.)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// --- Servir arquivos estáticos do frontend ---
// Como server.js está em /backend, subimos um nível para encontrar o index.html
app.use(express.static(path.join(__dirname, '..')));

// Carrega as credenciais: primeiro da variável de ambiente (Fly.io), depois do arquivo local (desenvolvimento)
let serviceAccount;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    // Remove BOM (Byte Order Mark) que o PowerShell/Windows pode adicionar
    const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON.replace(/^\uFEFF/, '').trim();
    serviceAccount = JSON.parse(raw);
    console.log('✅ Credenciais carregadas da variável de ambiente.');
} else {
    // Fallback para desenvolvimento local com arquivo
    try {
        serviceAccount = require('./serviceAccountKey.json');
        console.log('✅ Credenciais carregadas do arquivo local.');
    } catch (error) {
        console.error('❌ Nenhuma credencial encontrada no ambiente e nenhum arquivo local.');
        process.exit(1);
    }
}

// Inicializa o Firebase Admin com as credenciais carregadas
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
console.log('🔥 Firebase Admin inicializado com sucesso.');

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
