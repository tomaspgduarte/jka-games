import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, group, config, emit, ok, until, sleep } from './helpers.js';

test('6 jogadores: partida completa, pontos, duplicados, tempos, espectador e reconexão', { timeout: 15000 }, async t => {
  const f = await fixture(t);
  const { players, sessions, host, code } = await group(f);
  await ok(host, 'config:save', { revision: host.state.revision, config: config() });
  assert.equal(players[1].state.config, undefined, 'a lista de respostas é privada');
  assert.equal((await emit(players[1], 'game:start')).ok, false);
  await ok(host, 'game:start');
  const firstRound = host.state.round.id;
  await until(() => players.every(p => p.state.round?.id === firstRound));
  assert.equal(players[1].state.round.prompt, null, 'não revela a pergunta antes do início');
  assert.equal(players[1].state.round.answers, undefined);
  const submit = (socket, answer, requestId, roundId = socket.state.round.id) =>
    emit(socket, 'answer:submit', { answer, requestId, roundId });
  assert.equal((await submit(players[1], 'Lisboa', 'early-0001')).ok, false);
  await until(() => players.every(p => p.state.round.prompt));
  const answerFor = p => p.state.round.prompt === 'Capital de Portugal?' ? 'Lisboa' : 'Marte';
  const firstAnswer = answerFor(host);
  const wrong = await submit(host, 'Porto', 'wrong-0001');
  assert.equal(wrong.correct, false);
  assert.equal((await submit(host, 'PÓRTO!!', 'wrong-0002')).ok, false, 'bloqueia tentativas normalizadas repetidas');
  assert.equal((await submit(host, 'Lisboa', 'fast-00001')).ok, false, 'limita envio rápido');
  await sleep(310);
  const right = await submit(host, firstAnswer === 'Lisboa' ? 'LISBÓA!!!' : 'MÁRTE!!!', 'right-0001');
  assert.equal(right.correct, true); assert.ok(right.elapsedMs >= 300 && right.elapsedMs < 5000);
  assert.ok(right.points >= 1 && right.points <= 10);
  assert.deepEqual(await submit(host, firstAnswer, 'right-0001'), right, 'repetir o pedido devolve o mesmo recibo');
  assert.equal((await submit(host, 'Lisboa', 'right-0002')).ok, false);
  const results = await Promise.all(players.slice(1).map((p, i) => submit(p, answerFor(p), `answer-000${i}`)));
  assert.ok(results.every(r => r.ok && r.correct));
  await until(() => host.state.phase === 'results');
  assert.ok(host.state.players.every(p => p.correct === 1 && p.score >= 1 && p.score <= 10 && p.responseMs !== null));
  assert.equal(host.state.players.find(p => p.id === host.state.meId).score, right.points);
  assert.equal(host.state.players.find(p => p.id === host.state.meId).responseMs, right.elapsedMs);
  assert.deepEqual(host.state.round.answers, firstAnswer === 'Lisboa' ? ['Lisboa', 'Lisbon'] : ['Marte', 'Mars']);
  // Refresh/reconnect recovers points and the receipt of a previously accepted answer.
  players[2].disconnect();
  const recovered = await f.connect();
  const resumed = await ok(recovered, 'room:resume', { code, token: sessions[2].token });
  assert.equal(resumed.playerId, sessions[2].playerId);
  assert.equal(resumed.state.round.mine.correct, true);
  players[2] = recovered;
  const spectator = await f.connect();
  await ok(spectator, 'room:join', { code, nickname: 'Espectador' });
  assert.equal(spectator.state.players.find(p => p.id === spectator.state.meId).participating, false);
  await until(() => players.every(p => p.state.round.id !== firstRound && p.state.round.prompt));
  assert.equal((await submit(host, 'Lisboa', 'stale-0001', firstRound)).ok, false);
  assert.equal((await submit(spectator, 'Marte', 'spect-0001')).ok, false);
  assert.notEqual(answerFor(host), firstAnswer, 'visita cada pergunta antes de recomeçar');
  await Promise.all(players.map((p, i) => ok(p, 'answer:submit', { roundId: p.state.round.id, answer: answerFor(p), requestId: `roundtwo-${i}` })));
  await until(() => host.state.phase === 'results');
  assert.equal(host.state.winnerId, null, 'não termina ao esgotar as perguntas');
  const secondPrompt = host.state.round.prompt;
  await until(() => host.state.phase === 'question' && host.state.round.number === 3);
  assert.notEqual(host.state.round.prompt, secondPrompt, 'não repete nas fronteiras de ciclos');
  await ok(host, 'answer:submit', { roundId: host.state.round.id, answer: answerFor(host), requestId: 'winning-0001' });
  assert.equal(host.state.winnerId, host.state.meId);
  assert.equal(host.state.phase, 'results');
  assert.equal((await submit(players[1], answerFor(players[1]), 'after-win-01')).ok, false);
  await until(() => host.state.phase === 'finished');
  assert.equal(host.state.phase, 'finished');
  assert.equal(host.state.players.filter(p => p.correct === 2).length, 5);
  assert.equal(host.state.players.find(p => p.id === host.state.meId).correct, 3);
  assert.ok(host.state.players[0].score >= host.state.targetPoints);
  assert.equal(host.state.players.find(p => p.id === spectator.state.meId).score, 0);
  await ok(host, 'game:start');
  assert.equal(host.state.players.filter(p => p.participating).length, 7);
  assert.ok(host.state.players.every(p => p.score === 0));
});

