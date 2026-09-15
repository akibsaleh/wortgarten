/**
 * P1-T4: Grading logic for typed production (EN→DE).
 * Typo-tolerant: Levenshtein ≤ 1 + umlaut fallback.
 * Pace thresholds from 06-examples-and-edge-cases.md §2 / Amendment A6.
 */
import type { Word } from '../db/schema';

/** Umlaut equivalence map: ASCII fallbacks ↔ proper German. */
const UMLAUT_EQUIV: [RegExp, string][] = [
  [/ae/g, 'ä'], [/oe/g, 'ö'], [/ue/g, 'ü'], [/ss/g, 'ß'],
  [/(.+)ae/g, '$1ä'], [/(.+)oe/g, '$1ö'], [/(.+)ue/g, '$1ü'],
];

/** Normalize a string for comparison: lowercase, strip punctuation, collapse whitespace. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-zäöüß\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize with umlaut fallbacks applied (ae→ä, etc.). */
function normalizeWithFallback(s: string): string {
  let n = normalize(s);
  for (const [repl, orig] of UMLAUT_EQUIV) {
    n = n.replace(repl, orig);
  }
  return n;
}

/** Levenshtein distance between two strings. */
function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  const dp: number[][] = Array.from({ length: la + 1 }, () => Array(lb + 1).fill(0) as number[]);
  for (let i = 0; i <= la; i++) dp[i]![0] = i;
  for (let j = 0; j <= lb; j++) dp[0]![j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[la]![lb]!;
}

export type GradeResult = 'correct' | 'typo' | 'wrong';

export interface GradingInput {
  answer: string;
  word: Word;
}

export interface GradingOutput {
  grade: GradeResult;
  /** The correct answer to show in feedback. */
  correctForm: string;
  /** For nouns, the required article. */
  article: string | null;
}

/**
 * Grade a typed production answer for a noun.
 * Expects "article lemma" (e.g. "das Buch").
 */
function gradeNoun(answer: string, word: Word): GradingOutput {
  const article = word.gender;
  const correctForm = article ? `${article} ${word.lemma}` : word.lemma;

  const normAnswer = normalizeWithFallback(answer);
  const normCorrect = normalizeWithFallback(correctForm);

  // Exact match after normalization
  if (normAnswer === normCorrect) {
    return { grade: 'correct', correctForm, article };
  }

  // Check if article is missing
  if (article && !normAnswer.startsWith(normalize(article))) {
    return { grade: 'wrong', correctForm, article };
  }

  // Strip article from answer and check lemma with Levenshtein
  const answerLemma = article
    ? normAnswer.replace(new RegExp(`^${normalize(article)}\\s*`), '')
    : normAnswer;

  if (levenshtein(answerLemma, normalizeWithFallback(word.lemma)) <= 1) {
    return { grade: 'typo', correctForm, article };
  }

  return { grade: 'wrong', correctForm, article };
}

/**
 * Grade a typed production answer for a non-noun.
 */
function gradeNonNoun(answer: string, word: Word): GradingOutput {
  const normAnswer = normalizeWithFallback(answer);
  const normCorrect = normalizeWithFallback(word.lemma);

  if (normAnswer === normCorrect) {
    return { grade: 'correct', correctForm: word.lemma, article: null };
  }

  if (levenshtein(normAnswer, normCorrect) <= 1) {
    return { grade: 'typo', correctForm: word.lemma, article: null };
  }

  return { grade: 'wrong', correctForm: word.lemma, article: null };
}

/** Grade a typed production answer. */
export function grade(input: GradingInput): GradingOutput {
  if (input.word.pos === 'noun') {
    return gradeNoun(input.answer, input.word);
  }
  return gradeNonNoun(input.answer, input.word);
}

/**
 * Grade a recognition answer (EN→DE or DE→EN meaning recall).
 * Compares the typed English answer against the word's gloss_en.
 * Uses fuzzy matching: exact match, substring containment, or Levenshtein ≤ 1
 * on the normalised tokens.
 */
export function gradeRecognition(input: GradingInput): GradingOutput {
  const normAnswer = normalize(input.answer);
  const gloss = input.word.gloss_en;
  const normCorrect = normalize(gloss);

  // Exact match
  if (normAnswer === normCorrect) {
    return { grade: 'correct', correctForm: gloss, article: null };
  }

  // Substring containment (e.g. "to learn" ↔ "learn")
  if (normCorrect.includes(normAnswer) || normAnswer.includes(normCorrect)) {
    return { grade: 'correct', correctForm: gloss, article: null };
  }

  // Check each token of the gloss against the answer tokens
  const answerTokens = normAnswer.split(/\s+/).filter(Boolean);
  const glossTokens = normCorrect.split(/\s+/).filter(Boolean);
  const allTokensMatch = glossTokens.every((gt) =>
    answerTokens.some(
      (at) => at === gt || levenshtein(at, gt) <= 1,
    ),
  );
  if (allTokensMatch && answerTokens.length > 0) {
    return { grade: 'correct', correctForm: gloss, article: null };
  }

  // Close Levenshtein on full string
  if (levenshtein(normAnswer, normCorrect) <= 1) {
    return { grade: 'typo', correctForm: gloss, article: null };
  }

  return { grade: 'wrong', correctForm: gloss, article: null };
}

/** Pace thresholds from Amendment A6. */
export function paceFromMs(ms: number): 'instant' | 'normal' | 'slow' {
  if (ms < 2500) return 'instant';
  if (ms > 20000) return 'slow';
  return 'normal';
}

/**
 * Map grade result + pace to FSRS rating.
 * PLAN.md §3: wrong→Again, hint/typo/slow→Hard, correct→Good, instant→Easy.
 */
export function gradeToRating(
  gradeResult: GradeResult,
  pace: 'instant' | 'normal' | 'slow',
): 'wrong' | 'hard' | 'good' | 'easy' {
  if (gradeResult === 'wrong') return 'wrong';
  if (gradeResult === 'typo') return 'hard';
  if (pace === 'slow') return 'hard';
  if (pace === 'instant') return 'easy';
  return 'good';
}
