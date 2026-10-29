import { z } from 'zod';

export const difficultySchema = z.enum(['Easy', 'Medium', 'Hard']);

export const createCaseRequestSchema = z.object({
  premise: z.string().trim().min(1).max(500),
  difficulty: difficultySchema,
}).strict();

const suspectSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  description: z.string().min(1),
  motive: z.string().min(1),
  alibi: z.string().min(1),
}).strict();

const clueSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  teaser: z.string().min(1),
  text: z.string().min(1),
}).strict();

export const generatedCaseSchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string().min(1),
  suspects: z.array(suspectSchema),
  clues: z.array(clueSchema),
  hints: z.array(z.string().min(1)),
  solution: z.object({
    culpritSuspectId: z.string().min(1),
    explanation: z.string().min(1),
    keyEvidenceClueIds: z.array(z.string().min(1)).min(1),
  }).strict(),
}).strict().superRefine((mystery, context) => {
  const suspectIds = mystery.suspects.map(({ id }) => id);
  const clueIds = mystery.clues.map(({ id }) => id);
  if (new Set(suspectIds).size !== suspectIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['suspects'], message: 'Suspect IDs must be unique.' });
  }
  if (new Set(clueIds).size !== clueIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['clues'], message: 'Clue IDs must be unique.' });
  }
  if (!suspectIds.includes(mystery.solution.culpritSuspectId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['solution', 'culpritSuspectId'], message: 'Culprit must reference a generated suspect.' });
  }
  if (mystery.solution.keyEvidenceClueIds.some((id) => !clueIds.includes(id))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['solution', 'keyEvidenceClueIds'], message: 'Evidence must reference generated clues.' });
  }
});

export const accuseRequestSchema = z.object({ suspectId: z.string().min(1) }).strict();
