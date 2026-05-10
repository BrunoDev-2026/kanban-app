// update-version.js
const fs = require('fs');
const path = require('path');

// Define o nome do placeholder
const PLACEHOLDER = '{{VERSION}}';

// No Render, usamos RENDER_GIT_COMMIT para uma versão estável entre deploys.
// Isso evita que o Service Worker mude a cada reinicialização do servidor.
const version = process.env.RENDER_GIT_COMMIT 
    ? process.env.RENDER_GIT_COMMIT.substring(0, 7) 
    : (process.env.GITHUB_SHA ? process.env.GITHUB_SHA.substring(0, 7) : 'v1.0.0');

// Caminho do seu index.html
const indexPath = path.join(__dirname, 'index.html');
const swPath = path.join(__dirname, 'sw.js');
const configPath = path.join(__dirname, 'js', 'config.js');

function updateFile(filePath) {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        if (content.includes(PLACEHOLDER)) {
            const count = content.split(PLACEHOLDER).length - 1;
            content = content.split(PLACEHOLDER).join(version);
            console.log(`✅ [BUILD] ${path.basename(filePath)}: Substituídos ${count} placeholders por "${version}"`);
        } else {
            console.log(`⚠️ [BUILD] ${path.basename(filePath)}: Nenhum placeholder "{{VERSION}}" encontrado.`);
        }

        fs.writeFileSync(filePath, content, 'utf8');
    }
}

updateFile(indexPath);
updateFile(swPath);
updateFile(configPath);