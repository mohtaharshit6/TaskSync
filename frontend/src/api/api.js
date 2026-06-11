import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true });

let accessToken = null;
export const setToken   = (t) => { accessToken = t; };
export const clearToken = ()  => { accessToken = null; };
export const getToken   = ()  => accessToken;

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let isRefreshing = false;
let queue = [];

const flush = (err, token = null) => {
  queue.forEach(p => (err ? p.reject(err) : p.resolve(token)));
  queue = [];
};

api.interceptors.response.use(
  r => r,
  async (error) => {
    const orig = error.config;
    if (error.response?.status !== 401 || orig._retry) return Promise.reject(error);

    if (isRefreshing) {
      return new Promise((resolve, reject) => queue.push({ resolve, reject }))
        .then(token => { orig.headers.Authorization = `Bearer ${token}`; return api(orig); });
    }

    orig._retry = true;
    isRefreshing = true;
    try {
      const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
      const token = data.data.accessToken;
      setToken(token);
      flush(null, token);
      window.dispatchEvent(new CustomEvent('token-refreshed', { detail: { token } }));
      orig.headers.Authorization = `Bearer ${token}`;
      return api(orig);
    } catch (err) {
      flush(err);
      clearToken();
      window.location.href = '/login';
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
