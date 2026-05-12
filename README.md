# MB FlowBoard

<p align="center">
  <img src="assets/logo/logo.png" alt="MB FlowBoard Logo" width="220" />
</p>

<p align="center">
  <strong>Quadro Kanban pessoal, PWA offline-first, com drag & drop, métricas, foco Pomodoro e sincronização automática.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/versão-2.0.0-6C63FF?style=flat-square" />
  <img src="https://img.shields.io/badge/PWA-offline--first-43D9AD?style=flat-square" />
  <img src="https://img.shields.io/badge/JS-Vanilla%20Modular-FFB347?style=flat-square" />
  <img src="https://img.shields.io/badge/deploy-Render-4FC3F7?style=flat-square" />
</p>

---

## ✨ Funcionalidades

| Recurso | Descrição |
|---|---|
| 🗂️ **Kanban Drag & Drop** | Arraste cards entre colunas, reordene com suporte touch/mobile |
| 📊 **Dashboard de Métricas** | Gráficos de produtividade, distribuição por prioridade, gargalos |
| 🎯 **Focus Mode / Pomodoro** | Timer Pomodoro integrado por card, ciclos longos e curtos |
| 📴 **Offline-first** | Funciona sem internet via Service Worker + Outbox Pattern |
| 🔄 **Sync Automático** | Retry com exponential backoff, resolução de conflitos |
| 👤 **Avatar com Crop** | Upload de foto, recorte estilo LinkedIn, compressão automática |
| 🏷️ **Tags** | Etiquetas por cor determinística, filtro em tempo real |
| 💾 **Export** | Exporta o quadro completo como JSON |
| 📦 **Archive** | Arquiva e restaura tarefas com histórico |
| ↩️ **Undo / Redo** | Desfaz/refaz qualquer ação (até 50 passos) |
| 🔍 **Busca** | Pesquisa em tempo real com debounce (título, descrição, tags) |
| 🎛️ **Filtros** | Por prioridade, data exata, tag |
| ✅ **Checklist** | Subtarefas com progresso visual por card |
| 🖥️ **Multi-device** | Sincronização entre dispositivos via API REST |
| 📲 **PWA Instalável** | Instale no celular ou desktop como app nativo |
| 🌙 **Tema Escuro/Claro** | Toggle de tema salvo no localStorage |
| ⌨️ **Atalhos de Teclado** | N (nova tarefa), F (busca), L (vista), Ctrl+S, Ctrl+Z/Y, ESC |
| 🖨️ **Impressão** | Layout otimizado para print |
| ⚠️ **WIP Limit** | Limite de tarefas por coluna com feedback visual |

---

## 🛠️ Tecnologias

| Camada | Stack |
|---|---|
| **Frontend** | HTML5, CSS3 Modular, JavaScript Vanilla ES2022 |
| **PWA** | Service Workers, Web App Manifest, Cache API |
| **Offline** | Outbox Pattern, Exponential Backoff, Conflict Resolution |
| **Áudio** | Web Audio API (feedback sonoro) |
| **Gráficos** | Chart.js |
| **Ícones** | Lucide Icons |
| **Backend** | Node.js REST API (Render) |
| **Deploy** | Render (frontend + backend) |
| **Versionamento** | GitHub |

---

## 📁 Estrutura do Projeto

```
kanban-app/
├── index.html              # App shell principal
├── offline.html            # Fallback offline
├── sw.js                   # Service Worker (PWA)
├── manifest.json           # Web App Manifest
├── css/
│   ├── main.css            # Variáveis, reset, layout base
│   ├── animations.css      # Keyframes e transições
│   ├── board.css           # Estilos do board e cards
│   ├── components.css      # Modais, botões, header, footer
│   ├── dashboard.css       # Dashboard de métricas
│   └── responsive.css      # Breakpoints 1440/1024/768/520/480/360px
├── js/
│   ├── app.js              # Orquestrador principal (fonte da verdade)
│   ├── api.js              # Camada HTTP (fetch wrapper)
│   ├── config.js           # Constantes e versão do app
│   ├── storage.js          # localStorage + Undo/Redo
│   ├── sync.js             # Outbox, retry, health check da API
│   ├── dragdrop.js         # Drag & Drop HTML5 + fallback touch
│   ├── tasks.js            # CRUD de cards e colunas
│   ├── filters.js          # Filtros e busca
│   ├── dashboard.js        # Renderização de métricas e gráficos
│   ├── metrics-logic.js    # Cálculo de métricas (compartilhado com Worker)
│   ├── metricsWorker.js    # Web Worker para cálculos pesados
│   ├── notifications.js    # Toast, HUD, Web Audio, notificações
│   ├── shortcuts.js        # Atalhos de teclado globais
│   ├── avatar.js           # Upload, crop e perfil do usuário
│   ├── tags.js             # Sistema de tags e cores
│   └── utils.js            # Funções utilitárias (uid, escape, debounce...)
└── assets/
    └── logo/
        └── logo.png
```

