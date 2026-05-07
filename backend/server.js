require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Carrega a chave de serviço baixada
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
const port = process.env.PORT || 4000;

app.use(cors()); // permite requisições de qualquer origem (útil para desenvolvimento)
app.use(express.json());

// ROTAS (exemplo mínimo - você pode expandir)
app.get('/tarefas', async (req, res) => {
  try {
    const snapshot = await db.collection('tarefas').get();
    const tarefas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(tarefas);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/tarefas', async (req, res) => {
  try {
    const { titulo, coluna } = req.body;
    const docRef = await db.collection('tarefas').add({ titulo, coluna, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    res.status(201).json({ id: docRef.id, titulo, coluna });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.listen(process.env.PORT || 4000, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${process.env.PORT || 4000}`);
});