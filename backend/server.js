require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Carrega as credenciais da variável de ambiente (Fly.io) ou do arquivo local
let credentials;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  try {
    credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    console.log('✅ Credenciais carregadas da variável GOOGLE_APPLICATION_CREDENTIALS_JSON');
  } catch (err) {
    console.error('❌ Erro ao parsear GOOGLE_APPLICATION_CREDENTIALS_JSON:', err.message);
    process.exit(1);
  }
} else {
  try {
    credentials = require('./serviceAccountKey.json');
    console.log('✅ Credenciais carregadas do arquivo local');
  } catch (err) {
    console.error('❌ Nenhuma credencial encontrada. Defina GOOGLE_APPLICATION_CREDENTIALS_JSON');
    process.exit(1);
  }
}

// Inicializa o Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(credentials)
});
const db = admin.firestore();
console.log('🔥 Firebase Admin inicializado');

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

// Rota para criar tarefa (exemplo)
app.post('/tarefas', async (req, res) => {
  try {
    const { titulo, coluna } = req.body;
    const docRef = await db.collection('tarefas').add({
      titulo,
      coluna,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.status(201).json({ id: docRef.id, titulo, coluna });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ⚠️ ESCUTA EM 0.0.0.0 (obrigatório para Fly.io)
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});