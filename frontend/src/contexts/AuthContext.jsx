import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('hdl_user');
    const storedToken = localStorage.getItem('hdl_token');

    if (storedUser && storedToken) {
      const parsedUser = JSON.parse(storedUser);
      // Garante que o role esteja em minúsculo para as comparações do frontend
      parsedUser.role = parsedUser.role ? parsedUser.role.toLowerCase() : 'client';
      setUser(parsedUser);
      api.defaults.headers.Authorization = `Bearer ${storedToken}`;
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/login', { email, password });
      const { user, token } = response.data;
      
      // Normaliza o role para minúsculo
      user.role = user.role.toLowerCase();

      setUser(user);
      localStorage.setItem('hdl_user', JSON.stringify(user));
      localStorage.setItem('hdl_token', token);
      api.defaults.headers.Authorization = `Bearer ${token}`;
      return user;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setSelectedCompany(null);
    localStorage.removeItem('hdl_user');
    localStorage.removeItem('hdl_token');
    delete api.defaults.headers.Authorization;
  };

  return (
    <AuthContext.Provider value={{ signed: !!user, user, login, logout, loading, selectedCompany, setSelectedCompany }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);