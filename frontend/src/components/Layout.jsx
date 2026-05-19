import { Outlet, NavLink, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import api from '../api/client';
import TrialBanner from './TrialBanner';

const EMPTY_PWD = { actual: '', nueva: '', confirmar: '' };

function ModalCambiarPassword({ onClose }) {
  const [form, setForm]     = useState(EMPTY_PWD);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [ok, setOk]         = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.nueva !== form.confirmar) { setError('Las contraseñas nuevas no coinciden'); return; }
    setSaving(true);
    try {
      await api.put('/auth/password', { actual: form.actual, nueva: form.nueva });
      setOk(true);
      setTimeout(onClose, 1500);
    } catch (err) { setError(err.response?.data?.error || 'Error al cambiar contraseña'); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Cambiar contraseña</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}
            {ok    && <div className="alert alert-success">Contraseña actualizada correctamente</div>}
            <div className="form-group">
              <label>Contraseña actual *</label>
              <input type="password" required autoFocus value={form.actual}
                onChange={e => setForm(f => ({ ...f, actual: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Nueva contraseña * <span style={{ fontWeight: 400, color: 'var(--slate-400)' }}>(mín. 6 caracteres)</span></label>
              <input type="password" required minLength={6} value={form.nueva}
                onChange={e => setForm(f => ({ ...f, nueva: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Confirmar nueva contraseña *</label>
              <input type="password" required minLength={6} value={form.confirmar}
                onChange={e => setForm(f => ({ ...f, confirmar: e.target.value }))} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving || ok}>
              {saving ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { edificioId }   = useParams();
  const navigate         = useNavigate();
  const [edificio, setEdificio]       = useState(null);
  const [modalPassword, setModalPassword] = useState(false);

  useEffect(() => {
    if (edificioId) {
      api.get(`/edificios/${edificioId}`).then(r => setEdificio(r.data)).catch(() => {});
    } else {
      setEdificio(null);
    }
  }, [edificioId]);

  function handleLogout() { logout(); navigate('/login'); }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          PH Manager
          <span>Prop. Horizontales</span>
        </div>

        <nav>
          <NavLink to="/edificios" end>🏢 Edificios</NavLink>
          {user?.rol === 'SUPER_ADMIN' && (
            <>
              <NavLink to="/super-dashboard">📊 Dashboard Global</NavLink>
              <NavLink to="/usuarios">👑 Usuarios</NavLink>
            </>
          )}

          {edificioId && (
            <>
              <div className="sidebar-section">
                {edificio?.nombre || 'Edificio'}
                {edificio?.rolUsuario === 'AUDITOR' && (
                  <span style={{
                    display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
                    background: 'rgba(251,191,36,.2)', color: '#fbbf24',
                    borderRadius: 4, padding: '1px 6px', marginTop: 4, width: 'fit-content',
                  }}>
                    SOLO LECTURA
                  </span>
                )}
              </div>
              <NavLink to={`/edificios/${edificioId}/dashboard`}>📊 Dashboard</NavLink>
              <NavLink to={`/edificios/${edificioId}/unidades`}>🏠 Unidades</NavLink>
              <NavLink to={`/edificios/${edificioId}/propietarios`}>👥 Propietarios</NavLink>
              <NavLink to={`/edificios/${edificioId}/cuotas`}>💰 Cuotas</NavLink>
              <NavLink to={`/edificios/${edificioId}/cuotas-ext`}>⚡ Cuotas Ext.</NavLink>
              <NavLink to={`/edificios/${edificioId}/morosos`}>⚠️ Morosos</NavLink>
              <NavLink to={`/edificios/${edificioId}/proveedores`}>🔧 Proveedores</NavLink>
              <NavLink to={`/edificios/${edificioId}/ordenes`}>📋 Órdenes</NavLink>
              <NavLink to={`/edificios/${edificioId}/gastos`}>📊 Gastos</NavLink>
              <NavLink to={`/edificios/${edificioId}/ingresos`}>💵 Ingresos Varios</NavLink>
              <NavLink to={`/edificios/${edificioId}/presupuesto`}>🎯 Presupuesto</NavLink>
              <NavLink to={`/edificios/${edificioId}/balance`}>📈 Balance</NavLink>
              <NavLink to={`/edificios/${edificioId}/actas`}>📝 Actas Asamblea</NavLink>
              <NavLink to={`/edificios/${edificioId}/actas-jd`}>📋 Actas JD</NavLink>
              <NavLink to={`/edificios/${edificioId}/avisos`}>📢 Avisos</NavLink>
              <NavLink to={`/edificios/${edificioId}/reservas`}>🏊 Reservas</NavLink>
              <NavLink to={`/edificios/${edificioId}/visitas`}>🚶 Visitas</NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <strong>{user?.nombre}</strong>
          {user?.rol}
          <br />
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 8, width: '100%', color: 'rgba(255,255,255,.7)', borderColor: 'rgba(255,255,255,.2)' }}
            onClick={() => setModalPassword(true)}
          >
            🔑 Cambiar contraseña
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 6, width: '100%', color: 'rgba(255,255,255,.7)', borderColor: 'rgba(255,255,255,.2)' }}
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="main-content">
        <TrialBanner edificio={edificio} />
        <Outlet />
      </div>

      {modalPassword && <ModalCambiarPassword onClose={() => setModalPassword(false)} />}
    </div>
  );
}
