const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(
  cors({
    origin: true, // permite Netlify + qualquer origin (ajustável via env)
    credentials: false
  })
);
app.use(express.json());

// Teste de conexão direta simplificada
const mongoURI = "mongodb://lifemarinabuchadt_db_user:1QZ1OJCQbMfqGRUG@cluster0-shard-00-00.qtfxwgd.mongodb.net:27017/kanban?ssl=true&authSource=admin";


mongoose.connect(mongoURI)
  .then(() => console.log("✅ Conectado ao MongoDB Atlas com sucesso!"))
  .catch(err => {
    console.error("❌ Erro ao conectar ao MongoDB:");
    console.error(err.message);
  });

// Schema e Model
const TarefaSchema = new mongoose.Schema({
  titulo: { type: String, required: true },
  coluna: { type: String, required: true }, // ex: 'fazer', 'andamento', 'feito'
  dataCriacao: { type: Date, default: Date.now }
});


const Tarefa = mongoose.model('Tarefa', TarefaSchema);

// --- ROTAS /tarefas ---

// GET: Buscar todas as tarefas
app.get('/tarefas', async (req, res) => {
  try {
    const tarefas = await Tarefa.find().sort({ dataCriacao: 1 });
    res.json(tarefas);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar tarefas' });
  }
});

// POST: Criar nova tarefa ou atualizar (se receber um ID no body)
app.post('/tarefas', async (req, res) => {
  try {
    const { id, titulo, coluna } = req.body;

    if (!titulo || !coluna) {
      return res.status(400).json({ error: 'Campos obrigatórios: titulo e coluna' });
    }

    if (id) {
      // Atualiza campos
      const tarefaAtualizada = await Tarefa.findByIdAndUpdate(
        id,
        { titulo, coluna },
        { new: true }
      );

      if (!tarefaAtualizada) {
        return res.status(404).json({ error: 'Tarefa não encontrada para atualização' });
      }

      return res.json(tarefaAtualizada);
    }

    // Cria nova tarefa
    const novaTarefa = new Tarefa({ titulo, coluna });
    await novaTarefa.save();
    return res.status(201).json(novaTarefa);
  } catch (err) {
    return res.status(400).json({ error: 'Erro ao salvar tarefa' });
  }
});

// DELETE: Remover uma tarefa
app.delete('/tarefas/:id', async (req, res) => {
  try {
    const deleted = await Tarefa.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    return res.json({ message: 'Tarefa removida com sucesso' });
  } catch (err) {
    return res.status(404).json({ error: 'Tarefa não encontrada' });
  }
});

// Porta dinâmica para o Railway
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

