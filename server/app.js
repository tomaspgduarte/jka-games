import express from 'express';
import helmet from 'helmet';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { attachGame } from './game.js';

export function createGameServer({ dev = false, gameOptions = {}, origin = process.env.PUBLIC_ORIGIN } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: dev ? false : {
    directives: { 'connect-src': ["'self'", 'ws:', 'wss:'], 'upgrade-insecure-requests': null },
  }, strictTransportSecurity: dev ? false : undefined }));
  const http = createServer(app);
  const io = new Server(http, {
    serveClient: false, maxHttpBufferSize: 3 * 1024 * 1024,
    pingInterval: 10000, pingTimeout: 20000,
    allowRequest(req, callback) {
      const requestOrigin = req.headers.origin;
      let allowed = !requestOrigin;
      if (requestOrigin) {
        try { allowed = origin ? requestOrigin === origin : new URL(requestOrigin).host === req.headers.host; }
        catch { allowed = false; }
      }
      callback(null, allowed);
    },
  });
  const game = attachGame(io, gameOptions);
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/media/:code/:roundId', (req, res) => {
    const image = game.getRoundImage(req.params.code, req.params.roundId);
    if (!image) { res.sendStatus(404); return; }
    res.set('Cache-Control', 'private, max-age=3600, immutable');
    res.type(image.mime).send(image.bytes);
  });
  return { app, http, io, game,
    async close() {
      await new Promise(resolve => io.close(resolve));
      game.dispose();
    },
  };
}
