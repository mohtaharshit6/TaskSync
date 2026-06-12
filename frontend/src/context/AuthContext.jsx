import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import api, { setToken, clearToken } from '../api/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: refreshData } = await axios.post(
          `${import.meta.env.VITE_API_URL || '/api'}/auth/refresh`,
          { refreshToken: localStorage.getItem('refreshToken') },
          { withCredentials: true }
        );
        setToken(refreshData.data.accessToken);
        if (refreshData.data.refreshToken) localStorage.setItem('refreshToken', refreshData.data.refreshToken);
        const { data } = await api.get('/users/me');
        setUser(data.data);
      } catch {
        // not logged in
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setToken(data.data.accessToken);
    if (data.data.refreshToken) localStorage.setItem('refreshToken', data.data.refreshToken);
    setUser(data.data.user);
  };

  const register = async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    return data;
  };

  const logout = async () => {
    await api.post('/auth/logout', { refreshToken: localStorage.getItem('refreshToken') });
    localStorage.removeItem('refreshToken');
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
