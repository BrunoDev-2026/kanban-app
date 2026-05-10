# 🚀 KanFlow — MB FlowBoard v2.0

O **KanFlow** é uma aplicação Kanban de alta performance, projetada para produtividade máxima. Combinando uma interface moderna baseada em *Glassmorphism* com ferramentas integradas como **Pomodoro Timer**, **Dashboard de Métricas** e sincronização em tempo real via **Firebase**.

![Status do Projeto](https://img.shields.io/badge/Status-Em_Desenvolvimento-blue?style=for-the-the-badge)
![Tech](https://img.shields.io/badge/Tech-Vanilla_JS-yellow?style=for-the-the-badge)
![Backend](https://img.shields.io/badge/Backend-Node.js-green?style=for-the-the-badge)

---

## ✨ Funcionalidades Principais

*   **Quadro Kanban Interativo:** Sistema de Drag & Drop nativo para movimentação de tarefas entre colunas.
*   **Sincronização Cloud:** Persistência robusta utilizando **Firebase Firestore** via backend Node.js.
*   **Pomodoro Timer Integrado:** Foco total com temporizador de 25 minutos e notificações visuais/sonoras.
*   **Dashboard de Métricas:** Visualização de produtividade semanal, análise de prioridades e gargalos com **Chart.js**.
*   **Gestão de Temas:** 5 temas exclusivos (Professional Dark, Light, Neon, Glass, Aurora).
*   **WIP Limit:** Controle de "Work In Progress" para evitar sobrecarga em colunas específicas.
*   **PWA Ready:** Experiência responsiva otimizada para Desktop e Mobile.

---

## 🛠️ Tecnologias Utilizadas

### Frontend
*   **HTML5 & CSS3:** Design moderno utilizando variáveis CSS, animações personalizadas e Glassmorphism.
*   **JavaScript (Vanilla):** Lógica pura, sem frameworks, garantindo leveza e performance.
*   **Chart.js:** Gráficos interativos para o dashboard.
*   **Lucide Icons:** Conjunto de ícones minimalistas.

### Backend
*   **Node.js & Express:** Servidor robusto para API REST.
*   **Firebase Admin SDK:** Integração segura com o Firestore.
*   **Compression & CORS:** Otimização de tráfego e segurança entre domínios.

---

## 🚀 Instalação e Configuração

### Pré-requisitos
*   Node.js instalado (v14 ou superior)
*   Conta no Firebase com um projeto Firestore ativo.

### Passo a Passo

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/seu-usuario/kanban-app.git
    cd kanban-app
    ```

2.  **Instale as dependências do Backend:**
    ```bash
    cd backend
    npm install
    ```

3.  **Configuração do Firebase:**
    *   Gere uma chave privada (JSON) no Console do Firebase (Configurações do Projeto > Contas de Serviço).
    *   Salve o arquivo como `serviceAccountKey.json` dentro da pasta `backend/`.

4.  **Variáveis de Ambiente:**
    Crie um arquivo `.env` na pasta `backend/`:
    ```env
    PORT=4000
    # Se for hospedar no Render/Fly.io, use a string JSON da conta de serviço:
    GOOGLE_APPLICATION_CREDENTIALS_JSON={...}
    ```

5.  **Inicie o servidor:**
    ```bash
    npm start
    ```

6.  **Acesse o App:**
    Abra o navegador em `http://localhost:4000`.

---

##  Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

---
*Desenvolvido por [Bruno Oliveira]*