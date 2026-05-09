// update-version.js
const fs = require('fs');
const path = require('path');

// Define o nome do placeholder
const PLACEHOLDER = '{{VERSION}}';

// Gera timestamp atual (ex: 20250509143000)
const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

// Caminho do seu index.html
const indexPath = path.join(__dirname, 'index.html');

// Lê o arquivo e substitui todas as ocorrências do placeholder
if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf8');
    if (html.includes(PLACEHOLDER)) {
        html = html.split(PLACEHOLDER).join(timestamp);
        fs.writeFileSync(indexPath, html, 'utf8');
        console.log(`✅ Versão atualizada para: ${timestamp}`);
    } else {
        console.warn(`⚠️ Placeholder ${PLACEHOLDER} não encontrado no index.html`);
    }
}