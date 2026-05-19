import { createContext, useContext, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('phm_user')); } catch { return null; }
  });

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('phm_token', data.token);
    localStorage.setItem('phm_user', JSON.stringify(data.usuario));
    setUser(data.usuario);
    return data.usuario;
  }

  function logout() {
    localStorage.removeItem('phm_token');
    localStorage.removeItem('phm_user');
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
