const TOKEN_KEY = 'goals_token';

export function getToken()          { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t)         { localStorage.setItem(TOKEN_KEY, t); }
export function clearToken()        { localStorage.removeItem(TOKEN_KEY); }

async function req(path, opts = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { ...opts, headers });
  if (res.status === 401) { clearToken(); window.location.reload(); throw new Error('Session expired'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  login:          (body)        => req('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  sso:            (token)       => fetch('/api/auth/sso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).then(r => { if (!r.ok) throw new Error('SSO failed'); return r.json(); }),
  me:             ()            => req('/api/auth/me'),
  changePassword: (body)        => req('/api/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),

  groups:         ()            => req('/api/groups'),
  goals:          (params = {}) => req('/api/goals?' + new URLSearchParams(params)),
  goal:           (id)          => req(`/api/goals/${id}`),
  createGoal:     (body)        => req('/api/goals', { method: 'POST', body: JSON.stringify(body) }),
  updateGoal:     (id, body)    => req(`/api/goals/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteGoal:     (id)          => req(`/api/goals/${id}`, { method: 'DELETE' }),

  progress:       (id)          => req(`/api/goals/${id}/progress`),
  updateProgress: (id, body)    => req(`/api/goals/${id}/progress`, { method: 'POST', body: JSON.stringify(body) }),

  scoreboard:     ()            => req('/api/scoreboard'),
  addWeek:        (body)        => req('/api/scoreboard/weeks', { method: 'POST', body: JSON.stringify(body) }),
  updateEntry:    (id, body)    => req(`/api/scoreboard/entries/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  export:         ()            => fetch('/api/export', { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.blob()),
  import:         (body)        => req('/api/import', { method: 'POST', body: JSON.stringify(body) }),
};
