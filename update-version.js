// update-version.js
const fs = require('fs');
const path = require('path');

// Define o nome do placeholder
const PLACEHOLDER = '{{VERSION}}';
// Usa o hash do GitHub se disponível, caso contrário gera um timestamp (fallback local)
const version = process.env.GITHUB_SHA 
    ? process.env.GITHUB_SHA.substring(0, 7) 
    : new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

// Caminho do seu index.html
const indexPath = path.join(__dirname, 'index.html');
const swPath = path.join(__dirname, 'sw.js');
const configPath = path.join(__dirname, 'js', 'config.js');

function updateFile(filePath) {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        if (content.includes(PLACEHOLDER)) {
            content = content.split(PLACEHOLDER).join(version);
        }

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Arquivo ${path.basename(filePath)} atualizado com sucesso.`);
    }
}

updateFile(indexPath);
updateFile(swPath);
updateFile(configPath);