import axios from 'axios';

// Centralized API Base URL resolver:
// Handles both VITE_API_BASE_URL and VITE_API_URL with or without trailing '/api'
const resolveApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (!envUrl || !envUrl.trim()) {
    // In local development, defaults to '/api' which Vite proxies to localhost:5000
    return '/api';
  }
  const clean = envUrl.trim().replace(/\/+$/, '');
  return clean.endsWith('/api') ? clean : `${clean}/api`;
};

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor to attach JWT token (supports operator or controller token)
api.interceptors.request.use(
  (config) => {
    const controllerToken = localStorage.getItem('resq_controller_token');
    const userToken = localStorage.getItem('resq_token');
    const token = (window.location.pathname.startsWith('/controller') && controllerToken)
      ? controllerToken
      : (controllerToken || userToken);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for centralized error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (window.location.pathname.startsWith('/controller')) {
        localStorage.removeItem('resq_controller_token');
      } else if (
        !window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/register') &&
        window.location.pathname !== '/'
      ) {
        localStorage.removeItem('resq_token');
        localStorage.removeItem('resq_user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
