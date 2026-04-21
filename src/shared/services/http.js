import axios from 'axios';

const rawBaseURL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').trim();
const isAbsoluteBaseURL = /^https?:\/\//i.test(rawBaseURL);
const normalizedRelativeBaseURL = rawBaseURL.startsWith('/') ? rawBaseURL : `/${rawBaseURL}`;
const baseURL = isAbsoluteBaseURL ? rawBaseURL : normalizedRelativeBaseURL;
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
