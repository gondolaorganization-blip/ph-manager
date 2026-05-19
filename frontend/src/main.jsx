import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PortalAuthProvider } from './context/PortalAuthContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename="/ph-manager">
      <AuthProvider>
        <PortalAuthProvider>
          <App />
        </PortalAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
