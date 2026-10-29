import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { normalize, isCorrect, pointsFor } from './answers.js';
import { defaultConfig } from './defaults.js';
import { decodeImage, MAX_CONFIG_BYTES } from './images.js';

class GameError extends Error {}
const requireThat = (condition, message) => { if (!condition) throw new GameError(message); };
const clone = value => structuredClone(value);
const safeString = (value, max) => typeof value === 'string' && value.length <= max;

export function validateConfig(raw) {
  requireThat(raw && typeof raw === 'object', 'Configuração inválida.');
  requireThat(Number.isInteger(raw.durationSeconds) && raw.durationSeconds >= 5 && raw.durationSeconds <= 120,
    'O tempo deve ser um número inteiro entre 5 e 120 segundos.');
  requireThat(typeof raw.fuzzy === 'boolean', 'Opções inválidas.');
  const targetPoints = raw.targetPoints ?? 50;
  requireThat(Number.isInteger(targetPoints) && targetPoints >= 1 && targetPoints <= 1000,
    'O objetivo deve ser um número inteiro entre 1 e 1000 pontos.');
  requireThat(Array.isArray(raw.questions) && raw.questions.length >= 1 && raw.questions.length <= 500,
    'Adiciona entre 1 e 500 perguntas.');
  const questions = raw.questions.map((q, index) => {
    const prefix = `Pergunta ${index + 1}: `;
    requireThat(q && safeString(q.theme, 60) && safeString(q.prompt, 500) && q.prompt.trim(), prefix + 'texto inválido (máximo 500 caracteres).');
    requireThat(Array.isArray(q.answers) && q.answers.length >= 1 && q.answers.length <= 10,
      prefix + 'indica entre 1 e 10 respostas aceites.');
    requireThat(q.answers.every(a => safeString(a, 120) && normalize(a)), prefix + 'resposta inválida (máximo 120 caracteres).');
    requireThat(q.image === undefined || q.image === '' || decodeImage(q.image), prefix + 'imagem inválida (PNG, JPEG ou WebP; máximo 300 KB).');
    requireThat(q.imageCredit === undefined || safeString(q.imageCredit, 500), prefix + 'crédito de imagem inválido.');
    for (const field of ['imageSource', 'imageLicense']) {
      requireThat(q[field] === undefined || (safeString(q[field], 1000) && /^https:\/\/[^\s]+$/.test(q[field])), prefix + 'link de imagem inválido.');
    }
    return { theme: q.theme.trim() || 'Geral', prompt: q.prompt.trim(), answers: [...new Set(q.answers.map(a => a.trim()))],
      ...(q.image ? { image: q.image,
        ...(q.imageCredit ? { imageCredit: q.imageCredit } : {}),
        ...(q.imageSource ? { imageSource: q.imageSource } : {}),
        ...(q.imageLicense ? { imageLicense: q.imageLicense } : {}),
      } : {}) };
  });
  const textOnly = questions.map(({ image, ...question }) => question);
  requireThat(Buffer.byteLength(JSON.stringify(textOnly)) <= 200000, 'Os textos das perguntas excedem o limite de 200 KB.');
  requireThat(Buffer.byteLength(JSON.stringify(questions)) <= MAX_CONFIG_BYTES, 'As perguntas e imagens excedem o limite total de 2 MB.');
  return { durationSeconds: raw.durationSeconds, targetPoints, fuzzy: raw.fuzzy, shuffle: true, questions };
}

export function shuffleQuestions(questions, previous = null) {
  const deck = [...questions];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  // Visit every question before recycling, and avoid the same one across cycles.
  if (deck.length > 1 && deck[0] === previous) {
    const j = randomInt(1, deck.length); [deck[0], deck[j]] = [deck[j], deck[0]];
  }
  return deck;
}

