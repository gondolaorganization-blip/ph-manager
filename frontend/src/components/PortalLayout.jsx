import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { usePortalAuth } from '../context/PortalAuthContext';

const NAV = [
  { to: '/portal/dashboard',      label: '🏠 Inicio' },
  { to: '/portal/visitas',        label: '🚶 Mis Visitas' },
  { to: '/portal/reservas',       label: '📅 Reservas' },
  { to: '/portal/avisos',         label: '📢 Avisos' },
  { to: '/portal/mantenimiento',  label: '🔧 Mantenimiento' },
  { to: '/portal/actas',          label: '📋 Actas de Asamblea' },
  { to: '/portal/estado-cuenta',  label: '📄 Estado de Cuenta' },
  { to: '/portal/perfil',         label: '👤 Mi Perfil' },
];

const linkStyle = (active) => ({
  display: 'block', padding: '10px 16px', borderRadius: 8, textDecoration: 'none',
  fontSize: 14, fontWeight: active ? 600 : 400,
  color:      active ? '#fff' : '#cbd5e1',
  background: active ? 'rgba(255,255,255,.15)' : 'transparent',
});

export default function PortalLayout() {
  const { propietario, cerrarSesion } = usePortalAuth();
  const navigate = useNavigate();

  if (!propietario) return <Navigate to="/portal/login" replace />;

  function salir() {
    cerrarSesion();
    navigate('/portal/login', { replace: true });
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Sidebar */}
      <aside style={{ width: 230, background: '#1e3a5f', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '28px 20px 20px', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>🏢</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>Portal Propietario</div>
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>{propietario.unidad?.numero}</div>
        </div>

        <nav style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV.map(({ to, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => linkStyle(isActive)}>
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8, paddingLeft: 16 }}>{propietario.nombre}</div>
          <button
            onClick={salir}
            style={{ width: '100%', padding: '9px 16px', background: 'rgba(255,255,255,.08)', color: '#cbd5e1', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, textAlign: 'left' }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Content */}
      <main style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
        <Outlet />
      </main>
    </div>
  );
}
