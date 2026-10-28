import { io } from 'socket.io-client';
import { createGameServer } from '../server/app.js';

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function until(predicate, timeout = 3000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) throw new Error('Timed out waiting for game state');
    await sleep(5);
  }
}
export function emit(socket, event, input = {}) {
  return new Promise((resolve, reject) => socket.timeout(3000).emit(event, input,
    (error, value) => error ? reject(error) : resolve(value)));
}
export async function ok(socket, event, input = {}) {
  const result = await emit(socket, event, input);
  if (!result.ok) throw new Error(`${event}: ${result.error}`);
  return result;
}
export async function fixture(t, options = {}) {
  const server = createGameServer({ gameOptions: { countdownMs: 80, resultsMs: 500, hostGraceMs: 300, defaultConfig: config(), ...options } });
  await new Promise((resolve, reject) => { server.http.once('error', reject); server.http.listen(0, '127.0.0.1', resolve); });
  const url = `http://127.0.0.1:${server.http.address().port}`;
  const clients = [];
  async function connect(transports = ['websocket']) {
    const socket = io(url, { transports, forceNew: true, reconnection: false });
    clients.push(socket);
    socket.on('room:state', state => { socket.state = state; });
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    return socket;
  }
  const close = async () => { clients.forEach(s => s.disconnect()); await server.close(); };
  t?.after(close);
  return { server, url, clients, connect, close };
}
export async function group(f, count = 6) {
  const host = await f.connect();
  const created = await ok(host, 'room:create', { nickname: 'Jogador 1' });
  const players = [host], sessions = [created];
  for (let i = 1; i < count; i++) {
    const player = await f.connect();
    sessions.push(await ok(player, 'room:join', { code: created.code, nickname: `Jogador ${i + 1}` }));
    players.push(player);
  }
  return { players, sessions, code: created.code, host };
}
export const config = (questions = [
  { theme: 'Teste', prompt: 'Capital de Portugal?', answers: ['Lisboa', 'Lisbon'] },
  { theme: 'Teste', prompt: 'Planeta vermelho?', answers: ['Marte', 'Mars'] },
]) => ({ durationSeconds: 5, targetPoints: 25, fuzzy: true, shuffle: true, questions });
