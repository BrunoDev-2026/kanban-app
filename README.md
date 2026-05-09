# <p align="center">MB FlowBoard 🚀</p>

<p align="center">
  <img src="assets/images/banner.png" alt="MB FlowBoard Banner" width="100%">
</p>

<p align="center">
  <strong>Seu quadro pessoal Kanban com foco, produtividade e controle total.</strong>
</p>

<p align="center">
  <a href="https://github.com/BrunoDev-2026/kanban-app">
    <img src="https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub">
  </a>
  &nbsp;
  <a href="https://www.linkedin.com/in/bruno-david-de-oliveira-buchardt-721643246">
    <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn">
  </a>
</p>

---

## 🖼️ Sistemas e Funcionalidades

<p align="center">
  <img src="assets/images/flowboard-features.png" alt="MB FlowBoard - Sistemas e Funcionalidades" width="100%">
</p>

---

## ✨ Visão Geral

O **MB FlowBoard** é uma aplicação de gerenciamento de tarefas premium, projetada com estética moderna e foco total na experiência do usuário. Desenvolvido com tecnologias web nativas e backend Node.js + Firebase, oferece um ambiente fluido para organizar seu trabalho com eficiência e estilo.

> [!NOTE]
> Projeto desenvolvido com **JavaScript Vanilla** no frontend e **Node.js + Express + Firebase Firestore** no backend, com deploy no **Render.com**.

---

## 🚀 Principais Recursos

| Funcionalidade | Descrição |
|---|---|
| 🎯 **Quadro Kanban** | Colunas personalizáveis com limite WIP |
| ⚡ **Drag & Drop** | Mova tarefas entre colunas intuitivamente |
| ⏲️ **Pomodoro Timer** | Ciclos de foco personalizáveis |
| ✅ **Checklist** | Listas de verificação dentro das tarefas |
| 🏷️ **Etiquetas (Tags)** | Categorize tarefas com tags personalizadas |
| 🔴 **Prioridades** | Baixa, Média e Alta prioridade |
| 📅 **Prazos** | Alertas visuais de vencimento |
| 🔍 **Filtros e Busca** | Filtre por prioridade, tag ou data |
| 📊 **Dashboard** | Métricas visuais de produtividade |
| 👤 **Perfil de Usuário** | Avatar, nome, cor e preferências do timer |
| 📦 **Arquivo** | Archive tarefas concluídas |
| 💾 **Exportar / Imprimir** | Exporte em JSON ou imprima offline |
| 📱 **PWA** | Instale como app no celular ou desktop |

---

## 🛠️ Tecnologias Utilizadas

**Frontend**
- **HTML5** — Estrutura semântica e acessível
- **CSS3** — Grid, Flexbox, Variáveis, Animações e Glassmorphism
- **JavaScript ES6+** — Lógica modular e interatividade
- **LocalStorage API** — Persistência local de metadados
- **Lucide Icons** — Ícones modernos
- **Google Fonts** — Tipografia premium

**Backend**
- **Node.js + Express** — API REST
- **Firebase Firestore** — Banco de dados em nuvem
- **Render.com** — Hospedagem do servidor

---

## 🏗️ Estrutura de Pastas

```text
kanban-app/
├── assets/          # Recursos visuais (imagens, ícones, logos)
├── backend/         # Servidor Node.js + Express + Firebase
│   ├── server.js    # API REST principal
│   └── package.json
├── css/             # Estilização modularizada
├── js/              # Lógica da aplicação em módulos
│   ├── app.js       # Orquestrador principal
│   ├── api.js       # Camada de comunicação com o backend
│   ├── storage.js   # Persistência localStorage
│   ├── tasks.js     # Gestão de tarefas e colunas
│   ├── dragdrop.js  # Drag & Drop nativo
│   ├── dashboard.js # Dashboard de métricas
│   └── utils.js     # Utilitários e sanitização XSS
├── manifest.json    # PWA manifest
├── sw.js            # Service Worker
├── index.html       # Entrada principal
└── README.md        # Documentação
```

---

## ⚙️ Como Rodar Localmente

**1. Clone o repositório:**
```bash
git clone https://github.com/BrunoDev-2026/kanban-app.git
cd kanban-app
```

**2. Configure o backend:**
```bash
cd backend
npm install
```

**3. Crie o arquivo de credenciais Firebase:**
Coloque o arquivo `serviceAccountKey.json` dentro da pasta `backend/`.

**4. Inicie o servidor:**
```bash
node server.js
```

**5. Abra o frontend:**
Abra o arquivo `index.html` no navegador ou use o Live Server do VS Code.

---

## 🌐 Deploy

| Serviço | URL |
|---|---|
| **Backend (API)** | https://kanban-app-ff84.onrender.com |
| **Health Check** | https://kanban-app-ff84.onrender.com/health |

> ⚠️ O plano gratuito do Render hiberna após 15 minutos de inatividade. A primeira requisição pode demorar até 50 segundos para "acordar" o servidor.

---

## 👨‍💻 Desenvolvido por

<p align="center">
  <strong>Bruno Oliveira — MB Tech</strong><br>
  <em>Tecnologia · Foco · Produtividade</em>
</p>

<p align="center">
  <a href="https://github.com/BrunoDev-2026/kanban-app">
    <img src="https://img.shields.io/badge/GitHub-kanban--app-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Repositório">
  </a>
  &nbsp;
  <a href="https://www.linkedin.com/in/bruno-david-de-oliveira-buchardt-721643246">
    <img src="https://img.shields.io/badge/LinkedIn-Bruno%20Oliveira-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn">
  </a>
</p>

---

<p align="center">
  <em>"Esse projeto está em constante evolução. Novas funcionalidades e melhorias estão a caminho!"</em><br>
  <strong>EVOLUIR É O PLANO. 🚀</strong>
</p>
