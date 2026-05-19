import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { usePortalAuth } from '../context/PortalAuthContext';

export default function PortalLoginPage() {
  const { guardar } = usePortalAuth();
  const navigate    = useNavigate();

  const [form,    setForm]    = useState({ email: '', password: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await axios.post('/api/portal/login', form);
      guardar(data.token, data.propietario);
      navigate('/portal/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,.1)', padding: 40, width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏢</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Portal del Propietario</h1>
          <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 14 }}>Accede con tus credenciales</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Correo electrónico
            </label>
            <input
              type="email" required autoFocus
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Contraseña
            </label>
            <input
              type="password" required
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{ padding: '12px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
