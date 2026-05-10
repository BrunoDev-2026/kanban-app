# TODO — KanFlow / MB FlowBoard v2.0 (correção completa)

## Etapa 0 — Auditar e preparar (concluído parcialmente)
- [x] Mapear duplicidades entre `script.js` (raiz) e módulos em `js/`.
- [x] Identificar conflitos prováveis: render, eventos duplicados, dragdrop duplicado, persistência inconsistente.
- [ ] Confirmar em runtime quais arquivos realmente executam (checar no HTML e iniciar devtools).

## Etapa 1 — Unificar arquitetura (fonte da verdade)
- [ ] Definir que `js/app.js` é o bootstrap principal.
- [ ] Definir que `js/tasks.js`, `js/dragdrop.js`, `js/storage.js`, `js/sync.js` não devem ser duplicados por `script.js`.
- [ ] Desabilitar/retirar (ou isolar) o legado de `script.js` raiz para não competir com `js/app.js`.

## Etapa 2 — Corrigir Drag & Drop (desktop)
- [ ] Garantir que reordenação/insert usa consistentemente `data-card-id`.
- [ ] Remover listeners duplicados por render (preferir delegação ou rebind controlado).
- [ ] Garantir feedback visual no drop (highlight/ghost) sem quebrar layout.
- [ ] Garantir persistência: toda movimentação → atualização local + `Sync.enqueue`.

## Etapa 3 — Corrigir Drag & Drop (mobile app-like)
- [ ] Implementar fallback touch/pointer (long-press + reorder por posição/coluna).
- [ ] Botões e targets touch-friendly; sem overflow/cortes.

## Etapa 4 — Renderização robusta e performance
- [ ] Evitar `innerHTML=''` em render que cause rebind caótico.
- [ ] Cachear seletores e reduzir `querySelectorAll` em loops.
- [ ] Garantir animações com `prefers-reduced-motion`.

## Etapa 5 — Persistência consistente
- [ ] Padronizar fluxo: UI otimista + `Sync.enqueue` + refresh após sync.
- [ ] Remover chamadas diretas à API que contornem o outbox (ou padronizar fallback).
- [ ] Ajustar chaves do localStorage para não conflitar entre módulos.

## Etapa 6 — PWA (installável)
- [ ] Validar `manifest.json` e `sw.js` (cache e fallback de navegação).
- [ ] Atualizar README com passo a passo de PWA.

## Etapa 7 — Validação final obrigatória
- [ ] Sem erros no console.
- [ ] Drag & drop funcionando desktop e mobile.
- [ ] Layout 100% responsivo.
- [ ] Listar resumo técnico de correções.

## Etapa 8 — Entrega
- [ ] Atualizar README e `TODO.md`.
- [ ] Fazer commits pequenos em branch `blackboxai/*`.