export function attachGame(io, options = {}) {
  const rooms = new Map();
  const createBuckets = new Map();
  const countdownMs = options.countdownMs ?? 3000;
  const resultsMs = options.resultsMs ?? 3000;
  const hostGraceMs = options.hostGraceMs ?? 30000;
  const emptyTtlMs = options.emptyTtlMs ?? 30 * 60 * 1000;
  const maxRooms = options.maxRooms ?? 100;
  const initialConfig = options.defaultConfig ?? defaultConfig;
  const timers = new Set();
  function later(fn, ms) {
    const timer = setTimeout(() => { timers.delete(timer); fn(); }, ms);
    timer.unref?.(); timers.add(timer); return timer;
  }
  function cancel(timer) { clearTimeout(timer); timers.delete(timer); }
  function code() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result;
    do { result = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (rooms.has(result));
    return result;
  }
  function nickname(raw) {
    requireThat(safeString(raw, 24), 'O nickname deve ter entre 1 e 24 caracteres.');
    const name = raw.trim();
    requireThat(name && normalize(name) && !/[\p{C}]/u.test(name), 'Nickname inválido.');
    return name;
  }
  function newPlayer(name) {
    return { id: randomUUID(), token: randomBytes(24).toString('hex'), name, socketId: null,
      connected: false, left: false, score: 0, correct: 0, totalMs: 0, graceTimer: null };
  }
  function ranked(room) {
    return [...room.players.values()].sort((a, b) => b.score - a.score || b.correct - a.correct ||
      a.totalMs - b.totalMs || a.name.localeCompare(b.name, 'pt'));
  }
  function snapshot(room, viewer) {
    const round = room.round;
    const reveal = room.phase === 'results' || room.phase === 'finished';
    const current = round ? room.deck[room.index] : null;
    return {
      code: room.code, phase: room.phase, hostId: room.hostId, meId: viewer.id,
      revision: room.revision, serverNow: Date.now(), advanceAt: room.phase === 'results' ? room.advanceAt : null,
      settings: { durationSeconds: room.config.durationSeconds, targetPoints: room.config.targetPoints, fuzzy: room.config.fuzzy, shuffle: true },
      targetPoints: room.targetPoints ?? room.config.targetPoints, winnerId: room.winnerId ?? null,
      questionCount: room.config.questions.length,
      players: ranked(room).map(p => ({ id: p.id, name: p.name, connected: p.connected, left: p.left,
        score: p.score, correct: p.correct, averageMs: p.correct ? Math.round(p.totalMs / p.correct) : null,
        participating: room.participants.has(p.id), solved: !!round?.solved.has(p.id),
        roundPoints: reveal ? round?.solved.get(p.id)?.points ?? 0 : null,
        responseMs: reveal ? round?.solved.get(p.id)?.elapsedMs ?? null : null,
      })),
      round: round ? { id: round.id, number: room.roundNumber,
        startsAt: round.startsAt, deadline: round.deadline, durationMs: round.durationMs,
        theme: current.theme, prompt: performance.now() >= round.startMono || reveal ? current.prompt : null,
        imageUrl: current.image && (performance.now() >= round.startMono || reveal) ? `/media/${room.code}/${round.id}` : null,
        answers: reveal ? current.answers : undefined,
        imageCredit: reveal ? current.imageCredit : undefined,
        imageSource: reveal ? current.imageSource : undefined,
        imageLicense: reveal ? current.imageLicense : undefined,
        mine: round.solved.get(viewer.id) ?? null,
      } : null,
      // Only the host receives the editable deck, and only outside a match.
      config: viewer.id === room.hostId && ['lobby', 'finished'].includes(room.phase) ? clone(room.config) : undefined,
    };
  }
  function publish(room) {
    for (const p of room.players.values()) if (p.connected) io.to(p.socketId).emit('room:state', snapshot(room, p));
  }
  function electHost(room) {
    room.hostId = [...room.players.values()].find(p => p.connected && !p.left)?.id ?? null;
  }
  function bind(socket, room, player) {
    requireThat(!socket.data.roomCode, 'Já estás numa sala. Sai primeiro.');
    // A session has one connection; prevent two tabs answering as one player.
    if (player.connected) {
      const old = io.sockets.sockets.get(player.socketId);
      if (old) { old.data.roomCode = null; old.emit('session:replaced'); old.disconnect(true); }
    }
    cancel(player.graceTimer);
    player.connected = true; player.socketId = socket.id;
    socket.data.roomCode = room.code; socket.data.playerId = player.id;
    room.lastActive = Date.now();
    if (!room.hostId) electHost(room);
    publish(room);
    return { code: room.code, playerId: player.id, token: player.token, state: snapshot(room, player) };
  }
  function membership(socket) {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players.get(socket.data.playerId);
    requireThat(room && player?.connected && player.socketId === socket.id && !player.left, 'Volta a entrar na sala.');
    room.lastActive = Date.now();
    return { room, player };
  }
  function host(socket) {
    const m = membership(socket);
    requireThat(m.room.hostId === m.player.id, 'Só o host pode fazer isso.'); return m;
  }
  function finishRound(room) {
    if (room.phase !== 'question') return;
    cancel(room.round.timer);
    cancel(room.round.openTimer);
    room.phase = 'results'; room.advanceAt = Date.now() + resultsMs; publish(room);
    room.advanceTimer = later(() => {
      if (room.phase !== 'results') return;
      if (room.winnerId) { room.phase = 'finished'; publish(room); }
      else {
        const previous = room.deck[room.index];
        room.index++;
        if (room.index >= room.deck.length) { room.deck = shuffleQuestions(room.config.questions, previous); room.index = 0; }
        room.roundNumber++; startRound(room);
      }
    }, resultsMs);
  }
  function startRound(room) {
    const durationMs = room.config.durationSeconds * 1000;
    const leadMs = room.roundNumber === 1 ? countdownMs : 0;
    const startMono = performance.now() + leadMs;
    const startsAt = Date.now() + leadMs;
    room.phase = 'question';
    room.round = { id: randomUUID(), startMono, startsAt, deadline: startsAt + durationMs, durationMs,
      solved: new Map(), attempts: new Map(), requests: new Map(), lastAttempt: new Map(), timer: null, openTimer: null };
    // The deadline is checked on every answer too, so a delayed timer cannot allow late points.
    room.round.timer = later(() => finishRound(room), leadMs + durationMs);
    const announceQuestion = () => {
      const remaining = room.round.startMono - performance.now();
      if (remaining > 0) room.round.openTimer = later(announceQuestion, Math.ceil(remaining));
      else publish(room);
    };
    room.round.openTimer = later(announceQuestion, Math.max(1, leadMs));
    publish(room);
  }
  function closeRoom(room, event) {
    for (const p of room.players.values()) {
      cancel(p.graceTimer);
      if (p.connected) {
        const socket = io.sockets.sockets.get(p.socketId);
        if (socket) { socket.data.roomCode = null; socket.emit(event); }
      }
    }
    cancel(room.round?.timer); cancel(room.round?.openTimer); cancel(room.advanceTimer); rooms.delete(room.code);
  }
  function detach(socket, explicit = false) {
    const room = rooms.get(socket.data.roomCode);
    const p = room?.players.get(socket.data.playerId);
    socket.data.roomCode = null;
    if (!p || p.socketId !== socket.id) return;
    p.connected = false; p.socketId = null; room.lastActive = Date.now();
    if (explicit) {
      p.left = true; p.token = null;
      // The host closing the room ends it for everyone; only a lost connection hands over control.
      if (room.hostId === p.id) { closeRoom(room, 'room:closed'); return; }
    } else {
      p.graceTimer = later(() => {
        if (!p.connected && room.hostId === p.id) { electHost(room); publish(room); }
      }, hostGraceMs);
    }
    publish(room);
  }
  io.on('connection', socket => {
    let windowStart = performance.now(); let eventCount = 0;
    function on(event, handler) {
      socket.on(event, (input, ack) => {
        // Capture reception before normalization or validation. Never use the client's clock.
        const receivedAt = performance.now();
        const reply = typeof ack === 'function' ? ack : () => {};
        try {
          if (receivedAt - windowStart > 10000) { windowStart = receivedAt; eventCount = 0; }
          requireThat(++eventCount <= 60, 'Demasiados pedidos. Espera alguns segundos.');
          const result = handler(input ?? {}, receivedAt);
          reply({ ok: true, ...result });
        } catch (error) {
          if (!(error instanceof GameError)) console.error('Game handler error:', event, error);
          reply({ ok: false, error: error instanceof GameError ? error.message : 'Erro interno. Tenta novamente.' });
        }
      });
    }
    on('clock:sync', () => ({ serverNow: Date.now() }));
    on('room:create', raw => {
      requireThat(!socket.data.roomCode, 'Já estás numa sala.');
      requireThat(rooms.size < maxRooms, 'Servidor cheio. Tenta mais tarde.');
      const name = nickname(raw.nickname);
      const address = socket.handshake.address;
      const now = Date.now();
      const bucket = createBuckets.get(address) ?? { count: 0, at: now };
      if (now - bucket.at > 60000) { bucket.at = now; bucket.count = 0; }
      requireThat(++bucket.count <= 10, 'Limite de 10 salas por minuto nesta ligação.');
      createBuckets.set(address, bucket);
      const player = newPlayer(name);
      const room = { code: code(), hostId: player.id, players: new Map([[player.id, player]]),
        phase: 'lobby', config: clone(initialConfig), revision: 1, participants: new Set(),
        deck: [], index: -1, round: null, lastActive: now, createdAt: now };
      rooms.set(room.code, room);
      return bind(socket, room, player);
    });
    on('room:join', raw => {
      requireThat(!socket.data.roomCode, 'Já estás numa sala.');
      requireThat(safeString(raw.code, 6), 'Código inválido.');
      const room = rooms.get(raw.code.toUpperCase());
      requireThat(room, 'Sala não encontrada ou já expirada.');
      requireThat(room.players.size < 20, 'Esta sala atingiu o limite de 20 entradas. Cria uma nova.');
      const name = nickname(raw.nickname);
      requireThat(![...room.players.values()].some(p => !p.left && normalize(p.name) === normalize(name)), 'Este nickname já está em uso.');
      const player = newPlayer(name); room.players.set(player.id, player);
      return bind(socket, room, player);
    });
    on('room:resume', raw => {
      requireThat(safeString(raw.code, 6) && safeString(raw.token, 48) && raw.token.length === 48, 'Sessão inválida.');
      const room = rooms.get(raw.code.toUpperCase());
      const player = room && [...room.players.values()].find(p => !p.left && p.token === raw.token);
      requireThat(player, 'A sessão expirou. Volta a entrar ou cria uma sala.');
      return bind(socket, room, player);
    });
    on('room:leave', () => { membership(socket); detach(socket, true); return {}; });
    on('config:save', raw => {
      const { room } = host(socket);
      requireThat(['lobby', 'finished'].includes(room.phase), 'Só podes editar entre partidas.');
      requireThat(raw.revision === room.revision, 'As perguntas mudaram. Atualiza o painel antes de guardar.');
      room.config = validateConfig(raw.config); room.revision++; publish(room); return {};
    });
    on('game:start', () => {
      const { room } = host(socket);
      requireThat(['lobby', 'finished'].includes(room.phase), 'Já existe uma partida em curso.');
      const connected = [...room.players.values()].filter(p => p.connected);
      requireThat(connected.length >= 1, 'É preciso pelo menos 1 jogador ligado. A sala suporta 20.');
      room.participants = new Set(connected.map(p => p.id));
      for (const p of room.players.values()) { p.score = 0; p.correct = 0; p.totalMs = 0; }
      room.deck = shuffleQuestions(room.config.questions);
      room.targetPoints = room.config.targetPoints; room.winnerId = null;
      room.index = 0; room.roundNumber = 1; startRound(room); return {};
    });
    on('answer:submit', (raw, receivedAt) => {
      const { room, player } = membership(socket);
      const round = room.round;
      requireThat(round && raw.roundId === round.id, 'Esta pergunta já terminou.');
      requireThat(room.participants.has(player.id), 'Entraste durante a partida. Jogas na próxima.');
      requireThat(safeString(raw.requestId, 80) && raw.requestId.length >= 8, 'Pedido inválido.');
      const requestKey = player.id + ':' + raw.requestId;
      if (round.requests.has(requestKey)) return round.requests.get(requestKey);
      requireThat(room.phase === 'question', 'A ronda já terminou.');
      const elapsed = receivedAt - round.startMono;
      requireThat(elapsed >= 0, 'Espera pelo início da pergunta.');
      if (elapsed >= round.durationMs) { finishRound(room); throw new GameError('O tempo terminou.'); }
      requireThat(!round.solved.has(player.id), 'Já acertaste nesta ronda.');
      requireThat(safeString(raw.answer, 120) && normalize(raw.answer), 'Escreve uma resposta (máximo 120 caracteres).');
      const attempts = round.attempts.get(player.id) ?? new Set();
      const normalized = normalize(raw.answer);
      requireThat(!attempts.has(normalized), 'Já enviaste essa resposta. Tenta outra.');
      requireThat(attempts.size < 50, 'Atingiste o limite de 50 tentativas nesta ronda.');
      requireThat(receivedAt - (round.lastAttempt.get(player.id) ?? -Infinity) >= 300, 'Espera 0,3 segundos entre tentativas.');
      attempts.add(normalized); round.attempts.set(player.id, attempts); round.lastAttempt.set(player.id, receivedAt);
      const correct = isCorrect(raw.answer, room.deck[room.index].answers, room.config.fuzzy);
      const elapsedMs = Math.max(0, Math.round(elapsed));
      const result = { correct, roundId: round.id, elapsedMs, points: correct ? pointsFor(elapsed, round.durationMs) : 0 };
      round.requests.set(requestKey, result);
      if (correct) {
        round.solved.set(player.id, result); player.score += result.points;
        player.correct++; player.totalMs += elapsedMs;
        if (player.score >= room.targetPoints) { room.winnerId = player.id; finishRound(room); }
        else if ([...room.participants].every(id => round.solved.has(id))) finishRound(room);
        else publish(room);
      }
      return result;
    });
    socket.on('disconnect', () => detach(socket));
  });
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      const emptyExpired = ![...room.players.values()].some(p => p.connected) && now - room.lastActive > emptyTtlMs;
      if (emptyExpired || now - room.createdAt > 12 * 60 * 60 * 1000) closeRoom(room, 'room:expired');
    }
    for (const [ip, bucket] of createBuckets) if (now - bucket.at > 60000) createBuckets.delete(ip);
  }, options.cleanupIntervalMs ?? 60000);
  cleanup.unref?.();
  return { rooms,
    getRoundImage(code, roundId) {
      const room = rooms.get(code);
      if (!room?.round || room.round.id !== roundId || performance.now() < room.round.startMono) return null;
      return decodeImage(room.deck[room.index].image);
    },
    dispose() { clearInterval(cleanup); for (const timer of timers) clearTimeout(timer); timers.clear(); },
  };
}