test('temporizador termina, rejeita respostas tardias e não pode ser alterado pelo cliente', { timeout: 10000 }, async t => {
  const f = await fixture(t, { countdownMs: 20 });
  const { host, players } = await group(f, 2);
  await ok(host, 'config:save', { revision: 1, config: config([config().questions[0]]) });
  await ok(host, 'game:start');
  await until(() => host.state.round.prompt);
  const receipt = await ok(host, 'answer:submit', { roundId: host.state.round.id, requestId: 'clocktest-1', answer: 'Lisboa', elapsedMs: -99999, points: 999999, startedAt: 0 });
  assert.ok(receipt.points >= 1 && receipt.points <= 10 && receipt.elapsedMs >= 0);
  assert.equal((await emit(host, 'config:save', { revision: 2, config: config() })).ok, false);
  await until(() => host.state.phase === 'results', 6500);
  const late = await emit(players[1], 'answer:submit', { roundId: players[1].state.round.id, requestId: 'late-00001', answer: 'Lisboa' });
  assert.equal(late.ok, false);
  assert.equal(host.state.players.find(p => p.id === players[1].state.meId).score, 0);
});

test('reconexão ativa mantém acerto; takeover invalida socket anterior', async t => {
  const f = await fixture(t);
  const { players, sessions, host, code } = await group(f, 2);
  const answers = new Map(host.state.config.questions.map(q => [q.prompt, q.answers[0]]));
  await ok(host, 'game:start'); await until(() => host.state.round.prompt);
  const result = await ok(players[1], 'answer:submit', { answer: answers.get(host.state.round.prompt), roundId: host.state.round.id, requestId: 'resume-001' });
  let replaced = false;
  players[1].on('session:replaced', () => { replaced = true; });
  const replacement = await f.connect();
  const resumed = await ok(replacement, 'room:resume', { code, token: sessions[1].token });
  await until(() => replaced && !players[1].connected);
  assert.equal(resumed.state.round.mine.points, result.points);
  assert.equal((await emit(replacement, 'answer:submit', { answer: 'Lisboa', roundId: host.state.round.id, requestId: 'resume-002' })).ok, false);
  assert.equal(f.server.game.rooms.get(code).players.size, 2);
});

