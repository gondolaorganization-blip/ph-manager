import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { usePortalAuth } from '../../context/PortalAuthContext';

const fmt = (n) => new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD' }).format(n ?? 0);
const fmtFecha = (d) => d ? new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

function StatCard({ label, value, color = '#0f172a', sub }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function PortalDashboardPage() {
  const { token } = usePortalAuth();
  const [data, setData]   = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get('/api/portal/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setData(r.data))
      .catch(() => setError('Error al cargar datos'));
  }, [token]);

  if (error) return <p style={{ color: '#dc2626' }}>{error}</p>;
  if (!data)  return <p style={{ color: '#64748b' }}>Cargando...</p>;

  const { nombre, unidad, saldoPendiente, vencidas, proximaVence } = data;

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
        Bienvenido, {nombre.split(' ')[0]}
      </h1>
      <p style={{ margin: '0 0 28px', color: '#64748b', fontSize: 14 }}>
        {unidad?.edificio?.nombre} — Unidad {unidad?.numero}
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
        <StatCard
          label="Saldo pendiente"
          value={fmt(saldoPendiente)}
          color={saldoPendiente > 0 ? '#dc2626' : '#16a34a'}
        />
        <StatCard
          label="Cuotas vencidas"
          value={vencidas}
          color={vencidas > 0 ? '#dc2626' : '#0f172a'}
        />
        <StatCard
          label="Próximo vencimiento"
          value={fmtFecha(proximaVence)}
          color="#0f172a"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {[
          { to: '/portal/visitas',       icon: '🚶', label: 'Mis Visitas',      desc: 'Registra y gestiona tus visitas' },
          { to: '/portal/reservas',      icon: '📅', label: 'Reservas',         desc: 'Reserva salón, piscina, BBQ y más' },
          { to: '/portal/avisos',        icon: '📢', label: 'Avisos',           desc: 'Notificaciones del edificio' },
          { to: '/portal/estado-cuenta', icon: '📄', label: 'Estado de Cuenta', desc: 'Descarga tu estado de cuenta' },
          { to: '/portal/perfil',        icon: '👤', label: 'Mi Perfil',        desc: 'Cambia tu contraseña' },
        ].map(({ to, icon, label, desc }) => (
          <Link key={to} to={to} style={{ textDecoration: 'none' }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'box-shadow .15s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>{label}</div>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>{desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
