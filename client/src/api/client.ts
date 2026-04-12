import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses (token expired/invalid)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't redirect if already on login-related endpoint
      const url = error.config?.url || '';
      if (!url.includes('/auth/login') && !url.includes('/auth/me')) {
        localStorage.removeItem('nm_token');
        localStorage.removeItem('nm_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
