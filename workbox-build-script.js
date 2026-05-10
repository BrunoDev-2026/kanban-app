const { injectManifest } = require('workbox-build');
const path = require('path');

async function buildSW() {
  try {
    const { count, size, warnings } = await injectManifest({
      swSrc: path.join(__dirname, 'sw.js'), // Nosso Service Worker customizado
      swDest: path.join(__dirname, 'sw.js'), // Sobrescreve o mesmo arquivo
      globDirectory: __dirname, // Diretório raiz para os assets
      globPatterns: [
        '**/*.{html,js,css,png,jpg,json,svg,webp}', // Inclui todos os tipos de assets comuns
        'assets/logo/logo.png', // Inclui logo explicitamente
        'offline.html' // Inclui a página offline explicitamente
      ],
      // Exclui scripts de build e pastas desnecessárias
      globIgnores: [
        'node_modules/**/*',
        'workbox-build-script.js',
        'update-version.js',
        'backend/**/*',
        '.git/**/*',
        '.github/**/*'
      ]
    });
    console.log(`[Workbox] Injetou ${count} arquivos, totalizando ${size} bytes.`);
    warnings.forEach(warning => console.warn(`[Workbox Warning] ${warning}`));
  } catch (error) {
    console.error(`[Workbox Error] Falha ao injetar manifesto:`, error);
    process.exit(1);
  }
}

buildSW();