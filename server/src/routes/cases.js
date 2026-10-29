import { Router } from 'express';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import Case, { DIFFICULTY_RULES } from '../models/Case.js';
import { connectDatabase, DatabaseConfigurationError } from '../config/database.js';
import { generateMystery, GeminiConfigurationError, MysteryGenerationError } from '../services/mysteryGenerator.js';
import { calculateScore } from '../services/gameRules.js';
import { accuseRequestSchema, createCaseRequestSchema } from '../validators/caseSchemas.js';
import { logServerError } from '../utils/safeLog.js';

const router = Router();
const createLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });

function parseObjectId(value) {
  return mongoose.isValidObjectId(value);
}

export function serializePublicCase(game) {
  const discovered = new Set(game.discoveredClueIds);
  return {
    id: String(game._id),
    title: game.title,
    premise: game.premise,
    difficulty: game.difficulty,
    summary: game.summary,
    suspects: game.suspects.map(({ id, name, description, motive, alibi }) => ({ id, name, description, motive, alibi })),
    clues: game.clues.map(({ id, title, teaser }) => ({ id, title, teaser, discovered: discovered.has(id) })),
    discoveredClueIds: [...game.discoveredClueIds],
    discoveredClueCount: game.discoveredClueIds.length,
    hintsUsed: game.hintsUsed,
    hintsRemaining: DIFFICULTY_RULES[game.difficulty].hints - game.hintsUsed,
    status: game.status,
  };
}

export function serializeResult(game) {
  const culprit = game.suspects.find(({ id }) => id === game.solution.culpritSuspectId);
  return {
    id: String(game._id),
    status: game.status,
    correct: game.isCorrect,
    accusedSuspectId: game.accusedSuspectId,
    culprit: culprit ? { id: culprit.id, name: culprit.name } : null,
    explanation: game.solution.explanation,
    supportingClues: game.solution.keyEvidenceClueIds.map((id) => {
      const clue = game.clues.find((item) => item.id === id);
      return clue ? { id: clue.id, title: clue.title, text: clue.text } : null;
    }).filter(Boolean),
    finalScore: game.finalScore,
    scoreBreakdown: {
      baseScore: DIFFICULTY_RULES[game.difficulty].baseScore,
      discoveredClues: game.discoveredClueIds.length,
      cluePoints: game.discoveredClueIds.length * 5,
      hintsUsed: game.hintsUsed,
      hintPenalty: game.hintsUsed * 10,
    },
    completedAt: game.completedAt,
  };
}

async function findCase(id) {
  if (!parseObjectId(id)) return null;
  return Case.findById(id);
}

function isDatabaseAuthenticationError(error) {
  return error?.code === 18
    || error?.code === 8000
    || /authentication failed|bad auth/i.test(error?.message || '');
}

router.post('/', createLimiter, async (request, response) => {
  const input = createCaseRequestSchema.safeParse(request.body);
  if (!input.success) return response.status(400).json({ error: 'Enter a premise up to 500 characters and choose a supported difficulty.' });

  try {
    await connectDatabase();
  } catch (error) {
    logServerError('case creation database connection failed', error);
    if (error instanceof DatabaseConfigurationError) {
      return response.status(500).json({ error: 'The case database is not configured on the server.' });
    }
    if (isDatabaseAuthenticationError(error)) {
      return response.status(500).json({ error: 'The database rejected the server credentials. Check the MongoDB username, password, and authentication database in server/.env.' });
    }
    return response.status(503).json({ error: 'The case database is temporarily unavailable. Please try again.' });
  }

  let generated;
  try {
    generated = await generateMystery(input.data);
  } catch (error) {
    logServerError('case creation Gemini generation failed', error);
    if (error instanceof GeminiConfigurationError) {
      return response.status(500).json({ error: error.message });
    }
    if (error instanceof MysteryGenerationError) {
      return response.status(503).json({ error: error.message });
    }
    return response.status(502).json({ error: 'The mystery service returned an unexpected response. Please try again.' });
  }

  try {
    const game = await Case.create({ ...input.data, ...generated });
    return response.status(201).json({ case: serializePublicCase(game) });
  } catch (error) {
    logServerError('case creation persistence failed', error);
    return response.status(503).json({ error: 'The generated case could not be saved. Please try again.' });
  }
});

router.get('/:id', async (request, response) => {
  try {
    await connectDatabase();
    const game = await findCase(request.params.id);
    if (!game) return response.status(404).json({ error: 'Case not found.' });
    return response.json({ case: serializePublicCase(game) });
  } catch (error) {
    logServerError('case read failed', error);
    return response.status(503).json({ error: 'Cases are temporarily unavailable.' });
  }
});