test('host regressa durante a tolerância; depois da tolerância o controlo é transferido; o host que sai fecha a sala', async t => {
  const f = await fixture(t);
  const { host, players, sessions, code } = await group(f, 3);
  host.disconnect();
  const firstResume = await f.connect();
  await ok(firstResume, 'room:resume', { code, token: sessions[0].token });
  assert.equal(firstResume.state.hostId, sessions[0].playerId);
  firstResume.disconnect();
  await until(() => players[1].state.hostId === sessions[1].playerId);
  const secondResume = await f.connect();
  await ok(secondResume, 'room:resume', { code, token: sessions[0].token });
  assert.equal(secondResume.state.hostId, sessions[1].playerId);
  assert.equal((await emit(secondResume, 'game:start')).ok, false);
  await ok(players[2], 'room:leave');
  assert.equal(f.server.game.rooms.has(code), true, 'um jogador que sai não fecha a sala');
  const closed = new Promise(resolve => secondResume.once('room:closed', resolve));
  await ok(players[1], 'room:leave');
  await closed;
  assert.equal(f.server.game.rooms.has(code), false, 'o host que sai fecha a sala para todos');
  assert.equal((await emit(secondResume, 'game:start')).ok, false);
  const outsider = await f.connect();
  assert.equal((await emit(outsider, 'room:resume', { code, token: sessions[1].token })).ok, false, 'sair invalida a sessão');
});

test('isolamento de salas, autorização, nickname, configuração e payloads malformados', async t => {
  const f = await fixture(t);
  const { host, players, code } = await group(f, 2);
  const outsider = await f.connect();
  assert.equal((await emit(outsider, 'room:resume', { code, token: 'x'.repeat(48) })).ok, false);
  assert.equal((await emit(outsider, 'room:join', { code, nickname: 'JÓGADOR 1' })).ok, false);
  assert.equal((await emit(players[1], 'config:save', { revision: 1, config: config() })).ok, false);
  assert.equal((await emit(host, 'config:save', { revision: 0, config: config() })).ok, false);
  assert.equal((await emit(host, 'config:save', { revision: 1, config: {} })).ok, false);
  assert.equal((await emit(outsider, 'room:join', 42)).ok, false);
  const second = await ok(outsider, 'room:create', { nickname: 'Outra sala' });
  assert.notEqual(code, second.code);
  assert.equal(outsider.state.players.length, 1);
  await ok(host, 'game:start');
  await until(() => host.state.round.prompt);
  assert.equal(outsider.state.phase, 'lobby');
  assert.equal((await emit(outsider, 'answer:submit', { roundId: host.state.round.id, answer: 'Lisboa', requestId: 'outsider-1' })).ok, false);
  assert.equal((await emit(outsider, 'game:start')).ok, true, 'permite iniciar sozinho para testar');
});

test('sala vazia expira e token antigo não a recria', async t => {
  const f = await fixture(t, { emptyTtlMs: 40, cleanupIntervalMs: 10 });
  const { host, sessions, code } = await group(f, 1);
  host.disconnect();
  await until(() => !f.server.game.rooms.has(code));
  const socket = await f.connect();
  assert.equal((await emit(socket, 'room:resume', { code, token: sessions[0].token })).ok, false);
});

test('long polling funciona quando WebSocket não está disponível; origens alheias rejeitadas', async t => {
  const f = await fixture(t);
  const socket = await f.connect(['polling']);
  await ok(socket, 'room:create', { nickname: 'Polling' });
  assert.equal(socket.io.engine.transport.name, 'polling');
  const response = await fetch(`${f.url}/socket.io/?EIO=4&transport=polling`, { headers: { Origin: 'https://alheio.example' } });
  assert.equal(response.status, 403);
  assert.equal((await fetch(`${f.url}/health`)).status, 200);
});

