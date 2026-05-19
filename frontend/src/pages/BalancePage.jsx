import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import { pdfUrl } from '../hooks/usePdfUrl';

const MESES_L = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const CATEGORIAS_GASTO = ['MANTENIMIENTO', 'SERVICIOS', 'PERSONAL', 'ADMINISTRACION', 'FONDO_RESERVA', 'OTROS'];
const CAT_LABEL = {
  MANTENIMIENTO: 'Mantenimiento', SERVICIOS: 'Servicios', PERSONAL: 'Personal',
  ADMINISTRACION: 'Administración', FONDO_RESERVA: 'Fondo Reserva', OTROS: 'Otros',
};
const CAT_COLOR = {
  MANTENIMIENTO: '#0ea5e9', SERVICIOS: '#8b5cf6', PERSONAL: '#f59e0b',
  ADMINISTRACION: '#6b7280', FONDO_RESERVA: '#10b981', OTROS: '#94a3b8',
};
const CAT_INGRESO_LABEL = {
  MULTA: 'Multa', ALQUILER: 'Alquiler', INTERESES: 'Intereses',
  CUOTA_EXTRAORDINARIA: 'Cuota Extraordinaria', OTROS: 'Otros',
};

function fmt(n) { return `$${Number(n || 0).toLocaleString('es-PA', { minimumFractionDigits: 2 })}`; }
function fmtFecha(d) { return d ? new Date(d).toLocaleDateString('es-PA') : '—'; }

