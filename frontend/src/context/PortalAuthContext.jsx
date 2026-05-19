import { createContext, useContext, useState, useEffect } from 'react';

const PortalAuthContext = createContext(null);

const KEY_TOKEN = 'portal_token';
const KEY_PROP  = 'portal_propietario';

export function PortalAuthProvider({ children }) {
  const [token,       setToken]       = useState(() => localStorage.getItem(KEY_TOKEN));
  const [propietario, setPropietario] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY_PROP)); } catch { return null; }
  });

  function guardar(t, p) {
    localStorage.setItem(KEY_TOKEN, t);
    localStorage.setItem(KEY_PROP, JSON.stringify(p));
    setToken(t);
    setPropietario(p);
  }

  function cerrarSesion() {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_PROP);
    setToken(null);
    setPropietario(null);
  }

  return (
    <PortalAuthContext.Provider value={{ token, propietario, guardar, cerrarSesion }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  return useContext(PortalAuthContext);
}
