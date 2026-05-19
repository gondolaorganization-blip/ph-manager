import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';

const CATEGORIAS = ['MANTENIMIENTO', 'SERVICIOS', 'PERSONAL', 'ADMINISTRACION', 'FONDO_RESERVA', 'OTROS'];
const CAT_LABEL  = {
  MANTENIMIENTO: 'Mantenimiento', SERVICIOS: 'Servicios',
  PERSONAL: 'Personal', ADMINISTRACION: 'Administración',
  FONDO_RESERVA: 'Fondo Reserva', OTROS: 'Otros',
};
const MESES_CORTO = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGO = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const ANIO_ACTUAL = new Date().getFullYear();
const MES_ACTUAL  = new Date().getMonth() + 1;

function fmt(n) { return `$${Number(n || 0).toLocaleString('es-PA', { minimumFractionDigits: 2 })}`; }

// Build an empty 12×6 grid: grid[mes][categoria] = ''
function emptyGrid() {
  const g = {};
  for (let m = 1; m <= 12; m++) {
    g[m] = {};
    CATEGORIAS.forEach(c => { g[m][c] = ''; });
  }
  return g;
}

function gridFromItems(items) {
  const g = emptyGrid();
  items.forEach(({ mes, categoria, monto }) => {
    if (g[mes]) g[mes][categoria] = Number(monto) === 0 ? '' : String(Number(monto));
  });
  return g;
}

// Build lookup real[mes][categoria] = total
function realLookup(gastos) {
  const r = {};
  gastos.forEach(({ mes, categoria, total }) => {
    if (!r[mes]) r[mes] = {};
    r[mes][categoria] = total;
  });
  return r;
}

