import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

const PLANES = ['BASICO', 'PROFESIONAL', 'ENTERPRISE'];

function ModalSuscripcion({ edificio, onClose, onSaved }) {
  const [plan,    setPlan]    = useState(edificio.plan === 'TRIAL' ? 'BASICO' : edificio.plan);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  async function activar() {
    setSaving(true); setError('');
    try {
      await api.put(`/edificios/${edificio.id}/suscripcion`, { plan });
      onSaved();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  async function desactivar() {
    if (!confirm('¿Desactivar suscripción y volver a TRIAL (sin fecha)?')) return;
    setSaving(true); setError('');
    try {
      await api.put(`/edificios/${edificio.id}/suscripcion`, { desactivar: true });
      onSaved();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Suscripción — {edificio.nombre}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label>Plan</label>
            <select value={plan} onChange={e => setPlan(e.target.value)}>
              {PLANES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 12, color: 'var(--slate-500)', marginTop: 8 }}>
            Estado actual: <strong>{edificio.suscripcionActiva ? `ACTIVA (${edificio.plan})` : `TRIAL${edificio.diasTrial !== null ? ` — ${edificio.diasTrial}d restantes` : ' sin fecha'}`}</strong>
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-ghost btn-sm" onClick={desactivar} disabled={saving}
            style={{ color: 'var(--red-600)', borderColor: 'var(--red-200)' }}>
            Desactivar
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={activar} disabled={saving}>
              {saving ? 'Guardando…' : 'Activar suscripción'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmt(n) { return `$${Number(n).toLocaleString('es-PA', { minimumFractionDigits: 2 })}`; }

function PctBar({ value, max, color = '#1e3a5f' }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ background: '#f1f5f9', borderRadius: 4, height: 6, width: '100%', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .3s' }} />
    </div>
  );
}

export default function SuperAdminDashboardPage() {
  const navigate = useNavigate();
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [modalSusc,  setModalSusc]  = useState(null);

  function cargar() {
    setLoading(true);
    api.get('/edificios/kpis-globales')
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.error || 'Error al cargar KPIs'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { cargar(); }, []);

  if (loading) return <div className="loading">Cargando…</div>;
  if (error)   return <div className="alert alert-error">{error}</div>;

  const { totales, edificios } = data;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard Global</h1>
        <span style={{ fontSize: 13, color: 'var(--slate-500)' }}>{edificios.length} edificio{edificios.length !== 1 ? 's' : ''} activos</span>
      </div>

      {/* KPIs globales */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total edificios</div>
          <div className="stat-value stat-blue">{totales.edificios}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total unidades</div>
          <div className="stat-value">{totales.unidades}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unidades morosas</div>
          <div className="stat-value stat-red">{totales.morosas}</div>
          {totales.unidades > 0 && (
            <div className="stat-sub">{((totales.morosas / totales.unidades) * 100).toFixed(1)}% del total</div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label">Deuda vencida total</div>
          <div className="stat-value stat-red" style={{ fontSize: 18 }}>{fmt(totales.deudaVencida)}</div>
        </div>
      </div>

      {/* Cards por edificio */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {edificios.map(e => {
          const ocupacion   = e.unidades ? (e.conProp / e.unidades) * 100 : 0;
          const moroPct     = e.unidades ? (e.morosas / e.unidades) * 100 : 0;
          const cuotaPagPct = e.cuotaMes?.total
            ? (e.cuotaMes.pagado / e.cuotaMes.total) * 100
            : null;

          return (
            <div key={e.id} className="card" style={{ padding: 20, cursor: 'pointer' }}
              onClick={() => navigate(`/edificios/${e.id}/dashboard`)}>

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{e.nombre}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{e.direccion}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexDirection: 'column', alignItems: 'flex-end' }}>
                  {e.suscripcionActiva
                    ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#dcfce7', color: '#16a34a', fontWeight: 700 }}>
                        {e.plan}
                      </span>
                    : e.diasTrial !== null && e.diasTrial > 0
                      ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }}>
                          Trial {e.diasTrial}d
                        </span>
                      : <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#fee2e2', color: '#dc2626', fontWeight: 700 }}>
                          VENCIDO
                        </span>
                  }
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    onClick={ev => { ev.stopPropagation(); setModalSusc(e); }}
                  >
                    Suscripción
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Unidades</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{e.unidades}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{e.conProp} con propietario</div>
                  <PctBar value={e.conProp} max={e.unidades} color="#1e3a5f" />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Morosas</div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: e.morosas > 0 ? '#dc2626' : '#16a34a' }}>{e.morosas}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{moroPct.toFixed(0)}% de las unidades</div>
                  <PctBar value={e.morosas} max={e.unidades} color="#dc2626" />
                </div>
              </div>

              {e.deudaVencida > 0 && (
                <div style={{ background: '#fef2f2', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Deuda vencida</div>
                  <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 15 }}>{fmt(e.deudaVencida)}</div>
                </div>
              )}

              {e.cuotaMes && (
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Cuota mes actual</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cuotaPagPct >= 80 ? '#16a34a' : '#d97706' }}>
                      {cuotaPagPct?.toFixed(0)}%
                    </span>
                  </div>
                  <PctBar value={e.cuotaMes.pagado} max={e.cuotaMes.total}
                    color={cuotaPagPct >= 80 ? '#16a34a' : cuotaPagPct >= 50 ? '#d97706' : '#dc2626'} />
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    {e.cuotaMes.pagado} de {e.cuotaMes.total} pagadas
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modalSusc && (
        <ModalSuscripcion
          edificio={modalSusc}
          onClose={() => setModalSusc(null)}
          onSaved={() => { setModalSusc(null); cargar(); }}
        />
      )}
    </div>
  );
}
