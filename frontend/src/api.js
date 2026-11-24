// Thin fetch wrapper for the backend API.
async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const apiGet = (path) => api(path, { method: 'GET' });
export const apiPost = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body || {}) });
export const apiPut = (path, body) => api(path, { method: 'PUT', body: JSON.stringify(body || {}) });
export const apiDelete = (path) => api(path, { method: 'DELETE' });
export default api;
