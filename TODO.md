# TODO — Correção DELETE “volta após F5”

- [x] 1) Corrigir `js/sync.js`: ao enfileirar DELETE para um `id`, remover operações pendentes anteriores (PUT/UPDATE) para o mesmo `id`.
- [x] 2) Garantir recarga consistente após sync: implementar `window._reloadAfterSync` em `js/app.js` (chama `API.fetchTarefas()` e reconstrói `state.columns`, depois `render()`).
- [x] 3) Rechecar `js/app.js`: confirmar que no DELETE confirmado o card não fica em nenhum outro estado/estruturas e que o enqueue está correto.
- [ ] 4) Teste manual: criar tarefa → excluir → validar que em F5 não retorna. (Ajustado: adicionado botão de limpeza de fila stuck).
