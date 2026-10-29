function sanitize(value) {
  return String(value ?? 'Unknown error')
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi, '[MongoDB URI redacted]')
    .replace(/([?&]key=)[^&\s]+/gi, '$1[redacted]')
    .replace(/\b(password|passwd|pwd|token|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/\bAIza[\w-]{20,}\b/g, '[API key redacted]')
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [redacted]');
}

export function logServerError(scope, error, details = {}) {
  const name = sanitize(error?.name || 'Error');
  const code = error?.code === undefined ? '' : ` code=${sanitize(error.code)}`;
  const attempt = details.attempt === undefined ? '' : ` attempt=${details.attempt}`;
  const message = sanitize(error?.message || error);
  console.error(`[${sanitize(scope)}]${attempt} ${name}${code}: ${message}`);
}
