import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig } from '../server/defaults.js';
import { normalize, isCorrect } from '../server/answers.js';
import { decodeImage, loadBankImage } from '../server/images.js';
import { validateConfig } from '../server/game.js';
import { fixture, group, ok, until } from './helpers.js';

test('banco de 436 perguntas: 14 temas, respostas válidas, 12 fotos embutidas, 73 pistas em ficheiro e configuração exportável', () => {
  const bank = validateConfig(defaultConfig);
  assert.equal(bank.questions.length, 436);
  assert.equal(new Set(bank.questions.map(q => q.theme)).size, 14);
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
  const clues = bank.questions.filter(q => q.imageFile);
  assert.equal(clues.length, 73, 'fotografias-pista guardadas como ficheiros');
  assert.ok(clues.every(q => loadBankImage(q.imageFile) && q.imageCredit && q.imageSource.startsWith('https://commons.wikimedia.org/')));
  assert.equal(new Set(clues.map(q => q.imageFile)).size, clues.length, 'cada pista tem o seu ficheiro');
  assert.equal(loadBankImage('../defaults.js'), null, 'só nomes simples da pasta de imagens');
  assert.deepEqual(validateConfig(JSON.parse(JSON.stringify(bank))), bank, 'importar/exportar preserva as imagens e créditos');
});

test('fotografia-pista em ficheiro só é servida depois de a pergunta começar', async t => {
  const clue = defaultConfig.questions.find(q => q.imageFile && q.answers.includes('Batman'));
  const f = await fixture(t, { defaultConfig: { ...defaultConfig, targetPoints: 1, questions: [clue] } });
  const { host, code } = await group(f, 1);
  await ok(host, 'game:start');
  assert.equal((await fetch(`${f.url}/media/${code}/${host.state.round.id}`)).status, 404, 'escondida durante a contagem');
  await until(() => host.state.round.imageUrl);
  assert.equal(host.state.round.imageCredit, undefined, 'o crédito pode dar a resposta: só no fim');
  const response = await fetch(`${f.url}${host.state.round.imageUrl}`);
  assert.equal(response.headers.get('content-type'), 'image/jpeg');
  assert.equal(Buffer.from(await response.arrayBuffer()).compare(loadBankImage(clue.imageFile).bytes), 0);
  await ok(host, 'answer:submit', { roundId: host.state.round.id, answer: 'batman', requestId: 'clue-photo-1' });
  assert.equal(host.state.round.imageCredit, clue.imageCredit);
});

test('banco completo passa por Socket.IO; aspas serve fotografia e só revela resposta/créditos no fim', async t => {
  const f = await fixture(t);
  const { host, players } = await group(f, 2);
  await ok(host, 'config:save', { revision: host.state.revision, config: defaultConfig });
  assert.equal(host.state.questionCount, 436);
  assert.equal(host.state.categories.length, 14);
  assert.equal(host.state.config, undefined, 'nem o host recebe perguntas e respostas');
  await until(() => players[1].state.questionCount === 436);
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
