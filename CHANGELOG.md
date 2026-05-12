# CHANGELOG — MB FlowBoard

Todas as mudanças notáveis são documentadas neste arquivo.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [2.0.0] — 2026-05-11 — Production Release

### 🐛 Bug Fixes Críticos

#### js/app.js
- **FIXED** `ReferenceError: toggleView is not defined` — A função `toggleView` não existia
  em nenhum módulo. Implementada diretamente em `app.js` e exportada via `window.toggleView`.
- **FIXED** `ReferenceError: toggleTheme is not defined` — A função `toggleTheme` não existia.
  Implementada em `app.js` com alternância entre `theme-dark` e `theme-light`.
- **FIXED** Indentação incorreta do listener `themeToggleBtn` (estava fora do bloco `try`
  no `DOMContentLoaded`, causando erro silencioso).
- **FIXED** Guards `if (typeof toggleView === 'function')` que mascaravam o erro sem corrigir
  a causa raiz — removidos e substituídos por definição real das funções.
- **FIXED** `safeToggleView` agora referencia `window.toggleView` diretamente (sem fallback `() => {}`).
- **ADDED** `initShortcuts()` chamado no bootstrap (DOMContentLoaded) — atalhos não estavam
  sendo inicializados.
- **ADDED** `beforeunload` listener — avisa o usuário se houver operações não sincronizadas
  na fila (Outbox) ao tentar fechar a aba.
- **IMPROVED** `aria-label` dos cards enriquecido com prioridade ("Tarefa: X, Prioridade: Y").
- **ADDED** `tabindex="0"` em todos os cards para suporte a navegação por teclado.

#### js/tasks.js
- **FIXED** `saveState(state)` chamado em `openColumnModal` e `openMergeModal` em contexto
  API-first — substituído por `saveMetadata()` com fallback seguro.
- **FIXED** Ausência de `null`-check antes de `openMergeModal` ao acessar `card.conflict`.

#### js/config.js
- **FIXED** Placeholder `{{VERSION}}` não substituído — hardcoded para `'2.0.0'`.
- **FIXED** Array `ASSETS` legado removido (não era usado por nenhum módulo).
- **ADDED** `BUILD_TS = Date.now()` para cache busting automático por sessão.
- **IMPROVED** `CACHE_NAME` agora inclui versão + timestamp para garantir invalidação.

#### index.html
- **FIXED** `?v={{VERSION}}` nos scripts `api.js` e `utils.js` — substituído por `?v=2.0.0`.
- **FIXED** Todos os scripts agora usam versão `2.0.0` (antes alguns usavam `1.0.1`).
- **ADDED** Botão `#themeToggleBtn` no header (estava referenciado no JS mas ausente no HTML).

#### sw.js (Reescrito Completamente)
- **REMOVED** Dependência do Workbox CDN (`importScripts` de CDN externa) — eliminado ponto
  de falha crítico (se a CDN estiver fora, o SW falhava completamente).
- **REMOVED** `importScripts('/js/config.js')` desnecessário no contexto do SW.
- **IMPLEMENTED** Estratégias nativas de cache:
  - **Network First** para API (`/tarefas`) com fallback offline para cache.
  - **Stale While Revalidate** para assets estáticos (CSS, JS, HTML) e Google Fonts.
  - **Cache First + TTL 30 dias** para imagens com limpeza automática ao expirar.
- **IMPLEMENTED** `fetchWithRetry()` — Exponential Backoff (500ms → 1s → 2s, 3 tentativas).
- **IMPLEMENTED** `offlineFallback()` — serve `/offline.html` para documentos sem conexão.
- **IMPLEMENTED** Versionamento automático via `self.__CACHE_VERSION || kanban-${Date.now()}`.
- **IMPROVED** Limpeza de caches antigos na ativação — mantém apenas os 4 caches nomeados.
- **MAINTAINED** Handler `SKIP_WAITING` message para controle de atualização via UI.

### ✨ Melhorias de UI/UX

#### css/responsive.css
- **ADDED** Breakpoint `min-width: 1440px` — colunas com 320px, padding maior no header.
- **ADDED** Breakpoint `max-width: 480px` — cards touch-friendly (`min-height: 64px`),
  botões de ação maiores (`min-width/height: 32px`), Pomodoro compacto.
- **FIXED** Dropdown mobile saindo da tela — agora usa `position: fixed` + `z-index: 9999`.
- **IMPROVED** Modal mobile como bottom sheet (`border-radius: 16px 16px 0 0`,
  `align-items: flex-end`, `max-height: 90vh` com scroll).
- **UPDATED** Cabeçalho de arquivo com lista de breakpoints atualizada.

### 🔒 Segurança & Estabilidade

- **IMPROVED** `beforeunload` previne perda de dados com operações offline pendentes.
- **IMPROVED** Estratégia Network First no SW garante sempre dados frescos da API quando online.
- **IMPROVED** Retry automático no SW reduz falhas transitórias de rede.

### 📚 Documentação

- **REWRITTEN** `README.md` — documentação completa com tabela de funcionalidades,
  stack tecnológico, estrutura de pastas, atalhos, arquitetura, changelog e badges.
- **CREATED** `CHANGELOG.md` — histórico detalhado de todas as mudanças.

---

## [1.0.1] — Release anterior

- Versão inicial em produção no Render.
- Funcionalidades base: Kanban, Drag & Drop, PWA, Sync, Pomodoro, Tags, Dashboard.

---

*MB FlowBoard — Bruno Oliveira / MB Tech*
