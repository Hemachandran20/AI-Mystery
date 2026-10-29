const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    throw new Error('Could not reach the game server. Check your connection and try again.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'The request could not be completed.');
  return body;
}

export const api = {
  createCase: (payload) => request('/api/cases', { method: 'POST', body: JSON.stringify(payload) }),
  getCase: (id) => request(`/api/cases/${encodeURIComponent(id)}`),
  discoverClue: (id, clueId) => request(`/api/cases/${encodeURIComponent(id)}/clues/${encodeURIComponent(clueId)}/discover`, { method: 'POST' }),
  getHint: (id) => request(`/api/cases/${encodeURIComponent(id)}/hints`, { method: 'POST' }),
  accuse: (id, suspectId) => request(`/api/cases/${encodeURIComponent(id)}/accuse`, { method: 'POST', body: JSON.stringify({ suspectId }) }),
  getResult: (id) => request(`/api/cases/${encodeURIComponent(id)}/result`),
};
