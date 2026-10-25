// Servidor estático mínimo para desenvolvimento e testes (sem dependências).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';

const RAIZ = process.cwd();
const PORTA = Number(process.env.PORT || 4173);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

createServer(async (req, res) => {
  try {
    const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let arq = normalize(join(RAIZ, caminho));
    if (!arq.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
    const info = await stat(arq).catch(() => null);
    if (info && info.isDirectory()) arq = join(arq, 'index.html');
    const dados = await readFile(arq).catch(() => null);
    if (!dados) {
      const nf = await readFile(join(RAIZ, '404.html'));
      res.writeHead(404, { 'Content-Type': TIPOS['.html'] }).end(nf);
      return;
    }
    res.writeHead(200, { 'Content-Type': TIPOS[extname(arq)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(dados);
  } catch {
    res.writeHead(500).end();
  }
}).listen(PORTA, () => console.log(`EloServ em http://localhost:${PORTA}/`));
