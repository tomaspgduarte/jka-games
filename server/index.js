import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createGameServer } from './app.js';

const dev = process.argv.includes('--dev');
const server = createGameServer({ dev });
let vite;
if (dev) {
  const { createServer } = await import('vite');
  vite = await createServer({ server: { middlewareMode: true, hmr: { server: server.http } }, appType: 'spa' });
  server.app.use(vite.middlewares);
} else {
  const dist = fileURLToPath(new URL('../dist', import.meta.url));
  if (!existsSync(`${dist}/index.html`)) {
    console.error('Falta a versão de produção. Executa npm run build primeiro.'); process.exit(1);
  }
  server.app.use(express.static(dist));
  server.app.get('/{*path}', (_req, res) => res.sendFile(`${dist}/index.html`));
}
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
server.http.listen(port, host, () => console.log(`JKA games disponível em http://localhost:${port}`));
server.http.on('error', error => { console.error(error.message); process.exit(1); });
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true;
  const deadline = setTimeout(() => process.exit(1), 5000); deadline.unref();
  await vite?.close(); await server.close(); clearTimeout(deadline); process.exit(0);
}
process.on('SIGINT', stop); process.on('SIGTERM', stop);
