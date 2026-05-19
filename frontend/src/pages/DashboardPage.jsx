import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { pdfUrl } from '../hooks/usePdfUrl';

const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_L = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function fmt(n) { return `$${Number(n).toLocaleString('es-PA', { minimumFractionDigits: 2 })}`; }

export default function DashboardPage() {
  const { edificioId } = useParams();
  const navigate       = useNavigate();
  const [data,          setData]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [calculandoMora, setCalculandoMora] = useState(false);
  const [resultMora,    setResultMora]    = useState(null);

  useEffect(() => { cargar(); }, [edificioId]);

  async function cargar() {
    setLoading(true);
    try { const r = await api.get(`/edificios/${edificioId}/dashboard`); setData(r.data); }
    catch { navigate('/edificios'); }
    finally { setLoading(false); }
  }

  async function calcularMora() {
    setCalculandoMora(true); setResultMora(null);
    try {
      const { data: r } = await api.post(`/edificios/${edificioId}/mora/calcular`);
      setResultMora({ ok: true, msg: r.message });
      cargar(); // refrescar stats
    } catch (err) {
      setResultMora({ ok: false, msg: err.response?.data?.error || 'Error al calcular' });
    } finally { setCalculandoMora(false); }
  }

  if (loading) return <div className="loading">Cargando dashboard…</div>;
  if (!data) return null;

  const { edificio, cuotaActual: ca, morosos, ordenesPendientes, proximosVencimientos, unidades, visitasHoy, resumenAnual, presupuestoMes } = data;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{edificio.nombre}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {resultMora && (
            <span style={{ fontSize: 12, color: resultMora.ok ? 'var(--green-600)' : 'var(--red-600)' }}>
              {resultMora.ok ? '✓' : '✗'} {resultMora.msg}
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={calcularMora} disabled={calculandoMora} title="Marcar pagos vencidos y calcular interés de mora">
            {calculandoMora ? 'Calculando…' : '⚡ Calcular mora'}
          </button>
          <a
            className="btn btn-ghost btn-sm"
            href={pdfUrl(`/api/edificios/${edificioId}/cuotas/reportes/morosos.pdf`)}
            target="_blank" rel="noreferrer"
          >
            📄 PDF morosos
          </a>
        </div>
      </div>

      {/* KPIs */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Fondo de reserva</div>
          <div className="stat-value stat-blue">{fmt(edificio.fondoReserva)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unidades morosas</div>
          <div className="stat-value stat-red">{morosos.totalUnidades}</div>
          <div className="stat-sub">{fmt(morosos.totalDeuda)} en deuda</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Órdenes activas</div>
          <div className="stat-value stat-amber">{ordenesPendientes}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unidades activas</div>
          <div className="stat-value">{unidades.activas}</div>
          <div className="stat-sub">{unidades.sinPropietario} sin propietario</div>
        </div>
        {presupuestoMes && (
          <div className="stat-card">
            <div className="stat-label">Presupuesto mes</div>
            <div className={`stat-value ${presupuestoMes.pct > 100 ? 'stat-red' : presupuestoMes.pct > 80 ? 'stat-amber' : 'stat-green'}`} style={{ fontSize: 18 }}>
              {presupuestoMes.pct.toFixed(0)}%
            </div>
            <div className="stat-sub">{fmt(presupuestoMes.gastado)} / {fmt(presupuestoMes.presupuestado)}</div>
            <div style={{ marginTop: 8, height: 6, background: 'var(--slate-100)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${Math.min(presupuestoMes.pct, 100)}%`,
                background: presupuestoMes.pct > 100 ? '#dc2626' : presupuestoMes.pct > 80 ? '#f59e0b' : '#16a34a',
              }} />
            </div>
          </div>
        )}
      </div>

      <div className="dash-grid">
        {/* Cuota del mes */}
        <div className="card">
          <div className="card-header">
            {ca ? `Cuota ${MESES_L[ca.mes]} ${ca.anio}` : 'Sin cuota este mes'}
            {ca && (
              <Link className="btn btn-ghost btn-sm" to={`/edificios/${edificioId}/cuotas/${ca.id}/pagos`}>
                Ver pagos
              </Link>
            )}
          </div>
          <div className="card-body">
            {!ca ? (
              <div style={{ color: 'var(--slate-500)', fontSize: 13 }}>
                No hay cuota generada para el mes actual.
                <br />
                <Link to={`/edificios/${edificioId}/cuotas`} style={{ color: 'var(--blue-600)' }}>Ir a Cuotas →</Link>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Recaudado</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green-600)' }}>{fmt(ca.recaudado)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Por cobrar</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--amber-600)' }}>{fmt(ca.porCobrar)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--slate-500)', textTransform: 'uppercase' }}>% cobrado</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: ca.pctRecaudado >= 80 ? 'var(--green-600)' : ca.pctRecaudado >= 50 ? 'var(--amber-600)' : 'var(--red-600)' }}>
                      {ca.pctRecaudado}%
                    </div>
                  </div>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${ca.pctRecaudado}%` }} />
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12 }}>
                  <span style={{ color: 'var(--green-600)' }}>✓ {ca.pagados} pagados</span>
                  <span style={{ color: 'var(--amber-600)' }}>○ {ca.pendientes} pendientes</span>
                  <span style={{ color: 'var(--red-600)' }}>✗ {ca.vencidos} vencidos</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Próximos vencimientos + Resumen anual miniatura */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="card-header">Próximos vencimientos</div>
            <div className="card-body">
              {proximosVencimientos.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--slate-500)' }}>Sin vencimientos en 30 días.</p>
              ) : (
                proximosVencimientos.map(v => (
                  <div key={v.cuotaId} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                      <span>{MESES_L[v.mes]} {v.anio}</span>
                      <span style={{ color: v.diasRestantes <= 7 ? 'var(--red-600)' : 'var(--amber-600)' }}>
                        {v.diasRestantes}d
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
                      {v.unidadesPendientes} unidades · {fmt(v.montoPendiente)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {morosos.totalUnidades > 0 && (
            <div className="card" style={{ borderLeft: '3px solid var(--red-600)' }}>
              <div className="card-body" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--red-600)' }}>⚠️ {morosos.totalUnidades} unidades morosas</div>
                    <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>{fmt(morosos.totalDeuda)} pendientes</div>
                  </div>
                  <Link className="btn btn-danger btn-sm" to={`/edificios/${edificioId}/morosos`}>Ver</Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Visitas de hoy */}
      {visitasHoy && (
        <div className="card">
          <div className="card-header">
            Visitas de hoy
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--slate-500)' }}>
                {visitasHoy.llegaron} llegaron · {visitasHoy.pendientes} pendientes
              </span>
              <Link className="btn btn-ghost btn-sm" to={`/edificios/${edificioId}/visitas`}>Ver todas</Link>
            </div>
          </div>
          <div className="card-body" style={{ padding: visitasHoy.total === 0 ? '14px 16px' : 0 }}>
            {visitasHoy.total === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--slate-400)', margin: 0 }}>Sin visitas registradas para hoy.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--slate-100)' }}>
                    {['Visitante', 'Unidad', 'Hora esp.', 'Estado', 'Entrada'].map(h => (
                      <th key={h} style={{ padding: '8px 16px', fontSize: 11, fontWeight: 600, color: 'var(--slate-400)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visitasHoy.lista.map(v => {
                    const VCOL = { PENDIENTE: { bg: '#fef9c3', color: '#854d0e' }, 'LLEGÓ': { bg: '#dcfce7', color: '#166534' }, NO_LLEGÓ: { bg: '#fee2e2', color: '#991b1b' }, CANCELADA: { bg: '#f1f5f9', color: '#475569' } };
                    const s = VCOL[v.estado] ?? VCOL.PENDIENTE;
                    return (
                      <tr key={v.id} style={{ borderBottom: '1px solid var(--slate-50)' }}>
                        <td style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600 }}>{v.nombreVisitante}</td>
                        <td style={{ padding: '9px 16px', fontSize: 13, color: 'var(--slate-600)' }}>{v.unidad?.numero}</td>
                        <td style={{ padding: '9px 16px', fontSize: 13, color: 'var(--slate-500)' }}>{v.horaEsperada || '—'}</td>
                        <td style={{ padding: '9px 16px' }}>
                          <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>{v.estado}</span>
                        </td>
                        <td style={{ padding: '9px 16px', fontSize: 12, color: 'var(--slate-500)' }}>
                          {v.entrada ? new Date(v.entrada).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Resumen anual */}
      {resumenAnual.meses.length > 0 && (
        <div className="card">
          <div className="card-header">
            Recaudación {resumenAnual.anio}
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--slate-500)' }}>
              {fmt(resumenAnual.totalRecaudado)} recaudado · {fmt(resumenAnual.totalPendiente)} pendiente
            </span>
          </div>
          <div className="card-body">
            <div className="month-bar-wrap">
              {resumenAnual.meses.map(m => (
                <div key={m.mes} className="month-bar">
                  <span className="month-bar-label">{MESES[m.mes]}</span>
                  <div className="month-bar-track">
                    <div className="month-bar-fill" style={{ width: `${m.pctRecaudado}%` }} />
                  </div>
                  <span className="month-bar-pct">{m.pctRecaudado}%</span>
                  <span style={{ fontSize: 11, color: 'var(--slate-500)', width: 90 }}>{fmt(m.recaudado)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
