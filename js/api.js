'use strict';

// api.js — Expondo uma camada fina para interações com o backend
// Mantém compatibilidade com o index.html carregando scripts sem modules.

(function () {
  const API_BASE_URL = "https://kanban-api-oozq.onrender.com";

  function getErrorMessage(err) {
    if (!err) return 'Erro na requisição.';
    if (typeof err === 'string') return err;
    if (err && err.message) return err.message;
    return 'Erro na requisição.';
  }

  async function request(path, options = {}) {
    const url = `${API_BASE_URL}${path}`;
    const response = await fetch(url, options);

    if (!response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch (_) {
        // ignore
      }
      const msg = payload?.erro || payload?.message || `Erro HTTP ${response.status}`;
      const error = new Error(msg);
      error.status = response.status; // Anexa o status numérico ao erro
      throw error;
    }

    // Pode retornar vazio em DELETE
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async function fetchTarefas() {
    return request('/tarefas');
  }

  async function createTarefa(payload) {
    return request('/tarefas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }


  async function updateTarefa(id, payload) {
    return request(`/tarefas/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }




  async function deleteTarefa(id) {
    return request(`/tarefas/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }


  // Exposição global
  window.API = {
    API_BASE_URL,
    fetchTarefas,
    createTarefa,
    updateTarefa,
    deleteTarefa
  };
})();
