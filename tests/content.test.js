import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultConfig } from '../server/defaults.js';
import { normalize, isCorrect } from '../server/answers.js';
import { decodeImage } from '../server/images.js';
import { validateConfig } from '../server/game.js';
import { fixture, group, ok, until } from './helpers.js';

test('banco de 252 perguntas: 8 temas, respostas válidas, 12 fotos e configuração exportável', () => {
  const bank = validateConfig(defaultConfig);
  assert.equal(bank.questions.length, 252);
  assert.equal(new Set(bank.questions.map(q => q.theme)).size, 8);
  assert.deepEqual([...new Set(bank.questions.map(q => q.theme))], ['VALORANT', 'Counter-Strike', 'F1', 'Basketball', 'Football', 'Hip-hop / Rap', 'Songs', 'Characters']);
  assert.ok(bank.questions.every(q => /^(Which|What|Who|How|In|On)\b.*\?$/.test(q.prompt)), 'todas as perguntas estão em inglês');
  assert.deepEqual(JSON.parse(readFileSync(new URL('../examples/banco-completo.json', import.meta.url), 'utf8')), defaultConfig, 'o ficheiro de importação usa o banco inglês atual');
  const rebound = bank.questions.find(q => q.prompt === 'What is recovering the ball after a missed shot called?');
  assert.ok(isCorrect('REBOUND', rebound.answers, false));
  assert.ok(isCorrect('ressalto', rebound.answers, false), 'preserva respostas portuguesas já aceites');
  const five = bank.questions.find(q => q.prompt === 'How many players are on each team in a standard competitive Counter-Strike match?');
  assert.ok(isCorrect('five', five.answers, false));
  const flag = bank.questions.find(q => q.prompt === 'Which flag signals the end of an F1 race?');
  assert.ok(isCorrect('chequered flag', flag.answers, false));
  assert.ok(isCorrect('checkered flag', flag.answers, false));
  const signatures = new Set();
  for (const q of bank.questions) {
    assert.ok(q.answers.every(a => normalize(a) && isCorrect(a, q.answers, false)));
    const signature = q.theme + ':' + q.prompt + ':' + q.answers.join('|');
    assert.equal(signatures.has(signature), false, 'pergunta exata duplicada'); signatures.add(signature);
  }
  const photos = bank.questions.filter(q => q.image);
  assert.equal(photos.length, 12);
  assert.ok(photos.every(q => decodeImage(q.image) && q.imageCredit && q.imageSource.startsWith('https://')));
  assert.ok(photos.some(q => q.answers.includes('aspas')));
  assert.deepEqual(validateConfig(JSON.parse(JSON.stringify(bank))), bank, 'importar/exportar preserva as imagens e créditos');
});

test('banco completo passa por Socket.IO; aspas serve fotografia e só revela resposta/créditos no fim', async t => {
  const f = await fixture(t);
  const { host, players } = await group(f, 2);
  await ok(host, 'config:save', { revision: host.state.revision, config: defaultConfig });
  assert.equal(host.state.config.questions.length, 252);
  await until(() => players[1].state.questionCount === 252);
  assert.equal(players[1].state.config, undefined);
  const aspas = defaultConfig.questions.find(q => q.image && q.answers.includes('aspas'));
  await ok(host, 'config:save', { revision: host.state.revision, config: { ...defaultConfig, targetPoints: 1, questions: [aspas] } });
  await ok(host, 'game:start'); await until(() => host.state.round.imageUrl);
  assert.equal(host.state.round.imageSource, undefined);
  assert.equal(host.state.round.imageCredit, undefined);
  assert.equal(host.state.round.answers, undefined);
  const response = await fetch(`${f.url}${host.state.round.imageUrl}`);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(Buffer.from(await response.arrayBuffer()).compare(decodeImage(aspas.image).bytes), 0);
  const receipt = await ok(host, 'answer:submit', { roundId: host.state.round.id, answer: 'ASPAS', requestId: 'photo-aspas-1' });
  assert.equal(receipt.correct, true);
  assert.equal(host.state.round.imageSource, aspas.imageSource);
  assert.equal(host.state.round.imageCredit, aspas.imageCredit);
  await until(() => host.state.phase === 'finished');
});
