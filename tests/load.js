import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { fixture, group, config, ok, until } from './helpers.js';

// Reproducible localhost protocol check, not a claim about public internet latency.
const f = await fixture(null, { countdownMs: 50, resultsMs: 100 });
try {
  const { host, players } = await group(f, 20);
  await ok(host, 'config:save', { revision: 1, config: { ...config(Array.from({ length: 10 }, (_, i) => ({
    theme: 'Carga', prompt: `Ronda ${i + 1}: escreve Lisboa`, answers: ['Lisboa'],
  }))), targetPoints: 1000 } });
  await ok(host, 'game:start');
  const latencies = [];
  for (let round = 0; round < 10; round++) {
    await until(() => players.every(p => p.state.round.number === round + 1 && p.state.round.prompt && p.state.phase === 'question'));
    await Promise.all(players.map(async (p, i) => {
      const start = performance.now();
      const result = await ok(p, 'answer:submit', { roundId: p.state.round.id, answer: 'Lisboa', requestId: `load-${round}-${i}` });
      assert.equal(result.correct, true); latencies.push(performance.now() - start);
    }));
    await until(() => players.every(p => p.state.phase === 'results'));
    assert.ok(host.state.players.every(p => p.correct === round + 1));
  }
  assert.notEqual(host.state.phase, 'finished');
  assert.equal(host.state.winnerId, null);
  latencies.sort((a, b) => a - b);
  const percentile = p => Number(latencies[Math.ceil(latencies.length * p) - 1].toFixed(2));
  console.log(JSON.stringify({ players: 20, rounds: 10, acceptedAnswers: latencies.length,
    transport: 'websocket', environment: 'localhost / same Node process',
    acknowledgementMs: { p50: percentile(.5), p95: percentile(.95), max: percentile(1) },
    allPlayersScoredExactlyOncePerRound: true }, null, 2));
} finally { await f.close(); }
