import { textQuestions } from './content/text-questions.js';
import photoQuestions from './content/photo-questions.json' with { type: 'json' };
import questionImages from './content/question-images.json' with { type: 'json' };

// Clue photos for text questions live as files in content/images and attach by prompt.
const imagesByPrompt = new Map(questionImages.map(photo => [photo.prompt, photo]));
const withImage = question => {
  const photo = imagesByPrompt.get(question.prompt);
  return photo ? { ...question, imageFile: photo.file, imageCredit: photo.credit, imageSource: photo.source,
    ...(photo.license ? { imageLicense: photo.license } : {}) } : question;
};

export const defaultConfig = {
  durationSeconds: 20,
  targetPoints: 50,
  fuzzy: true,
  shuffle: true,
  questions: [...textQuestions.map(withImage), ...photoQuestions],
};
