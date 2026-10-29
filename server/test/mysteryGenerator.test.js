import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateMystery,
  GeminiConfigurationError,
  MODEL_NAME,
  MysteryGenerationError,
  SUPPORTED_FALLBACK_MODELS,
} from '../src/services/mysteryGenerator.js';

const rules = { Easy: [3, 5, 2], Medium: [4, 7, 3], Hard: [5, 9, 3] };

test('uses the current Gemini 3.8 Flash model ID', () => {
  assert.equal(MODEL_NAME, 'gemini-3-flash-preview');
});

function fixture(difficulty) {
  const [suspectCount, clueCount, hintCount] = rules[difficulty];
  return {
    title: 'The Missing Ledger',
    summary: 'A ledger vanished during a quiet reception.',
    suspects: Array.from({ length: suspectCount }, (_, i) => ({ id: `suspect-${i}`, name: `Suspect ${i}`, description: 'A detailed description.', motive: 'A plausible motive.', alibi: 'An alibi to investigate.' })),
    clues: Array.from({ length: clueCount }, (_, i) => ({ id: `clue-${i}`, title: `Clue ${i}`, teaser: 'Something looks unusual.', text: 'The full evidence text.' })),
    hints: Array.from({ length: hintCount }, (_, i) => `Consider the timeline, step ${i + 1}.`),
    solution: { culpritSuspectId: 'suspect-0', explanation: 'The timeline places suspect 0 at the scene.', keyEvidenceClueIds: ['clue-0'] },
  };
}

test('accepts correct suspect, clue, and hint counts at every difficulty', async () => {
  for (const difficulty of Object.keys(rules)) {
    const data = fixture(difficulty);
    const result = await generateMystery({ premise: 'A test premise.', difficulty }, { generateContent: async () => ({ text: JSON.stringify(data) }) });
    assert.equal(result.suspects.length, rules[difficulty][0]);
    assert.equal(result.clues.length, rules[difficulty][1]);
    assert.equal(result.hints.length, rules[difficulty][2]);
  }
});

test('retries invalid generated data up to three total attempts and then returns a safe error', async () => {
  let attempts = 0;
  await assert.rejects(
    generateMystery({ premise: 'A test premise.', difficulty: 'Easy' }, {
      fallbackModel: null,
      sleep: async () => {},
      generateContent: async () => { attempts += 1; return { text: '{bad json' }; },
    }),
    MysteryGenerationError,
  );
  assert.equal(attempts, 3);
});

test('rejects a culprit reference that does not point to a suspect', async () => {
  const data = fixture('Easy');
  data.solution.culpritSuspectId = 'unknown';
  await assert.rejects(generateMystery({ premise: 'A test premise.', difficulty: 'Easy' }, { sleep: async () => {}, generateContent: async () => ({ text: JSON.stringify(data) }) }), MysteryGenerationError);
});

test('rejects a hint that directly names the culprit', async () => {
  const data = fixture('Easy');
  data.hints[0] = 'Suspect 0 is responsible.';
  await assert.rejects(generateMystery({ premise: 'A test premise.', difficulty: 'Easy' }, { sleep: async () => {}, generateContent: async () => ({ text: JSON.stringify(data) }) }), MysteryGenerationError);
});

test('retries transient 503 responses with bounded exponential backoff', async () => {
  const models = [];
  const delays = [];
  const retryLogs = [];
  let calls = 0;
  const mystery = fixture('Easy');
  const originalInfo = console.info;
  console.info = (line) => retryLogs.push(line);
  let result;
  try {
    result = await generateMystery({ premise: 'A test premise.', difficulty: 'Easy' }, {
      fallbackModel: null,
      sleep: async (delay) => delays.push(delay),
      generateContent: async (_prompt, { model }) => {
        models.push(model);
        calls += 1;
        if (calls < 3) {
          const error = new Error('Service unavailable');
          error.status = 503;
          throw error;
        }
        return { text: JSON.stringify(mystery) };
      },
    });
  } finally {
    console.info = originalInfo;
  }

  assert.equal(result.title, mystery.title);
  assert.equal(calls, 3);
  assert.deepEqual(models, [MODEL_NAME, MODEL_NAME, MODEL_NAME]);
  assert.deepEqual(delays, [1_000, 2_000]);
  assert.deepEqual(retryLogs, [
    '[gemini retry] next_attempt=2/3 model=gemini-3-flash-preview delay_ms=1000 reason=transient_failure',
    '[gemini retry] next_attempt=3/3 model=gemini-3-flash-preview delay_ms=2000 reason=transient_failure',
  ]);
});

