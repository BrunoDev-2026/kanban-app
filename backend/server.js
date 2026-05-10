require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cors    = require('cors');
const path    = require('path');
const admin   = require('firebase-admin');

const app  = express();
const port = process.env.PORT || 4000;

app.use(compression());

// Log de Origem CORS antes do middleware
app.use((req, res, next) => {
  console.log(`🔍 Chamada de API | Origem: ${req.headers.origin || 'Local/Desconhecido'} | Path: ${req.path}`);
  next();
});

app.use(cors({
  origin: [
    "https://kanban-app-p91q.onrender.com",
    "https://kanban-api-oozq.onrender.com"
  ]
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Carrega as credenciais: primeiro da variável de ambiente (Fly.io), depois do arquivo local (desenvolvimento)
let serviceAccount;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    // Remove BOM (Byte Order Mark) que o PowerShell/Windows pode adicionar
    const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON.replace(/^\uFEFF/, '').trim();
    serviceAccount = JSON.parse(raw);
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

// ===== API ROUTES =====

/**
 * Rota de Health Check detalhada
 * Verifica a integridade do processo e a conectividade com o Firestore
 */
app.get('/health', async (req, res) => {
  try {
    // Realiza uma consulta mínima para validar o acesso ao banco
    await db.collection('tarefas').limit(1).get();
    res.json({
      status: 'healthy',
      uptime: Math.floor(process.uptime()) + 's',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('🔴 Health Check Failure:', err.message);
    res.status(503).json({ status: 'unhealthy', database: 'error', error: err.message });
  }
});

app.get('/tarefas', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const snapshot = await db.collection('tarefas').get();
    const tarefas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(tarefas);
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
      titulo, coluna,
      desc: desc || '', date: date || '',
      tags: Array.isArray(tags) ? tags : [], priority: priority || 'low',
      checklist: Array.isArray(checklist) ? checklist : [],
      createdAt: new Date()
    });

    res.status(201).json({
      id: docRef.id, titulo, coluna,
      desc: desc || '', date: date || '',
      tags: Array.isArray(tags) ? tags : [], priority: priority || 'low',
      checklist: Array.isArray(checklist) ? checklist : [],
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
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
      id, titulo, coluna, desc: desc || '', date: date || '',
      tags: Array.isArray(tags) ? tags : [], priority: priority || 'low',
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
    res.setHeader('Cache-Control', 'no-store');
    await tarefaRef.delete();
    res.json({ mensagem: 'Tarefa removida com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: err.message });
  }
});

// Serve sw.js with no-cache headers to ensure it's always fresh
app.get('/sw.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.sendFile(path.join(__dirname, "..", "sw.js"));
});

// ===== FRONTEND STATIC FILES =====
// Serve arquivos estáticos (index.html, js/, css/)
app.use(express.static(path.join(__dirname, '..')));

// Fallback para SPA (Single Page Application)
app.get("*", (req, res) => {
  console.log("Serving index.html for path:", req.path);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

// --- Inicia o servidor escutando em todas as interfaces ---
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
