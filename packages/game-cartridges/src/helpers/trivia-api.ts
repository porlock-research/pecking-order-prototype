/**
 * OpenTriviaDB Integration
 *
 * Fetches multiple-choice questions from the Open Trivia Database API.
 * Falls back to a hardcoded pool on API failure.
 */

export interface TriviaQuestion {
  id: string;              // stable identifier for dedup across retries
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

  const questionText = decodeURIComponent(raw.question);
  return {
    id: questionText,
    question: questionText,
    options: allOptions,
    correctIndex,
    category: decodeURIComponent(raw.category),
    difficulty: raw.difficulty as TriviaQuestion['difficulty'],
  };
}

export async function fetchTriviaQuestions(amount = 50): Promise<TriviaQuestion[]> {
  // Fetch easy + medium only (no hard questions). Split evenly between difficulties.
  const half = Math.ceil(amount / 2);
  // category=9 = General Knowledge (avoids obscure anime/video game categories)
  const base = 'https://opentdb.com/api.php?type=multiple&encode=url3986&category=9';

  const [easyRes, mediumRes] = await Promise.all([
    fetch(`${base}&amount=${half}&difficulty=easy`),
    fetch(`${base}&amount=${half}&difficulty=medium`),
  ]);

  const results: OpenTDBResponse['results'] = [];

  for (const res of [easyRes, mediumRes]) {
    if (!res.ok) throw new Error(`OpenTDB HTTP ${res.status}`);
    const data: OpenTDBResponse = await res.json();
    if (data.response_code !== 0) {
      throw new Error(`OpenTDB response_code: ${data.response_code}`);
    }
    results.push(...data.results);
  }

  return shuffleArray(results.map(transformQuestion));
}

export const FALLBACK_QUESTIONS: TriviaQuestion[] = [
  { id: "fb-1", question: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], correctIndex: 1, category: "Science", difficulty: "easy" },
  { id: "fb-2", question: "What is the hardest natural substance on Earth?", options: ["Gold", "Iron", "Diamond", "Quartz"], correctIndex: 2, category: "Science", difficulty: "easy" },
  { id: "fb-3", question: "How many bones does an adult human body have?", options: ["186", "206", "226", "246"], correctIndex: 1, category: "Science", difficulty: "medium" },
  { id: "fb-4", question: "Which ocean is the largest?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], correctIndex: 3, category: "Geography", difficulty: "easy" },
  { id: "fb-5", question: "What gas do plants absorb from the atmosphere?", options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Helium"], correctIndex: 2, category: "Science", difficulty: "easy" },
  { id: "fb-6", question: "Who painted the Mona Lisa?", options: ["Michelangelo", "Raphael", "Da Vinci", "Donatello"], correctIndex: 2, category: "Art", difficulty: "easy" },
  { id: "fb-7", question: "What is the chemical symbol for gold?", options: ["Go", "Gd", "Au", "Ag"], correctIndex: 2, category: "Science", difficulty: "medium" },
  { id: "fb-8", question: "Which country has the most time zones?", options: ["Russia", "USA", "France", "China"], correctIndex: 2, category: "Geography", difficulty: "medium" },
  { id: "fb-9", question: "What is the smallest prime number?", options: ["0", "1", "2", "3"], correctIndex: 2, category: "Mathematics", difficulty: "easy" },
  { id: "fb-10", question: "Which element has the atomic number 1?", options: ["Helium", "Hydrogen", "Lithium", "Carbon"], correctIndex: 1, category: "Science", difficulty: "easy" },
  { id: "fb-11", question: "How many players are on a soccer team?", options: ["9", "10", "11", "12"], correctIndex: 2, category: "Sports", difficulty: "easy" },
  { id: "fb-12", question: "What year did the Titanic sink?", options: ["1905", "1912", "1918", "1923"], correctIndex: 1, category: "History", difficulty: "medium" },
  { id: "fb-13", question: "Which animal is the tallest in the world?", options: ["Elephant", "Giraffe", "Blue Whale", "Ostrich"], correctIndex: 1, category: "Nature", difficulty: "easy" },
  { id: "fb-14", question: "What is the speed of light (approx)?", options: ["300 km/s", "3,000 km/s", "30,000 km/s", "300,000 km/s"], correctIndex: 3, category: "Science", difficulty: "medium" },
  { id: "fb-15", question: "In which continent is the Sahara Desert?", options: ["Asia", "South America", "Africa", "Australia"], correctIndex: 2, category: "Geography", difficulty: "easy" },
];
