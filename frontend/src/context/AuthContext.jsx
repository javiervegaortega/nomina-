import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('nomina-token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      // In a real app, you would verify the token with the backend here.
      // For now, we decode it manually or assume it's valid based on localStorage
      try {
        const storedUser = JSON.parse(localStorage.getItem('nomina-user'));
        if (storedUser) setUser(storedUser);
      } catch (err) {
        setToken(null);
        setUser(null);
        localStorage.removeItem('nomina-token');
        localStorage.removeItem('nomina-user');
      }
    }
    setLoading(false);
  }, [token]);

  const login = useCallback(async (email, password) => {
    try {
      const res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
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
