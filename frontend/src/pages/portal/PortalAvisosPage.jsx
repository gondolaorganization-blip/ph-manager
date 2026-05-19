import { useEffect, useState } from 'react';
import axios from 'axios';
import { usePortalAuth } from '../../context/PortalAuthContext';

const TIPO_STYLE = {
  GENERAL:       { bg: '#eff6ff', color: '#1d4ed8', label: 'General' },
  URGENTE:       { bg: '#fef2f2', color: '#dc2626', label: 'Urgente' },
  MANTENIMIENTO: { bg: '#fff7ed', color: '#c2410c', label: 'Mantenimiento' },
  CONVOCATORIA:  { bg: '#f0fdf4', color: '#15803d', label: 'Convocatoria' },
};

const fmtFecha = (d) => new Date(d).toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' });

export default function PortalAvisosPage() {
  const { token, propietario } = usePortalAuth();
  const edificioId = propietario?.unidad?.edificioId;

  const [avisos,  setAvisos]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!edificioId) return;
    axios.get(`/api/portal/${edificioId}/avisos`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setAvisos(r.data))
      .finally(() => setLoading(false));
  }, [edificioId, token]);

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Avisos</h1>
      <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 14 }}>Notificaciones de tu edificio</p>

      {loading ? (
        <p style={{ color: '#64748b' }}>Cargando...</p>
      ) : avisos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📢</div>
          <p>No hay avisos activos</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {avisos.map(a => {
            const t = TIPO_STYLE[a.tipo] ?? TIPO_STYLE.GENERAL;
            return (
              <div key={a.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{a.titulo}</h2>
                  <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: t.bg, color: t.color, flexShrink: 0 }}>
                    {t.label}
                  </span>
                </div>
                <p style={{ margin: '0 0 10px', color: '#374151', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{a.mensaje}</p>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Publicado el {fmtFecha(a.fechaPublica)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
