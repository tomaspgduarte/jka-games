import test from 'node:test';
import assert from 'node:assert/strict';
import { distance, isCorrect, normalize, pointsFor, roundPointsFor } from '../server/answers.js';
import { validateConfig, shuffleQuestions } from '../server/game.js';
import { config } from './helpers.js';

test('normaliza maiúsculas, acentos, pontuação e espaços', () => {
  assert.equal(normalize('  SÃO   PAULO!!! '), 'sao paulo');
  assert.equal(isCorrect('LISBÓA!', ['Lisboa'], false), true);
  assert.equal(isCorrect('Lisbon', ['Lisboa', 'Lisbon'], false), true);
  assert.equal(isCorrect('!!!', ['Lisboa'], true), false);
});
test('tolerância limitada, transposição e números exatos', () => {
  assert.equal(distance('lisboa', 'lisoba'), 1);
  assert.equal(isCorrect('Lisoba', ['Lisboa'], true), true);
  assert.equal(isCorrect('Lisoba', ['Lisboa'], false), false);
  assert.equal(isCorrect('abcdxfghiy', ['abcdefghij'], true), true);
  assert.equal(isCorrect('abcdxfghyz', ['abcdefghij'], true), false);
  assert.equal(isCorrect('Quen', ['Queen'], true), true);
  assert.equal(isCorrect('Quxxn', ['Queen'], true), false);
  assert.equal(isCorrect('Mar', ['Mars'], true), false);
  assert.equal(isCorrect('1998', ['1997'], true), false);
  assert.equal(isCorrect('Toy Story 4', ['Toy Story 3'], true), false);
});
test('pontos calculados a partir do tempo de receção no servidor', () => {
  assert.equal(pointsFor(0, 20000), 10);
  assert.equal(pointsFor(2000, 20000), 9);
  assert.equal(pointsFor(5000, 20000), 8);
  assert.equal(pointsFor(10000, 20000), 5);
  assert.equal(pointsFor(19999, 20000), 1);
  assert.equal(pointsFor(20000, 20000), 1);
});
test('o primeiro a acertar e quem acerta até 1 s depois ganham 10; depois desce com a ordem e o tempo', () => {
  assert.equal(roundPointsFor(18000, 20000, []), 10, 'o primeiro ganha 10 mesmo tarde');
  assert.equal(roundPointsFor(6000, 20000, [5000]), 10, 'quase ao mesmo tempo também ganha 10');
  assert.equal(roundPointsFor(6001, 20000, [5000]), 6, '7 pelo tempo − 1 por um jogador antes');
  assert.equal(roundPointsFor(8000, 20000, [5000, 5500]), 4, '6 pelo tempo − 2');
  assert.equal(roundPointsFor(19000, 20000, [1000, 2000, 3000]), 1, 'nunca menos de 1');
});
test('configuração rejeita valores inválidos e limita perguntas e respostas', () => {
  assert.deepEqual(validateConfig(config()), config());
  for (const patch of [{ durationSeconds: 0 }, { durationSeconds: 5.5 }, { fuzzy: 'true' },
    { targetPoints: 0 }, { targetPoints: 1001 }, { targetPoints: 2.5 },
    { questions: [] }, { questions: Array(501).fill(config().questions[0]) },
    { questions: [{ theme: '', prompt: '', answers: ['a'] }] },
    { questions: [{ theme: '', prompt: 'abc', answers: ['!!!'] }] }]) {
    assert.throws(() => validateConfig({ ...config(), ...patch }));
  }
  const legacy = { ...config(), targetPoints: undefined, shuffle: false };
  assert.equal(validateConfig(legacy).targetPoints, 50);
  assert.equal(validateConfig(legacy).shuffle, true);
});

test('baralha cada ciclo sem perder perguntas nem repetir a última logo a seguir', () => {
  const questions = Array.from({ length: 8 }, (_, i) => ({ prompt: String(i) }));
  let previous = questions[7];
  for (let cycle = 0; cycle < 100; cycle++) {
    const deck = shuffleQuestions(questions, previous);
    assert.equal(new Set(deck).size, questions.length);
    assert.deepEqual(new Set(deck), new Set(questions));
    assert.notEqual(deck[0], previous);
    previous = deck.at(-1);
  }
  assert.deepEqual(shuffleQuestions([questions[0]], questions[0]), [questions[0]]);
});
