# TODO.md

- [x] Entender o código atual de backend/server.js (conexão MongoDB e inicialização do servidor).
- [ ] Substituir a lógica atual de conexão por um bloco mais robusto com fallback: ler MONGODB_URI via .env e usar string direta como Plano B.
- [ ] Garantir que `dotenv` seja carregado e que o processo finalize com erro se não houver URI.
- [ ] Rodar o backend localmente (node / npm run dev) para verificar se conecta e o servidor sobe.