export default function PresupuestoPage() {
  const { edificioId } = useParams();
  const [anio, setAnio]   = useState(ANIO_ACTUAL);
  const [tab, setTab]     = useState('anual');
  const [mes, setMes]     = useState(MES_ACTUAL);
  const [grid, setGrid]   = useState(emptyGrid());
  const [real, setReal]   = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/edificios/${edificioId}/presupuesto?anio=${anio}`);
      setGrid(gridFromItems(data.items));
      setReal(realLookup(data.gastos));
    } catch {
      setError('Error al cargar presupuesto');
    } finally {
      setLoading(false);
    }
  }, [edificioId, anio]);

  useEffect(() => { cargar(); }, [cargar]);

  function setCell(mes, cat, val) {
    setGrid(g => ({ ...g, [mes]: { ...g[mes], [cat]: val } }));
    setSaved(false);
  }

  async function guardar() {
    setSaving(true); setError(''); setSaved(false);
    const items = [];
    for (let m = 1; m <= 12; m++) {
      CATEGORIAS.forEach(cat => {
        items.push({ mes: m, categoria: cat, monto: parseFloat(grid[m][cat]) || 0 });
      });
    }
    try {
      await api.put(`/edificios/${edificioId}/presupuesto`, { anio, items });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Error al guardar presupuesto');
    } finally {
      setSaving(false);
    }
  }

  // ── Totales ─────────────────────────────────────────────────────────────────

  function totalPresupMes(m) {
    return CATEGORIAS.reduce((s, c) => s + (parseFloat(grid[m]?.[c]) || 0), 0);
  }
  function totalPresupCat(cat) {
    let s = 0;
    for (let m = 1; m <= 12; m++) s += parseFloat(grid[m]?.[cat]) || 0;
    return s;
  }
  function totalRealMes(m) {
    return CATEGORIAS.reduce((s, c) => s + (real[m]?.[c] || 0), 0);
  }
  function totalRealCat(cat) {
    let s = 0;
    for (let m = 1; m <= 12; m++) s += real[m]?.[cat] || 0;
    return s;
  }
  const totalAnualPresp = CATEGORIAS.reduce((s, c) => s + totalPresupCat(c), 0);
  const totalAnualReal  = CATEGORIAS.reduce((s, c) => s + totalRealCat(c), 0);

  // ── Vista mensual ────────────────────────────────────────────────────────────

  function datosMes(m) {
    return CATEGORIAS.map(cat => {
      const presp = parseFloat(grid[m]?.[cat]) || 0;
      const gasto = real[m]?.[cat] || 0;
      const delta = presp - gasto;
      const pct   = presp > 0 ? Math.min((gasto / presp) * 100, 100) : (gasto > 0 ? 100 : 0);
      const over  = presp > 0 && gasto > presp;
      return { cat, presp, gasto, delta, pct, over };
    });
  }

  const filasMes       = datosMes(mes);
  const totalMesPresp  = filasMes.reduce((s, r) => s + r.presp, 0);
  const totalMesReal   = filasMes.reduce((s, r) => s + r.gasto, 0);
  const totalMesDelta  = totalMesPresp - totalMesReal;
  const totalMesPct    = totalMesPresp > 0 ? Math.min((totalMesReal / totalMesPresp) * 100, 100) : (totalMesReal > 0 ? 100 : 0);
  const totalMesOver   = totalMesReal > totalMesPresp && totalMesPresp > 0;

  return (
    <div className="page">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Presupuesto</h1>
          <p className="page-subtitle">Planificación y seguimiento de gastos por categoría</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="form-control" style={{ width: 100 }} value={anio}
            onChange={e => setAnio(parseInt(e.target.value))}>
            {[ANIO_ACTUAL - 1, ANIO_ACTUAL, ANIO_ACTUAL + 1].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          {tab === 'anual' && (
            <button className="btn btn-primary" onClick={guardar} disabled={saving || loading}>
              {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar cambios'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--slate-200)' }}>
        {['anual', 'mensual'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: tab === t ? 700 : 400,
            color: tab === t ? 'var(--primary)' : 'var(--slate-500)',
            borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: -2, fontSize: 14,
          }}>
            {t === 'anual' ? '📅 Vista Anual' : '📆 Vista Mensual'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--slate-400)' }}>Cargando…</div>
      ) : tab === 'anual' ? (
        <VistaAnual
          grid={grid} real={real} setCell={setCell}
          totalPresupMes={totalPresupMes} totalRealMes={totalRealMes}
          totalPresupCat={totalPresupCat} totalRealCat={totalRealCat}
          totalAnualPresp={totalAnualPresp} totalAnualReal={totalAnualReal}
        />
      ) : (
        <VistaMensual
          mes={mes} setMes={setMes} filas={filasMes}
          totalPresp={totalMesPresp} totalReal={totalMesReal}
          totalDelta={totalMesDelta} totalPct={totalMesPct} totalOver={totalMesOver}
        />
      )}
    </div>
  );
}

// ── Vista Anual ───────────────────────────────────────────────────────────────

function VistaAnual({ grid, real, setCell, totalPresupMes, totalRealMes, totalPresupCat, totalRealCat, totalAnualPresp, totalAnualReal }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <p style={{ color: 'var(--slate-500)', fontSize: 13, marginBottom: 12 }}>
        Ingrese el presupuesto mensual por categoría. En gris se muestra el gasto real registrado.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--slate-50)' }}>
            <th style={thStyle({ textAlign: 'left', minWidth: 140 })}>Categoría</th>
            {MESES_CORTO.slice(1).map((m, i) => (
              <th key={i + 1} style={thStyle({ textAlign: 'center', minWidth: 88 })}>{m}</th>
            ))}
            <th style={thStyle({ textAlign: 'center', minWidth: 100 })}>Total</th>
          </tr>
        </thead>
        <tbody>
          {CATEGORIAS.map(cat => (
            <tr key={cat} style={{ borderBottom: '1px solid var(--slate-100)' }}>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--slate-700)' }}>
                {CAT_LABEL[cat]}
              </td>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                const gasto = real[m]?.[cat] || 0;
                const presp = parseFloat(grid[m]?.[cat]) || 0;
                const over  = presp > 0 && gasto > presp;
                return (
                  <td key={m} style={{ padding: '4px 4px', background: over ? '#fff5f5' : undefined }}>
                    <input
                      type="number" min="0" step="0.01"
                      value={grid[m]?.[cat] ?? ''}
                      onChange={e => setCell(m, cat, e.target.value)}
                      style={{
                        width: '100%', border: '1px solid var(--slate-200)', borderRadius: 4,
                        padding: '3px 6px', fontSize: 12, textAlign: 'right',
                        background: 'transparent', outline: 'none',
                        color: 'var(--slate-800)',
                      }}
                      placeholder="0"
                    />
                    {gasto > 0 && (
                      <div style={{ fontSize: 10, color: over ? '#dc2626' : 'var(--slate-400)', textAlign: 'right', paddingRight: 6, marginTop: 1 }}>
                        {fmt(gasto)}
                      </div>
                    )}
                  </td>
                );
              })}
              <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--primary)', background: 'var(--slate-50)' }}>
                <div>{fmt(totalPresupCat(cat))}</div>
                {totalRealCat(cat) > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 400, color: totalRealCat(cat) > totalPresupCat(cat) ? '#dc2626' : 'var(--slate-400)' }}>
                    {fmt(totalRealCat(cat))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: 'var(--slate-100)', fontWeight: 700 }}>
            <td style={{ padding: '8px 12px', color: 'var(--slate-700)' }}>TOTAL</td>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
              const tp = totalPresupMes(m);
              const tr = totalRealMes(m);
              const over = tp > 0 && tr > tp;
              return (
                <td key={m} style={{ padding: '6px 8px', textAlign: 'right', background: over ? '#fee2e2' : undefined }}>
                  <div style={{ color: 'var(--primary)', fontSize: 12 }}>{fmt(tp)}</div>
                  {tr > 0 && (
                    <div style={{ fontSize: 10, color: over ? '#dc2626' : 'var(--slate-500)', fontWeight: 400 }}>{fmt(tr)}</div>
                  )}
                </td>
              );
            })}
            <td style={{ padding: '6px 8px', textAlign: 'right', background: 'var(--slate-200)' }}>
              <div style={{ color: 'var(--primary)' }}>{fmt(totalAnualPresp)}</div>
              {totalAnualReal > 0 && (
                <div style={{ fontSize: 11, color: totalAnualReal > totalAnualPresp ? '#dc2626' : 'var(--slate-500)', fontWeight: 400 }}>
                  {fmt(totalAnualReal)}
                </div>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
      <p style={{ color: 'var(--slate-400)', fontSize: 11, marginTop: 8 }}>
        Presupuesto en negro · Gasto real en gris · Rojo indica exceso de presupuesto
      </p>
    </div>
  );
}

function thStyle(extra = {}) {
  return { padding: '10px 8px', fontWeight: 600, color: 'var(--slate-600)', borderBottom: '2px solid var(--slate-200)', ...extra };
}

// ── Vista Mensual ─────────────────────────────────────────────────────────────

function VistaMensual({ mes, setMes, filas, totalPresp, totalReal, totalDelta, totalPct, totalOver }) {
  return (
    <div>
      {/* Mes selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <label style={{ fontWeight: 600, color: 'var(--slate-600)' }}>Mes:</label>
        <select className="form-control" style={{ width: 160 }} value={mes} onChange={e => setMes(parseInt(e.target.value))}>
          {MESES_LARGO.slice(1).map((nombre, i) => (
            <option key={i + 1} value={i + 1}>{nombre}</option>
          ))}
        </select>
      </div>

      {/* Cards resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <CardResumen label="Presupuesto" valor={totalPresp} color="var(--primary)" />
        <CardResumen label="Gasto real" valor={totalReal} color={totalOver ? '#dc2626' : '#16a34a'} />
        <CardResumen label="Disponible" valor={totalDelta} color={totalDelta >= 0 ? '#16a34a' : '#dc2626'} signo />
        <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--slate-500)', marginBottom: 6 }}>Ejecución total</div>
          <div style={{ height: 8, background: 'var(--slate-100)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4, transition: 'width .3s',
              width: `${totalPct}%`,
              background: totalOver ? '#dc2626' : totalPct > 80 ? '#f59e0b' : '#16a34a',
            }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: totalOver ? '#dc2626' : 'var(--slate-700)', marginTop: 6 }}>
            {totalPct.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Tabla por categoría */}
      <div className="table-container">
        <table className="table">
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
            {filas.map(({ cat, presp, gasto, delta, pct, over }) => (
              <tr key={cat}>
                <td style={{ fontWeight: 600 }}>{CAT_LABEL[cat]}</td>
                <td style={{ textAlign: 'right' }}>
                  {presp > 0 ? fmt(presp) : <span style={{ color: 'var(--slate-300)' }}>—</span>}
                </td>
                <td style={{ textAlign: 'right', color: over ? '#dc2626' : undefined, fontWeight: over ? 700 : undefined }}>
                  {gasto > 0 ? fmt(gasto) : <span style={{ color: 'var(--slate-300)' }}>—</span>}
                </td>
                <td style={{ textAlign: 'right', color: delta >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                  {presp > 0 || gasto > 0
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
                      {presp > 0 ? `${pct.toFixed(0)}%` : ''}
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
              <td style={{ textAlign: 'right', color: totalOver ? '#dc2626' : undefined }}>{fmt(totalReal)}</td>
              <td style={{ textAlign: 'right', color: totalDelta >= 0 ? '#16a34a' : '#dc2626' }}>
                {`${totalDelta >= 0 ? '+' : ''}${fmt(totalDelta)}`}
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 8, background: 'var(--slate-100)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4, width: `${totalPct}%`,
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
    </div>
  );
}

function CardResumen({ label, valor, color, signo }) {
  return (
    <div className="stat-card">
      <div style={{ fontSize: 12, color: 'var(--slate-500)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>
        {signo && valor >= 0 ? '+' : ''}{fmt(valor)}
      </div>
    </div>
  );
}
