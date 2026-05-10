// update-version.js
const fs = require('fs');
const path = require('path');

// Define o nome do placeholder
const PLACEHOLDER = '{{VERSION}}';

// Gera timestamp atual (ex: 20250509143000)
const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

// Caminho do seu index.html
const indexPath = path.join(__dirname, 'index.html');
const swPath = path.join(__dirname, 'sw.js');

function updateFile(filePath) {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        if (content.includes(PLACEHOLDER)) {
            content = content.split(PLACEHOLDER).join(timestamp);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Versão atualizada em ${path.basename(filePath)} para: ${timestamp}`);
        }
    }
}

updateFile(indexPath);
updateFile(swPath);