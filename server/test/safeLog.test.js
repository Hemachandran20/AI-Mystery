import test from 'node:test';
import assert from 'node:assert/strict';
import { logServerError } from '../src/utils/safeLog.js';

test('redacts database URIs, API keys, passwords, and bearer tokens from diagnostics', () => {
  const lines = [];
  const originalError = console.error;
  console.error = (line) => lines.push(line);
  try {
    logServerError('test', new Error('mongodb+srv://db-user:db-password@cluster.example/db?key=AIzaSyExampleLongApiKey1234567890 password=privateValue Bearer privateToken'));
  } finally {
    console.error = originalError;
  }

  assert.equal(lines.length, 1);
  assert.match(lines[0], /MongoDB URI redacted/);
  assert.equal(lines[0].includes('db-password'), false);
  assert.equal(lines[0].includes('AIzaSyExampleLongApiKey1234567890'), false);
  assert.equal(lines[0].includes('privateValue'), false);
  assert.equal(lines[0].includes('privateToken'), false);
});
