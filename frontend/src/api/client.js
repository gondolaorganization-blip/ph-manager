import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('phm_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('phm_token');
      localStorage.removeItem('phm_user');
      window.location.href = import.meta.env.BASE_URL + 'login';
    }
    return Promise.reject(err);
  }
);

export default api;