test('does not retry permanent authentication, malformed-request, or unrelated not-found errors', async () => {
  for (const status of [400, 401, 403, 404]) {
    let calls = 0;
    const delays = [];
    await assert.rejects(generateMystery({ premise: 'A test premise.', difficulty: 'Easy' }, {
      fallbackModel: null,
      sleep: async (delay) => delays.push(delay),
      generateContent: async () => {
        calls += 1;
        const error = new Error('Permanent request error');
        error.status = status;
        throw error;
      },
    }), MysteryGenerationError);
    assert.equal(calls, 1);
    assert.deepEqual(delays, []);
  }
});

test('retries fetch failures and logs the underlying network cause', async () => {
  let calls = 0;
  const delays = [];
  const logLines = [];
  const originalError = console.error;
  console.error = (line) => logLines.push(line);
  try {
    const result = await generateMystery({ premise: 'A test premise.', difficulty: 'Easy' }, {
      fallbackModel: null,
      sleep: async (delay) => delays.push(delay),
      generateContent: async () => {
        calls += 1;
        if (calls === 1) {
          const cause = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
          throw new TypeError('fetch failed', { cause });
        }
        return { text: JSON.stringify(fixture('Easy')) };
      },
    });
    assert.equal(result.title, 'The Missing Ledger');
  } finally {
    console.error = originalError;
  }

  assert.equal(calls, 2);
  assert.deepEqual(delays, [1_000]);
  assert.ok(logLines.some((line) => line.includes('ECONNRESET')));
});

test('switches to the verified fallback after repeated primary-model 503s', async () => {
  const models = [];
  const delays = [];
  let calls = 0;
  await generateMystery({ premise: 'A test premise.', difficulty: 'Easy' }, {
    fallbackModel: SUPPORTED_FALLBACK_MODELS[0],
    sleep: async (delay) => delays.push(delay),
    generateContent: async (_prompt, { model }) => {
      models.push(model);
      calls += 1;
      if (calls < 3) {
        const error = new Error('This model is currently experiencing high demand.');
        error.status = 503;
        throw error;
      }
      return { text: JSON.stringify(fixture('Easy')) };
    },
  });

  assert.deepEqual(models, [MODEL_NAME, MODEL_NAME, 'gemini-3.6-flash']);
  assert.deepEqual(delays, [1_000, 2_000]);
});

test('switches to the verified fallback for an explicit unavailable-model 404 without retrying it', async () => {
  const models = [];
  const delays = [];
  let calls = 0;
  await generateMystery({ premise: 'A test premise.', difficulty: 'Easy' }, {
    fallbackModel: SUPPORTED_FALLBACK_MODELS[0],
    sleep: async (delay) => delays.push(delay),
    generateContent: async (_prompt, { model }) => {
      models.push(model);
      calls += 1;
      if (calls === 1) {
        const error = new Error('Model gemini-3.8-flash is no longer available.');
        error.status = 404;
        throw error;
      }
      return { text: JSON.stringify(fixture('Easy')) };
    },
  });

  assert.deepEqual(models, [MODEL_NAME, 'gemini-3.6-flash']);
  assert.deepEqual(delays, [1_000]);
});

test('rejects an unverified fallback model ID', async () => {
  let calls = 0;
  await assert.rejects(generateMystery({ premise: 'A test premise.', difficulty: 'Easy' }, {
    fallbackModel: 'models/unverified-model',
    generateContent: async () => { calls += 1; return { text: JSON.stringify(fixture('Easy')) }; },
  }), GeminiConfigurationError);
  assert.equal(calls, 0);
});
