// Thin fetch wrapper that attaches the bearer token and normalises errors.
// The client NEVER makes an authorization decision — it simply calls the API and
// renders whatever the server allows or denies. This keeps the UI a convenience
// layer, with the real Part 11 authority checks enforced server-side.

let token = null;
export function setToken(t) { token = t; }
export function getToken() { return token; }

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error((data && data.message) || res.statusText);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export const api = {
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  me: () => request('GET', '/auth/me'),
  listSubjects: () => request('GET', '/subjects'),
  enrolSubject: (payload) => request('POST', '/subjects', payload),
  listForms: (subjectId) => request('GET', `/forms${subjectId ? `?subjectId=${subjectId}` : ''}`),
  createForm: (payload) => request('POST', '/forms', payload),
  updateForm: (id, data, reason) => request('PATCH', `/forms/${id}`, { data, reason }),
  amendForm: (id, data, reason) => request('POST', `/forms/${id}/amend`, { data, reason }),
  signForm: (id, password, meaning) => request('POST', `/forms/${id}/sign`, { password, meaning }),
  listSignatures: (id) => request('GET', `/forms/${id}/signatures`),
  raiseQuery: (payload) => request('POST', '/queries', payload),
  respondQuery: (id, text) => request('POST', `/queries/${id}/respond`, { text }),
  closeQuery: (id, text) => request('POST', `/queries/${id}/close`, { text }),
  listQueries: (formInstanceId) => request('GET', `/queries${formInstanceId ? `?formInstanceId=${formInstanceId}` : ''}`),
  exportDataset: () => request('GET', '/export/dataset'),
};
