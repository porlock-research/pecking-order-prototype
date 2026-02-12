/**
 * OpenTriviaDB Integration
 *
 * Fetches multiple-choice questions from the Open Trivia Database API.
 * Falls back to a hardcoded pool on API failure.
 */

export interface TriviaQuestion {
  question: string;
  options: string[];       // shuffled (correct mixed in)
  correctIndex: number;    // index of correct answer in options
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface OpenTDBResponse {
  response_code: number;
  results: Array<{
    type: string;
    difficulty: string;
    category: string;
    question: string;
    correct_answer: string;
    incorrect_answers: string[];
  }>;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function transformQuestion(raw: OpenTDBResponse['results'][number]): TriviaQuestion {
  const correct = decodeURIComponent(raw.correct_answer);
  const incorrect = raw.incorrect_answers.map(a => decodeURIComponent(a));
  const allOptions = shuffleArray([correct, ...incorrect]);
  const correctIndex = allOptions.indexOf(correct);

  return {
    question: decodeURIComponent(raw.question),
    options: allOptions,
    correctIndex,
    category: decodeURIComponent(raw.category),
    difficulty: raw.difficulty as TriviaQuestion['difficulty'],
  };
}

export async function fetchTriviaQuestions(amount = 50): Promise<TriviaQuestion[]> {
  const url = `https://opentdb.com/api.php?amount=${amount}&type=multiple&encode=url3986`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenTDB HTTP ${res.status}`);

  const data: OpenTDBResponse = await res.json();
  if (data.response_code !== 0) {
    throw new Error(`OpenTDB response_code: ${data.response_code}`);
  }

  return data.results.map(transformQuestion);
}

export const FALLBACK_QUESTIONS: TriviaQuestion[] = [
  { question: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], correctIndex: 1, category: "Science", difficulty: "easy" },
  { question: "What is the hardest natural substance on Earth?", options: ["Gold", "Iron", "Diamond", "Quartz"], correctIndex: 2, category: "Science", difficulty: "easy" },
  { question: "How many bones does an adult human body have?", options: ["186", "206", "226", "246"], correctIndex: 1, category: "Science", difficulty: "medium" },
  { question: "Which ocean is the largest?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], correctIndex: 3, category: "Geography", difficulty: "easy" },
  { question: "What gas do plants absorb from the atmosphere?", options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Helium"], correctIndex: 2, category: "Science", difficulty: "easy" },
  { question: "Who painted the Mona Lisa?", options: ["Michelangelo", "Raphael", "Da Vinci", "Donatello"], correctIndex: 2, category: "Art", difficulty: "easy" },
  { question: "What is the chemical symbol for gold?", options: ["Go", "Gd", "Au", "Ag"], correctIndex: 2, category: "Science", difficulty: "medium" },
  { question: "Which country has the most time zones?", options: ["Russia", "USA", "France", "China"], correctIndex: 2, category: "Geography", difficulty: "hard" },
  { question: "What is the smallest prime number?", options: ["0", "1", "2", "3"], correctIndex: 2, category: "Mathematics", difficulty: "easy" },
  { question: "Which element has the atomic number 1?", options: ["Helium", "Hydrogen", "Lithium", "Carbon"], correctIndex: 1, category: "Science", difficulty: "easy" },
  { question: "How many players are on a soccer team?", options: ["9", "10", "11", "12"], correctIndex: 2, category: "Sports", difficulty: "easy" },
  { question: "What year did the Titanic sink?", options: ["1905", "1912", "1918", "1923"], correctIndex: 1, category: "History", difficulty: "medium" },
  { question: "Which animal is the tallest in the world?", options: ["Elephant", "Giraffe", "Blue Whale", "Ostrich"], correctIndex: 1, category: "Nature", difficulty: "easy" },
  { question: "What is the speed of light (approx)?", options: ["300 km/s", "3,000 km/s", "30,000 km/s", "300,000 km/s"], correctIndex: 3, category: "Science", difficulty: "hard" },
  { question: "In which continent is the Sahara Desert?", options: ["Asia", "South America", "Africa", "Australia"], correctIndex: 2, category: "Geography", difficulty: "easy" },
];
