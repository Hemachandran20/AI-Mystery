import test from 'node:test';
import assert from 'node:assert/strict';
import Case from '../src/models/Case.js';
import { serializePublicCase } from '../src/routes/cases.js';

test('solution is excluded from Mongoose queries by default', () => {
  assert.equal(Case.schema.path('solution').options.select, false);
});

test('public case serialization excludes the hidden solution', () => {
  const value = serializePublicCase({
    _id: 'case-id', title: 'Case', premise: 'Premise', difficulty: 'Easy', summary: 'Summary',
    suspects: [], clues: [], discoveredClueIds: [], hintsUsed: 0, status: 'active',
    solution: { culpritSuspectId: 'suspect-secret', explanation: 'secret explanation' },
  });
  const json = JSON.stringify(value);
  assert.equal(json.includes('suspect-secret'), false);
  assert.equal(json.includes('secret explanation'), false);
  assert.equal(Object.hasOwn(value, 'solution'), false);
});
