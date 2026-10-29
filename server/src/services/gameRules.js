import { DIFFICULTY_RULES } from '../models/Case.js';

export function calculateScore({ difficulty, isCorrect, discoveredClueCount, hintsUsed }) {
  if (!isCorrect) return 0;
  const rules = DIFFICULTY_RULES[difficulty];
  if (!rules) throw new TypeError('Unsupported difficulty.');
  return Math.max(0, rules.baseScore + (discoveredClueCount * 5) - (hintsUsed * 10));
}
