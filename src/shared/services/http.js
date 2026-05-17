import axios from 'axios';

const baseURL = 'http://103.208.183.250:5005/api/v1';
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
