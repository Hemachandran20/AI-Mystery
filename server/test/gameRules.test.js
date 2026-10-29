import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore } from '../src/services/gameRules.js';

test('calculates correct scores from server-side difficulty, clues, and hints', () => {
  assert.equal(calculateScore({ difficulty: 'Easy', isCorrect: true, discoveredClueCount: 2, hintsUsed: 1 }), 100);
  assert.equal(calculateScore({ difficulty: 'Medium', isCorrect: true, discoveredClueCount: 7, hintsUsed: 3 }), 155);
  assert.equal(calculateScore({ difficulty: 'Hard', isCorrect: true, discoveredClueCount: 9, hintsUsed: 3 }), 215);
  assert.equal(calculateScore({ difficulty: 'Easy', isCorrect: true, discoveredClueCount: 0, hintsUsed: 20 }), 0);
});

test('incorrect accusation scores zero', () => {
  assert.equal(calculateScore({ difficulty: 'Hard', isCorrect: false, discoveredClueCount: 9, hintsUsed: 0 }), 0);
});
