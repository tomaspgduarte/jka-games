export function normalize(value) {
  return String(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

// Bounded Damerau-Levenshtein: also accepts a swap of two adjacent letters.
export function distance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[a.length][b.length];
}

export function isCorrect(input, aliases, fuzzy) {
  const guess = normalize(input);
  if (!guess) return false;
  return aliases.some(raw => {
    const answer = normalize(raw);
    if (guess === answer) return true;
    if (!fuzzy || answer.length < 5) return false;
    // Never forgive a changed number, year or sequel number.
    if (JSON.stringify(guess.match(/\d+/g)) !== JSON.stringify(answer.match(/\d+/g))) return false;
    const allowed = answer.length >= 10 ? 2 : 1;
    return Math.abs(guess.length - answer.length) <= allowed && distance(guess, answer) <= allowed;
  });
}

export function pointsFor(elapsedMs, durationMs) {
  return Math.max(1, Math.min(10, Math.ceil(10 * (1 - elapsedMs / durationMs))));
}
