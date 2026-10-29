import { GoogleGenAI } from '@google/genai';
import { DIFFICULTY_RULES } from '../models/Case.js';
import { generatedCaseSchema } from '../validators/caseSchemas.js';
import { logServerError } from '../utils/safeLog.js';

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1_000, 2_000];
export const MODEL_NAME = 'gemini-3.8-flash';
export const SUPPORTED_FALLBACK_MODELS = Object.freeze(['gemini-3.6-flash']);

const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND',
  'EHOSTUNREACH', 'ENETUNREACH', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET',
]);

export class MysteryGenerationError extends Error {
  constructor() {
    super('Mystery generation is temporarily unavailable. Please try again.');
    this.name = 'MysteryGenerationError';
    this.statusCode = 503;
  }
}

export class GeminiConfigurationError extends Error {
  constructor(message = 'Gemini is not configured on the server.') {
    super(message);
    this.name = 'GeminiConfigurationError';
    this.statusCode = 500;
  }
}

function httpStatus(error) {
  const status = Number(error?.status ?? error?.statusCode);
  return Number.isInteger(status) ? status : undefined;
}

function isModelUnavailable(error) {
  const status = httpStatus(error);
  return status === 503 || (status === 404 && /model.{0,80}(unavailable|not found|no longer available)/i.test(error?.message || ''));
}

function isTransientFailure(error) {
  if (RETRYABLE_HTTP_STATUSES.has(httpStatus(error))) return true;
  if (error instanceof TypeError && /fetch failed/i.test(error.message)) return true;

  let cause = error?.cause;
  for (let depth = 0; cause && depth < 4; depth += 1, cause = cause.cause) {
    if (RETRYABLE_NETWORK_CODES.has(cause.code)) return true;
  }
  return false;
}

function resolveFallbackModel(value) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate || candidate === MODEL_NAME) return undefined;
  if (!SUPPORTED_FALLBACK_MODELS.includes(candidate)) {
    throw new GeminiConfigurationError(`GEMINI_FALLBACK_MODEL must be one of: ${SUPPORTED_FALLBACK_MODELS.join(', ')}.`);
  }
  return candidate;
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitBeforeRetry(sleep, attempt, model, reason) {
  const delay = RETRY_DELAYS_MS[attempt - 1];
  console.info(`[gemini retry] next_attempt=${attempt + 1}/${MAX_ATTEMPTS} model=${model} delay_ms=${delay} reason=${reason}`);
  await sleep(delay);
}

function buildPrompt({ premise, difficulty, counts }) {
  return `Create one fair detective mystery for a web game. Return only JSON matching this shape: {"title":"string","summary":"string","suspects":[{"id":"unique string","name":"string","description":"string","motive":"string","alibi":"string"}],"clues":[{"id":"unique string","title":"string","teaser":"string","text":"string"}],"hints":["string"],"solution":{"culpritSuspectId":"suspect id","explanation":"string","keyEvidenceClueIds":["clue id"]}}.\nRules: difficulty ${difficulty}; exactly ${counts.suspects} suspects, ${counts.clues} clues, and ${counts.hints} progressive hints. Use unique IDs. Choose one culprit. Make the explanation logically supported by the listed clues, and make every evidence ID refer to an actual clue. Keep each hint useful but do not state the culprit. Premise: ${premise}`;
}

function extractJson(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Empty model response');
  const withoutFence = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(withoutFence);
}

function validateForDifficulty(rawMystery, difficulty) {
  const parsed = generatedCaseSchema.safeParse(rawMystery);
  if (!parsed.success) throw new Error('Generated mystery failed structural validation');

  const rules = DIFFICULTY_RULES[difficulty];
  const mystery = parsed.data;
  if (mystery.suspects.length !== rules.suspects
    || mystery.clues.length !== rules.clues
    || mystery.hints.length !== rules.hints) {
    throw new Error('Generated mystery has incorrect difficulty counts');
  }
  const culprit = mystery.suspects.find(({ id }) => id === mystery.solution.culpritSuspectId);
  const culpritName = culprit.name.toLocaleLowerCase();
  const culpritId = mystery.solution.culpritSuspectId.toLocaleLowerCase();
  if (mystery.hints.some((hint) => {
    const normalizedHint = hint.toLocaleLowerCase();
    return normalizedHint.includes(culpritId) || normalizedHint.includes(culpritName);
  })) {
    throw new Error('A generated hint directly identifies the culprit.');
  }
  return mystery;
}

export async function generateMystery({ premise, difficulty }, options = {}) {
  const counts = DIFFICULTY_RULES[difficulty];
  if (!counts) throw new TypeError('Unsupported difficulty.');

  const requestContentOverride = options.generateContent;
  const sleep = options.sleep || wait;
  const fallbackSetting = Object.hasOwn(options, 'fallbackModel')
    ? options.fallbackModel
    : process.env.GEMINI_FALLBACK_MODEL;
  const fallbackModel = resolveFallbackModel(fallbackSetting);
  let requestContent = requestContentOverride;
  if (!requestContent) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new GeminiConfigurationError();
    const ai = new GoogleGenAI({ apiKey, httpOptions: { retryOptions: { attempts: 1 } } });
    requestContent = async (prompt, { model }) => ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
  }

  let selectedModel = MODEL_NAME;
  let unavailableResponses = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await requestContent(buildPrompt({ premise, difficulty, counts }), { model: selectedModel, attempt });
    } catch (error) {
      logServerError(`gemini generation failed model=${selectedModel}`, error, { attempt: `${attempt}/${MAX_ATTEMPTS}` });
      if (error?.cause) {
        logServerError('gemini fetch failure cause', error.cause, { attempt: `${attempt}/${MAX_ATTEMPTS}` });
      }

      const status = httpStatus(error);
      const modelUnavailable = isModelUnavailable(error);
      if (
  selectedModel === MODEL_NAME &&
  fallbackModel &&
  (modelUnavailable || (isTransientFailure(error) && attempt >= 2))
) {
  selectedModel = fallbackModel;

  if (attempt < MAX_ATTEMPTS) {
    await waitBeforeRetry(
      sleep,
      attempt,
      selectedModel,
      'fallback_after_primary_failure'
    );
    continue;
  }
}

      if (!modelUnavailable && !isTransientFailure(error)) break;
      if (attempt === MAX_ATTEMPTS) break;
      await waitBeforeRetry(sleep, attempt, selectedModel, 'transient_failure');
      continue;
    }

    try {
      const text = typeof response === 'string' ? response : response?.text;
      return validateForDifficulty(extractJson(text), difficulty);
    } catch (error) {
      logServerError(`gemini response validation failed model=${selectedModel}`, error, { attempt: `${attempt}/${MAX_ATTEMPTS}` });
      if (attempt === MAX_ATTEMPTS) break;
      await waitBeforeRetry(sleep, attempt, selectedModel, 'response_validation');
    }
  }
  throw new MysteryGenerationError();
}

export { validateForDifficulty };
