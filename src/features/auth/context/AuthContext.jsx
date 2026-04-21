import { createContext, useContext, useMemo, useState } from 'react';

const TOKEN_KEY = 'admin_token';
const USER_KEY = 'admin_user';

const AuthContext = createContext(null);

const parseStoredUser = () => {
  const rawUser = localStorage.getItem(USER_KEY);
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
};

const extractToken = (payload) =>
  payload?.token || payload?.accessToken || payload?.data?.token || null;

const extractUser = (payload) =>
  payload?.user || payload?.admin || payload?.data?.user || payload?.data?.admin || null;

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(parseStoredUser);

  const setAuthData = (payload) => {
    const nextToken = extractToken(payload);
    const nextUser = extractUser(payload);

    if (nextToken) {
      localStorage.setItem(TOKEN_KEY, nextToken);
      setToken(nextToken);
    }

    if (nextUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      setAuthData,
      logout,
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
};