export default function BalancePage() {
  const { edificioId } = useParams();
  const now = new Date();
  const [mes,  setMes]  = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [data, setData]         = useState(null);
  const [presp, setPresp]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [tab, setTab]           = useState('ingresos');

  useEffect(() => { cargar(); }, [edificioId, mes, anio]);

  async function cargar() {
    setLoading(true);
    try {
      const [balance, presupuesto] = await Promise.all([
        api.get(`/edificios/${edificioId}/cuotas/reportes/balance`, { params: { mes, anio } }),
        api.get(`/edificios/${edificioId}/presupuesto`, { params: { anio } }),
      ]);
      setData(balance.data);
      setPresp(presupuesto.data);
    } finally { setLoading(false); }
  }

  const anios = [];
  for (let y = now.getFullYear() + 1; y >= 2023; y--) anios.push(y);

  const totalIngresos = data
    ? data.ingresos.total + (data.ingresosExt?.total || 0) + (data.ingresosVarios?.total || 0)
    : 0;

  // Presupuesto del mes actual por categoría
  function presupMes(cat) {
    if (!presp) return 0;
    const item = presp.items.find(i => i.mes === mes && i.categoria === cat);
    return item ? Number(item.monto) : 0;
  }
  function gastoReal(cat) {
    return data?.gastos.porCategoria?.[cat] || 0;
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Balance Financiero</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={mes} onChange={e => setMes(parseInt(e.target.value))}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--slate-200)' }}>
            {MESES_L.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select value={anio} onChange={e => setAnio(parseInt(e.target.value))}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--slate-200)' }}>
            {anios.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {data && (
            <>
              <a className="btn btn-ghost"
                href={pdfUrl(`/api/edificios/${edificioId}/cuotas/reportes/balance.xlsx?mes=${mes}&anio=${anio}`)}
                download>📊 Excel</a>
              <a className="btn btn-primary"
                href={pdfUrl(`/api/edificios/${edificioId}/cuotas/reportes/balance.pdf?mes=${mes}&anio=${anio}`)}
                target="_blank" rel="noreferrer">📄 PDF</a>
            </>
          )}
        </div>
      </div>

      {loading && <div className="loading">Cargando…</div>}

      {!loading && data && (
        <>
          {/* KPIs */}
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-label">Ingresos del mes</div>
              <div className="stat-value stat-green">{fmt(totalIngresos)}</div>
              <div className="stat-sub">
                Cuotas {fmt(data.ingresos.total)}
                {data.ingresosExt?.total > 0 && ` · Ext. ${fmt(data.ingresosExt.total)}`}
                {data.ingresosVarios?.total > 0 && ` · Varios ${fmt(data.ingresosVarios.total)}`}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Gastos del mes</div>
              <div className="stat-value stat-red">{fmt(data.gastos.total)}</div>
              <div className="stat-sub">{data.gastos.count} registro(s)</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Balance neto</div>
              <div className={`stat-value ${data.balance >= 0 ? 'stat-green' : 'stat-red'}`}>
                {fmt(data.balance)}
              </div>
              <div className="stat-sub">{data.balance >= 0 ? 'Superávit' : 'Déficit'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Fondo de reserva</div>
              <div className="stat-value stat-blue">{fmt(data.fondoReserva)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Deuda pendiente total</div>
              <div className="stat-value stat-amber">{fmt(data.deudaPendiente)}</div>
            </div>
          </div>

          {/* Gastos por categoría */}
          {data.gastos.count > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--slate-100)', fontWeight: 600, fontSize: 14 }}>
                Gastos por categoría — {MESES_L[mes]} {anio}
              </div>
              <div style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {Object.entries(data.gastos.porCategoria).map(([cat, monto]) => {
                  const pct   = data.gastos.total > 0 ? ((monto / data.gastos.total) * 100).toFixed(1) : 0;
                  const color = CAT_COLOR[cat] || '#94a3b8';
                  return (
                    <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--slate-50)', borderRadius: 8, border: '1px solid var(--slate-200)' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-700)' }}>{cat}</div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(monto)} <span style={{ color: 'var(--slate-400)', fontWeight: 400 }}>({pct}%)</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
            {[
              { key: 'ingresos',        label: `Cuotas (${data.ingresos.count})` },
              { key: 'cuotas-ext',      label: `Cuotas Ext. (${data.ingresosExt?.count || 0})` },
              { key: 'ingresos-varios', label: `Ingresos varios (${data.ingresosVarios?.count || 0})` },
              { key: 'gastos',          label: `Gastos (${data.gastos.count})` },
              { key: 'presupuesto',     label: 'vs Presupuesto' },
            ].map(t => (
              <button key={t.key}
                className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab: Cuotas */}
          {tab === 'ingresos' && (
            <div className="card">
              {data.ingresos.count === 0 ? (
                <div className="empty-state"><p>Sin pagos recibidos en {MESES_L[mes]} {anio}.</p></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Unidad</th><th>Propietario</th><th>Cuota</th><th>F. Pago</th><th>Monto</th><th>Mora</th><th>Total</th></tr>
                    </thead>
                    <tbody>
                      {data.ingresos.detalle.map((p, i) => (
                        <tr key={i}>
                          <td><strong>{p.unidad}</strong></td>
                          <td>{p.propietario}</td>
                          <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>{MESES_L[p.cuota.mes]?.slice(0,3)} {p.cuota.anio}</td>
                          <td style={{ fontSize: 12 }}>{fmtFecha(p.fechaPago)}</td>
                          <td>{fmt(p.monto)}</td>
                          <td style={{ color: p.mora > 0 ? 'var(--red-600)' : 'var(--slate-400)' }}>{fmt(p.mora)}</td>
                          <td style={{ fontWeight: 700, color: 'var(--green-600)' }}>{fmt(p.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--slate-50)', fontWeight: 700 }}>
                        <td colSpan={6} style={{ textAlign: 'right', paddingRight: 12 }}>Total cuotas</td>
                        <td style={{ color: 'var(--green-600)' }}>{fmt(data.ingresos.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab: Cuotas Extraordinarias */}
          {tab === 'cuotas-ext' && (
            <div className="card">
              {!data.ingresosExt?.count ? (
                <div className="empty-state"><p>Sin pagos de cuotas extraordinarias en {MESES_L[mes]} {anio}.</p></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Unidad</th><th>Propietario</th><th>Cuota</th><th>F. Pago</th><th>Monto</th></tr>
                    </thead>
                    <tbody>
                      {data.ingresosExt.detalle.map((p, i) => (
                        <tr key={i}>
                          <td><strong>{p.unidad}</strong></td>
                          <td>{p.propietario}</td>
                          <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>{p.descripcion}</td>
                          <td style={{ fontSize: 12 }}>{fmtFecha(p.fechaPago)}</td>
                          <td style={{ fontWeight: 700, color: 'var(--green-600)' }}>{fmt(p.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--slate-50)', fontWeight: 700 }}>
                        <td colSpan={4} style={{ textAlign: 'right', paddingRight: 12 }}>Total cuotas ext.</td>
                        <td style={{ color: 'var(--green-600)' }}>{fmt(data.ingresosExt.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab: Ingresos varios */}
          {tab === 'ingresos-varios' && (
            <div className="card">
              {!data.ingresosVarios?.count ? (
                <div className="empty-state"><p>Sin ingresos varios en {MESES_L[mes]} {anio}.</p></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Referencia</th><th>Monto</th></tr>
                    </thead>
                    <tbody>
                      {data.ingresosVarios.detalle.map((i, idx) => (
                        <tr key={idx}>
                          <td style={{ fontSize: 12 }}>{fmtFecha(i.fecha)}</td>
                          <td style={{ fontSize: 12 }}>{CAT_INGRESO_LABEL[i.categoria] || i.categoria}</td>
                          <td>{i.descripcion}</td>
                          <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>{i.referencia || '—'}</td>
                          <td style={{ fontWeight: 700, color: 'var(--green-600)' }}>{fmt(i.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--slate-50)', fontWeight: 700 }}>
                        <td colSpan={4} style={{ textAlign: 'right', paddingRight: 12 }}>Total ingresos varios</td>
                        <td style={{ color: 'var(--green-600)' }}>{fmt(data.ingresosVarios.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab: Gastos */}
          {tab === 'gastos' && (
            <div className="card">
              {data.gastos.count === 0 ? (
                <div className="empty-state"><p>Sin gastos registrados en {MESES_L[mes]} {anio}.</p></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Proveedor</th><th>Monto</th></tr>
                    </thead>
                    <tbody>
                      {data.gastos.detalle.map((g, i) => (
                        <tr key={i}>
                          <td style={{ fontSize: 12 }}>{fmtFecha(g.fecha)}</td>
                          <td>
                            <span className="badge" style={{ background: 'var(--slate-100)', color: CAT_COLOR[g.categoria] || 'var(--slate-600)', fontSize: 11 }}>
                              {g.categoria}
                            </span>
                          </td>
                          <td>{g.descripcion}</td>
                          <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>{g.proveedor || '—'}</td>
                          <td style={{ fontWeight: 700, color: 'var(--red-600)' }}>{fmt(g.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--slate-50)', fontWeight: 700 }}>
                        <td colSpan={4} style={{ textAlign: 'right', paddingRight: 12 }}>Total gastos</td>
                        <td style={{ color: 'var(--red-600)' }}>{fmt(data.gastos.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab: vs Presupuesto */}
          {tab === 'presupuesto' && (
            <TabPresupuesto
              mes={mes} anio={anio} presp={presp}
              gastoReal={gastoReal} presupMes={presupMes}
              totalGastos={data.gastos.total}
            />
          )}
        </>
      )}
    </div>
  );
}

function TabPresupuesto({ mes, anio, presp, gastoReal, presupMes, totalGastos }) {
  if (!presp) return <div className="loading">Cargando presupuesto…</div>;

  const filas = CATEGORIAS_GASTO.map(cat => {
    const prespuesto = presupMes(cat);
    const real       = gastoReal(cat);
    const delta      = prespuesto - real;
    const pct        = prespuesto > 0 ? Math.min((real / prespuesto) * 100, 100) : (real > 0 ? 100 : 0);
    const over       = prespuesto > 0 && real > prespuesto;
    return { cat, prespuesto, real, delta, pct, over };
  });

  const totalPresp = filas.reduce((s, f) => s + f.prespuesto, 0);
  const totalDelta = totalPresp - totalGastos;
  const totalPct   = totalPresp > 0 ? Math.min((totalGastos / totalPresp) * 100, 100) : (totalGastos > 0 ? 100 : 0);
  const totalOver  = totalGastos > totalPresp && totalPresp > 0;

  const sinPresupuesto = totalPresp === 0;

  return (
    <div className="card">
      {sinPresupuesto ? (
        <div className="empty-state">
          <p>No hay presupuesto definido para {MESES_L[mes]} {anio}.</p>
          <p style={{ fontSize: 13, color: 'var(--slate-400)' }}>
            Define el presupuesto en la sección 🎯 Presupuesto.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Categoría</th>
                <th style={{ textAlign: 'right' }}>Presupuesto</th>
                <th style={{ textAlign: 'right' }}>Gasto Real</th>
                <th style={{ textAlign: 'right' }}>Disponible</th>
                <th style={{ minWidth: 160 }}>Ejecución</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ cat, prespuesto, real, delta, pct, over }) => (
                <tr key={cat}>
                  <td style={{ fontWeight: 600 }}>{CAT_LABEL[cat]}</td>
                  <td style={{ textAlign: 'right' }}>
                    {prespuesto > 0 ? fmt(prespuesto) : <span style={{ color: 'var(--slate-300)' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'right', color: over ? '#dc2626' : undefined, fontWeight: over ? 700 : undefined }}>
                    {real > 0 ? fmt(real) : <span style={{ color: 'var(--slate-300)' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'right', color: delta >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                    {prespuesto > 0 || real > 0
                      ? `${delta >= 0 ? '+' : ''}${fmt(delta)}`
                      : <span style={{ color: 'var(--slate-300)' }}>—</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 8, background: 'var(--slate-100)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 4, transition: 'width .3s',
                          width: `${pct}%`,
                          background: over ? '#dc2626' : pct > 80 ? '#f59e0b' : '#16a34a',
                        }} />
                      </div>
                      <span style={{ fontSize: 12, color: over ? '#dc2626' : 'var(--slate-600)', minWidth: 36, textAlign: 'right' }}>
                        {prespuesto > 0 ? `${pct.toFixed(0)}%` : ''}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, background: 'var(--slate-50)' }}>
                <td>TOTAL</td>
                <td style={{ textAlign: 'right' }}>{fmt(totalPresp)}</td>
                <td style={{ textAlign: 'right', color: totalOver ? '#dc2626' : undefined }}>{fmt(totalGastos)}</td>
                <td style={{ textAlign: 'right', color: totalDelta >= 0 ? '#16a34a' : '#dc2626' }}>
                  {`${totalDelta >= 0 ? '+' : ''}${fmt(totalDelta)}`}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 8, background: 'var(--slate-100)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        width: `${totalPct}%`,
                        background: totalOver ? '#dc2626' : totalPct > 80 ? '#f59e0b' : '#16a34a',
                      }} />
                    </div>
                    <span style={{ fontSize: 12, color: totalOver ? '#dc2626' : 'var(--slate-600)', minWidth: 36, textAlign: 'right' }}>
                      {totalPresp > 0 ? `${totalPct.toFixed(0)}%` : ''}
                    </span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
