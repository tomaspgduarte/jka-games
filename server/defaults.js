import { textQuestions } from './content/text-questions.js';
import photoQuestions from './content/photo-questions.json' with { type: 'json' };

export const defaultConfig = {
  durationSeconds: 20,
  targetPoints: 50,
  fuzzy: true,
  shuffle: true,
  questions: [...textQuestions, ...photoQuestions],
};
