import axios from 'axios';

// Use Vite env var `VITE_API_BASE` in dev/production, otherwise fall back to relative path
// Relative path ("/api/v1") allows the Vite dev server proxy to forward requests
const baseURL = import.meta.env.VITE_API_BASE || '/api/v1';
const tokenStorageKey = 'admin_token';

export const http = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(tokenStorageKey);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
