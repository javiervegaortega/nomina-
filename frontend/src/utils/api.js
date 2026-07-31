const inflightGets = new Map();

const normalizeApiPath = (path) => {
  const value = String(path || '');
  if (value.startsWith('/api/')) return value;
  if (value === '/api') return value;
  return `/api/${value.replace(/^\/+/, '')}`;
};

export const getAuthHeaders = (headers = {}) => {
  const token = localStorage.getItem('nomina-token');
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };
};

export async function apiFetch(path, options = {}) {
  const {
    auth = true,
    dedupe = true,
    headers: customHeaders = {},
    ...fetchOptions
  } = options;
  const method = String(fetchOptions.method || 'GET').toUpperCase();
  const headers = auth ? getAuthHeaders(customHeaders) : customHeaders;
  if (fetchOptions.body && !headers['Content-Type'] && !(fetchOptions.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const url = normalizeApiPath(path);
  const key = method === 'GET' && dedupe && !fetchOptions.signal
    ? `${url}|${headers.Authorization || ''}`
    : null;
  if (key && inflightGets.has(key)) {
    return (await inflightGets.get(key)).clone();
  }

  const request = fetch(url, { ...fetchOptions, method, headers });
  if (key) inflightGets.set(key, request);
  try {
    const response = await request;
    return key ? response.clone() : response;
  } finally {
    if (key) inflightGets.delete(key);
  }
}

export async function apiJson(path, options = {}) {
  const response = await apiFetch(path, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}