test('20 jogadores e respostas concorrentes não duplicam pontos', async t => {
  const f = await fixture(t);
  const { host, players, code } = await group(f, 20);
  const answers = new Map(host.state.config.questions.map(q => [q.prompt, q.answers[0]]));
  const extra = await f.connect();
  assert.equal((await emit(extra, 'room:join', { code, nickname: 'Jogador 21' })).ok, false);
  await ok(host, 'game:start'); await until(() => players.every(p => p.state.round.prompt));
  const results = await Promise.all(players.flatMap((p, i) => [0, 1].map(() => ok(p, 'answer:submit', {
    answer: answers.get(p.state.round.prompt), requestId: `parallel-${i}`, roundId: p.state.round.id,
  }))));
  assert.ok(results.every(r => r.correct));
  await until(() => host.state.phase === 'results');
  assert.equal(host.state.players.reduce((sum, p) => sum + p.correct, 0), 20);
  assert.ok(host.state.players.every(p => p.score >= 1 && p.score <= 10));
});

test('imagens aleatórias, resposta visível 3 s, objetivo de pontos e avanço mesmo sem host', { timeout: 15000 }, async t => {
  const f = await fixture(t, { countdownMs: 80, resultsMs: 3000 });
  const { host, code, sessions } = await group(f, 1);
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
  const deck = { ...config([{ ...config().questions[0], image }, config().questions[1]]), targetPoints: 15 };
  await ok(host, 'config:save', { revision: 1, config: deck });
  assert.equal(host.state.config.questions[0].image, image, 'exportação mantém imagem embutida');
  await ok(host, 'game:start');
  const first = host.state.round.id;
  assert.equal(host.state.round.imageUrl, null);
  assert.equal((await fetch(`${f.url}/media/${code}/${first}`)).status, 404, 'imagem escondida antes de começar');
  await until(() => host.state.round.prompt);
  const firstHasImage = host.state.round.prompt === 'Capital de Portugal?';
  assert.equal(!!host.state.round.imageUrl, firstHasImage);
  assert.ok(!JSON.stringify(host.state).includes('base64'), 'as imagens não são repetidas em cada atualização Socket.IO');
  const checkImage = async socket => {
    const response = await fetch(`${f.url}${socket.state.round.imageUrl}`);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  };
  if (firstHasImage) await checkImage(host);
  await ok(host, 'answer:submit', { roundId: first, requestId: 'image-test-1', answer: firstHasImage ? 'Lisboa' : 'Marte' });
  assert.equal(host.state.phase, 'results');
  const resultsAt = Date.now();
  host.disconnect();
  await until(() => f.server.game.rooms.get(code).index === 1, 4500);
  assert.ok(Date.now() - resultsAt >= 2900 && Date.now() - resultsAt < 4000);
  const resumed = await f.connect();
  await ok(resumed, 'room:resume', { code, token: sessions[0].token });
  assert.equal(resumed.state.phase, 'question');
  assert.equal(!!resumed.state.round.imageUrl, !firstHasImage, 'alternância entre perguntas com e sem imagem');
  assert.equal(resumed.state.round.prompt, firstHasImage ? 'Planeta vermelho?' : 'Capital de Portugal?', 'sem nova contagem inicial');
  if (!firstHasImage) await checkImage(resumed);
  assert.equal(resumed.state.round.mine, null);
  await ok(resumed, 'answer:submit', { roundId: resumed.state.round.id, requestId: 'image-test-2', answer: firstHasImage ? 'Marte' : 'Lisboa' });
  assert.equal(resumed.state.winnerId, resumed.state.meId);
  await until(() => resumed.state.phase === 'finished', 4500);
  assert.equal(resumed.state.players[0].correct, 2);
  assert.ok(resumed.state.players[0].score >= 2 && resumed.state.players[0].score <= 20);
  assert.equal(resumed.state.config.questions[0].image, image);
  const invalid = { ...deck, questions: [{ ...deck.questions[0], image: 'data:image/svg+xml;base64,PHN2Zy8+' }] };
  assert.equal((await emit(resumed, 'config:save', { revision: resumed.state.revision, config: invalid })).ok, false);
  await ok(resumed, 'game:start');
  assert.equal(resumed.state.players[0].score, 0);
});
