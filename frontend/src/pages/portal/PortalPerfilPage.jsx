import { useState } from 'react';
import axios from 'axios';
import { usePortalAuth } from '../../context/PortalAuthContext';

export default function PortalPerfilPage() {
  const { token, propietario } = usePortalAuth();

  const [form,      setForm]      = useState({ actual: '', nueva: '', confirmar: '' });
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');

  async function cambiarPassword(e) {
    e.preventDefault();
    if (form.nueva !== form.confirmar) { setError('Las contraseñas no coinciden'); return; }
    setError(''); setSuccess('');
    setLoading(true);
    try {
      await axios.put('/api/portal/password', { actual: form.actual, nueva: form.nueva }, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Contraseña actualizada correctamente');
      setForm({ actual: '', nueva: '', confirmar: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar contraseña');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Mi Perfil</h1>
      <p style={{ margin: '0 0 28px', color: '#64748b', fontSize: 14 }}>Gestiona tu información personal</p>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, maxWidth: 480, marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Información</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            ['Nombre',  propietario?.nombre],
            ['Correo',  propietario?.email],
            ['Unidad',  propietario?.unidad?.numero],
            ['Edificio', propietario?.unidad?.edificio?.nombre ?? '—'],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>{k}</div>
              <div style={{ fontSize: 14, color: '#0f172a', marginTop: 2 }}>{v ?? '—'}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, maxWidth: 480 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Cambiar Contraseña</h2>
        <form onSubmit={cambiarPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            ['actual',    'Contraseña actual'],
            ['nueva',     'Nueva contraseña'],
            ['confirmar', 'Confirmar nueva contraseña'],
          ].map(([key, label]) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</label>
              <input type="password" required value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          ))}

          {error   && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13 }}>{error}</div>}
          {success && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', color: '#15803d', fontSize: 13 }}>{success}</div>}

          <button type="submit" disabled={loading}
            style={{ padding: '10px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14, opacity: loading ? .7 : 1 }}>
            {loading ? 'Guardando...' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
