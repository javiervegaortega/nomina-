/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useMemo, useCallback } from 'react';
import { apiFetch } from '../utils/api';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [initialAuth] = useState(() => {
    const storedToken = localStorage.getItem('nomina-token') || null;
    if (!storedToken) return { token: null, user: null };
    try {
      return {
        token: storedToken,
        user: JSON.parse(localStorage.getItem('nomina-user')) || null
      };
    } catch {
      localStorage.removeItem('nomina-token');
      localStorage.removeItem('nomina-user');
      return { token: null, user: null };
    }
  });
  const [user, setUser] = useState(initialAuth.user);
  const [token, setToken] = useState(initialAuth.token);
  const loading = false;

  const login = useCallback(async (email, password) => {
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        auth: false,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('nomina-token', data.token);
      localStorage.setItem('nomina-user', JSON.stringify(data.user));
      
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('nomina-token');
    localStorage.removeItem('nomina-user');
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, logout }),
    [user, token, loading, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
