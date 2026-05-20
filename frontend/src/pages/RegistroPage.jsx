import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';

export default function RegistroPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get('plan');

  const [form, setForm] = useState({ nombre: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');
    if (form.password !== form.confirm) return setError('Las contraseñas no coinciden');

    setLoading(true);
    try {
      await api.post('/auth/registro', {
        nombre: form.nombre.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      navigate('/login?registro=ok');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la cuenta. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 440 }}>
        <div className="login-logo">
          <h1>PH Manager</h1>
          <p>Crea tu cuenta — 14 días gratis</p>
          {planParam && (
            <span style={{ display: 'inline-block', marginTop: 6, fontSize: 12, color: '#0EA5E9', fontWeight: 700 }}>
              Plan: {planParam.toUpperCase()}
            </span>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Tu nombre completo</label>
            <input type="text" required autoFocus value={form.nombre} onChange={set('nombre')} placeholder="María Rodríguez" />
          </div>
          <div className="form-group">
            <label>Correo electrónico</label>
            <input type="email" required value={form.email} onChange={set('email')} placeholder="maria@ejemplo.com" />
          </div>
          <div className="form-group">
            <label>Contraseña (mín. 6 caracteres)</label>
            <input type="password" required value={form.password} onChange={set('password')} placeholder="••••••••" />
          </div>
          <div className="form-group">
            <label>Confirmar contraseña</label>
            <input type="password" required value={form.confirm} onChange={set('confirm')} placeholder="••••••••" />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Creando cuenta…' : 'Crear cuenta gratis →'}
          </button>
          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#6B7280' }}>
            Al registrarte aceptas nuestros{' '}
            <a href="https://gestarsoft.com/terminos" target="_blank" rel="noreferrer" style={{ color: '#0EA5E9' }}>Términos</a>
            {' '}y{' '}
            <a href="https://gestarsoft.com/privacidad" target="_blank" rel="noreferrer" style={{ color: '#0EA5E9' }}>Privacidad</a>.
          </p>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#6B7280' }}>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" style={{ color: '#0EA5E9', textDecoration: 'none', fontWeight: 600 }}>
            Iniciar sesión →
          </Link>
        </p>
      </div>
    </div>
  );
}
