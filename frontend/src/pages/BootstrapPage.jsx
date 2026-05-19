import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function BootstrapPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [form, setForm]     = useState({ nombre: '', email: '', password: '', secret: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [exito, setExito]   = useState(null); // { nombre, email, esNuevo }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/bootstrap', {
        nombre:   form.nombre   || undefined,
        email:    form.email,
        password: form.password || undefined,
        secret:   form.secret,
      });
      // Guardar sesión
      localStorage.setItem('phm_token', data.token);
      localStorage.setItem('phm_user', JSON.stringify(data.usuario));
      setExito(data.usuario);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al ejecutar bootstrap');
    } finally { setLoading(false); }
  }

  if (exito) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">
            <h1>PH Manager</h1>
          </div>
          <div className="alert alert-success" style={{ textAlign: 'center', marginBottom: 20 }}>
            ✓ <strong>{exito.nombre}</strong> ahora es Super Admin
          </div>
          <p style={{ fontSize: 13, color: 'var(--slate-500)', textAlign: 'center', marginBottom: 20 }}>
            Sesión iniciada como <strong>{exito.email}</strong>.<br />
            Recuerda eliminar o deshabilitar <code>BOOTSTRAP_SECRET</code> del <code>.env</code> una vez configurado el sistema.
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => navigate('/edificios')}
          >
            Ir al panel →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <h1>PH Manager</h1>
          <p>Configuración inicial — Super Admin</p>
        </div>

        <div style={{ background: 'var(--amber-50)', border: '1px solid var(--amber-200)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: 'var(--amber-800)' }}>
          <strong>Solo para administradores del sistema.</strong> Requiere la clave <code>BOOTSTRAP_SECRET</code> configurada en el servidor.
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Correo electrónico *</label>
            <input
              type="email" required autoFocus
              placeholder="admin@tuempresa.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>
              Nombre
              <span style={{ fontWeight: 400, color: 'var(--slate-400)', marginLeft: 6 }}>
                (solo si el email no tiene cuenta aún)
              </span>
            </label>
            <input
              value={form.nombre}
              placeholder="Tu nombre completo"
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>
              Contraseña
              <span style={{ fontWeight: 400, color: 'var(--slate-400)', marginLeft: 6 }}>
                (solo si el email no tiene cuenta aún)
              </span>
            </label>
            <input
              type="password" minLength={6}
              placeholder="Mín. 6 caracteres"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Clave bootstrap *</label>
            <input
              type="password" required
              placeholder="BOOTSTRAP_SECRET del servidor"
              value={form.secret}
              onChange={e => setForm(f => ({ ...f, secret: e.target.value }))}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Procesando…' : 'Configurar Super Admin'}
          </button>
        </form>

        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: 'var(--slate-400)' }}>
          <Link to="/login" style={{ color: 'var(--slate-400)' }}>← Volver al login</Link>
        </p>
      </div>
    </div>
  );
}
