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
console.log("🔍 Carregando credenciais do Firebase da variável de ambiente...");

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  console.error("❌ ERRO CRÍTICO: GOOGLE_APPLICATION_CREDENTIALS_JSON não encontrada!");
  process.exit(1); // Encerra o app se a variável não existir
}

let serviceAccount = null;
try {
  serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
} catch (e) {
  console.error("❌ ERRO CRÍTICO: JSON inválido em GOOGLE_APPLICATION_CREDENTIALS_JSON", e.message);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
console.log("✅ Firebase Admin inicializado com sucesso!");


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