router.post('/:id/clues/:clueId/discover', async (request, response) => {
  try {
    await connectDatabase();
    const game = await findCase(request.params.id);
    if (!game) return response.status(404).json({ error: 'Case not found.' });
    if (game.status !== 'active') return response.status(409).json({ error: 'This case is already complete.' });
    const clue = game.clues.find(({ id }) => id === request.params.clueId);
    if (!clue) return response.status(404).json({ error: 'Clue not found.' });

    const updated = await Case.findOneAndUpdate(
      { _id: game._id, status: 'active' },
      { $addToSet: { discoveredClueIds: clue.id } },
      { new: true },
    );
    if (!updated) return response.status(409).json({ error: 'This case is already complete.' });
    return response.json({
      clue: { id: clue.id, title: clue.title, text: clue.text },
      discoveredClueIds: updated.discoveredClueIds,
      discoveredClueCount: updated.discoveredClueIds.length,
      totalClues: updated.clues.length,
      alreadyDiscovered: game.discoveredClueIds.includes(clue.id),
    });
  } catch (error) {
    logServerError('clue discovery failed', error);
    return response.status(503).json({ error: 'The clue could not be discovered right now.' });
  }
});

router.post('/:id/hints', async (request, response) => {
  try {
    await connectDatabase();
    const game = await findCase(request.params.id);
    if (!game) return response.status(404).json({ error: 'Case not found.' });
    if (game.status !== 'active') return response.status(409).json({ error: 'This case is already complete.' });
    const hintLimit = DIFFICULTY_RULES[game.difficulty].hints;
    const updated = await Case.findOneAndUpdate(
      { _id: game._id, status: 'active', hintsUsed: { $lt: hintLimit } },
      { $inc: { hintsUsed: 1 } },
      { new: true },
    );
    if (!updated) return response.status(409).json({ error: 'No hints remain for this case.' });
    return response.json({ hint: updated.hints[updated.hintsUsed - 1], hintsUsed: updated.hintsUsed, hintsRemaining: hintLimit - updated.hintsUsed });
  } catch (error) {
    logServerError('hint request failed', error);
    return response.status(503).json({ error: 'A hint could not be provided right now.' });
  }
});

router.post('/:id/accuse', async (request, response) => {
  const input = accuseRequestSchema.safeParse(request.body);
  if (!input.success) return response.status(400).json({ error: 'Choose a valid suspect.' });
  try {
    await connectDatabase();
    const game = parseObjectId(request.params.id)
      ? await Case.findById(request.params.id).select('+solution')
      : null;
    if (!game) return response.status(404).json({ error: 'Case not found.' });
    if (game.status !== 'active') return response.status(409).json({ error: 'An accusation has already been submitted.' });
    if (!game.suspects.some(({ id }) => id === input.data.suspectId)) return response.status(400).json({ error: 'Choose a suspect from this case.' });

    const isCorrect = input.data.suspectId === game.solution.culpritSuspectId;
    const score = calculateScore({ difficulty: game.difficulty, isCorrect, discoveredClueCount: game.discoveredClueIds.length, hintsUsed: game.hintsUsed });
    const completedAt = new Date();
    const updated = await Case.findOneAndUpdate(
      { _id: game._id, status: 'active', discoveredClueIds: game.discoveredClueIds, hintsUsed: game.hintsUsed },
      { $set: { status: 'completed', accusedSuspectId: input.data.suspectId, isCorrect, finalScore: score, completedAt } },
      { new: true },
    ).select('+solution');
    if (!updated) return response.status(409).json({ error: 'The case changed while you submitted your accusation. Reload and try again.' });
    return response.json({ result: serializeResult(updated) });
  } catch (error) {
    logServerError('accusation failed', error);
    return response.status(503).json({ error: 'The accusation could not be processed right now.' });
  }
});

router.get('/:id/result', async (request, response) => {
  try {
    await connectDatabase();
    const game = parseObjectId(request.params.id)
      ? await Case.findById(request.params.id).select('+solution')
      : null;
    if (!game) return response.status(404).json({ error: 'Case not found.' });
    if (game.status !== 'completed') return response.status(409).json({ error: 'The result is available after an accusation.' });
    return response.json({ result: serializeResult(game) });
  } catch (error) {
    logServerError('result read failed', error);
    return response.status(503).json({ error: 'The result is temporarily unavailable.' });
  }
});

export default router;