---

## 🚀 Como Rodar

### Pré-requisitos
- Node.js 18+
- Git

### Instalação local

```bash
git clone https://github.com/BrunoDev-2026/kanban-app.git
cd kanban-app
npm install
npm run dev
```

O app estará disponível em `http://localhost:3000`.

### Deploy (Render)

O projeto faz deploy automático via GitHub. Qualquer push na branch `main` dispara o pipeline.

---

## ⌨️ Atalhos de Teclado

| Tecla | Ação |
|---|---|
| `N` | Nova tarefa (na primeira coluna) |
| `F` | Focar na busca |
| `L` | Alternar vista (Quadro / Lista) |
| `Alt + C` | Nova coluna |
| `Ctrl + S` | Salvar manualmente |
| `Ctrl + Z` | Desfazer |
| `Ctrl + Shift + Z` | Refazer |
| `ESC` | Fechar modal / Limpar filtros |

---

## 🏗️ Arquitetura

```
API REST (Fonte da Verdade)
       │
       ▼
  app.js (Orquestrador)
       │
  ┌────┴──────────────────────────┐
  │                               │
storage.js                    sync.js
(localStorage + Undo/Redo)    (Outbox + Retry)
  │                               │
  └────────────┬──────────────────┘
               │
          render() ← dragdrop.js · tasks.js · filters.js
```

**Regras de modularidade:**
- `app.js` é a **única fonte de verdade** para render e estado global
- `dragdrop.js` cuida exclusivamente de eventos de drag & drop
- `tasks.js` cuida exclusivamente de CRUD de cards/colunas
- `shortcuts.js` cuida exclusivamente de listeners de teclado
- Nenhum módulo renderiza DOM diretamente além de `app.js`

---

## 📋 CHANGELOG v2.0.0

### 🐛 Bugs Corrigidos
- `ReferenceError: toggleView is not defined` — funções `toggleView` e `toggleTheme` agora definidas e exportadas corretamente em `app.js`
- `toggleTheme` inexistente — função implementada com alternância claro/escuro
- Indentação incorreta do listener `themeToggleBtn` no DOMContentLoaded
- Placeholder `{{VERSION}}` nos scripts do `index.html` → versão `2.0.0`
- `saveState` chamado em contexto API-first (`tasks.js`) → substituído por `saveMetadata`

### ✨ Melhorias
- **SW reescrito** sem dependência do Workbox CDN — estratégias nativas: Network First (API), Stale While Revalidate (assets), Cache First + TTL (imagens)
- **Versionamento automático** do cache via `Date.now()` — sem cache stale
- **Retry com Exponential Backoff** no Service Worker
- **Botão "Atualizar App"** via `SKIP_WAITING` message
- **Breakpoint 1440px** adicionado ao `responsive.css`
- **Breakpoint 480px** adicionado (cards touch-friendly, min-height 64px)
- **Dropdown mobile** corrigido — não sai da tela (`position: fixed`, `z-index: 9999`)
- **Modal mobile** — bottom sheet style (`border-radius: 16px 16px 0 0`)
- **Botão de tema** adicionado no header (`themeToggleBtn`)
- **Atalhos de teclado** integrados ao bootstrap do app (`initShortcuts`)
- **`beforeunload`** — aviso ao fechar com operações pendentes na fila de sync
- **`aria-label`** melhorado nos cards com prioridade
- **`tabindex="0"`** em todos os cards para navegação por teclado
- `config.js` limpo — sem ASSETS legados, com `BUILD_TS` para cache busting

### 🗑️ Removido
- Dependência do Workbox CDN no `sw.js`
- `importScripts('/js/config.js')` no SW (desnecessário)
- Array `ASSETS` legado do `config.js`
- Guards `if (typeof toggleView === 'function')` — substituídos por definição real

---

## 👨‍💻 Desenvolvido por

**Bruno Oliveira — MB Tech**

<p>
  <a href="https://github.com/BrunoDev-2026">
    <img src="https://img.shields.io/badge/GitHub-BrunoDev--2026-181717?style=flat-square&logo=github" />
  </a>
  &nbsp;
  <a href="https://www.linkedin.com/in/bruno-david-de-oliveira-buchardt-721643246">
    <img src="https://img.shields.io/badge/LinkedIn-Bruno%20Oliveira-0A66C2?style=flat-square&logo=linkedin" />
  </a>
</p>

---

<p align="center">
  Feito com ☕ e muito foco — <em>MB FlowBoard v2.0.0</em>
</p>
