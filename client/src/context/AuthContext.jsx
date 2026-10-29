import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('resq_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('resq_token') || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Validate session on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('resq_token');
      if (storedToken) {
        try {
          const res = await api.get('/auth/me');
          if (res.data?.success) {
            setUser(res.data.user);
            localStorage.setItem('resq_user', JSON.stringify(res.data.user));
          }
        } catch (err) {
          console.warn('Session expired or invalid, logging out');
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    setError(null);
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data?.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        localStorage.setItem('resq_token', res.data.token);
        localStorage.setItem('resq_user', JSON.stringify(res.data.user));
        return { success: true };
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed. Please check credentials.';
      setError(message);
      return { success: false, message };
    }
  };

  const register = async (name, email, password, role = 'user') => {
    setError(null);
    try {
      const res = await api.post('/auth/register', { name, email, password, role });
      if (res.data?.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        localStorage.setItem('resq_token', res.data.token);
        localStorage.setItem('resq_user', JSON.stringify(res.data.user));
        return { success: true };
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed.';
      setError(message);
      return { success: false, message };
    }
  };

  const updateProfile = async (data) => {
    setError(null);
    try {
      const res = await api.patch('/auth/profile', data);
      if (res.data?.success) {
        setUser((prev) => ({ ...prev, ...res.data.user }));
        localStorage.setItem('resq_user', JSON.stringify({ ...user, ...res.data.user }));
        return { success: true, message: res.data.message };
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Profile update failed.';
      setError(message);
      return { success: false, message };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('resq_token');
    localStorage.removeItem('resq_user');
  };

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isAdmin: user?.role === 'admin',
    loading,
    error,
    login,
    register,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
