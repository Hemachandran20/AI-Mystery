import mongoose from 'mongoose';

const { Schema } = mongoose;

const DIFFICULTY_RULES = {
  Easy: { suspects: 3, clues: 5, hints: 2, baseScore: 100 },
  Medium: { suspects: 4, clues: 7, hints: 3, baseScore: 150 },
  Hard: { suspects: 5, clues: 9, hints: 3, baseScore: 200 },
};

const suspectSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  motive: { type: String, required: true },
  alibi: { type: String, required: true },
}, { _id: false });

const clueSchema = new Schema({
  id: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  teaser: { type: String, required: true },
  text: { type: String, required: true },
}, { _id: false });

const solutionSchema = new Schema({
  culpritSuspectId: { type: String, required: true },
  explanation: { type: String, required: true },
  keyEvidenceClueIds: { type: [String], required: true },
}, { _id: false });

const caseSchema = new Schema({
  title: { type: String, required: true, trim: true },
  premise: { type: String, required: true, maxlength: 500 },
  difficulty: { type: String, required: true, enum: Object.keys(DIFFICULTY_RULES) },
  summary: { type: String, required: true },
  suspects: { type: [suspectSchema], required: true },
  clues: { type: [clueSchema], required: true },
  hints: { type: [String], required: true },
  solution: { type: solutionSchema, required: true, select: false },
  discoveredClueIds: { type: [String], default: [] },
  hintsUsed: { type: Number, min: 0, default: 0 },
  accusedSuspectId: { type: String, default: null },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  finalScore: { type: Number, min: 0, default: null },
  isCorrect: { type: Boolean, default: null },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
}, { timestamps: false, versionKey: false });

caseSchema.index({ createdAt: -1 });

caseSchema.statics.difficultyRules = DIFFICULTY_RULES;

const Case = mongoose.models.Case || mongoose.model('Case', caseSchema);

export { DIFFICULTY_RULES };
export default Case;
