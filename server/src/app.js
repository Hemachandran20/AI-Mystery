import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import caseRouter from './routes/cases.js';
import { logServerError } from './utils/safeLog.js';

const app = express();

app.disable('x-powered-by');
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '32kb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.use('/api/cases', caseRouter);

app.use((error, _request, response, next) => {
  if (response.headersSent) return next(error);
  logServerError('request middleware failed', error);
  if (error?.type === 'entity.parse.failed') {
    return response.status(400).json({ error: 'Invalid JSON request.' });
  }
  if (error?.type === 'entity.too.large') {
    return response.status(413).json({ error: 'Request body is too large.' });
  }
  return response.status(500).json({ error: 'An unexpected error occurred.' });
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Route not found.' });
});

export default app;
