import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';

const EMPTY = {
  descripcion: '', monto: '', tipoDistribucion: 'FIJO',
  fechaVence: '', notas: '',
};

function fmt(n) { return `$${Number(n || 0).toLocaleString('es-PA', { minimumFractionDigits: 2 })}`; }
function fmtFecha(d) { return d ? new Date(d).toLocaleDateString('es-PA') : '—'; }
function vencida(d) { return d && new Date(d) < new Date(); }

function estadoGeneral(stats) {
  if (!stats.total) return null;
  if (stats.pagados === stats.total) return { label: 'Cobrada', cls: 'badge-green' };
  if (stats.vencidos > 0)           return { label: 'Con vencidos', cls: 'badge-red' };
  return { label: 'En proceso', cls: 'badge-amber' };
}

export default function CuotasExtPage() {
  const { edificioId } = useParams();
  const [cuotas, setCuotas]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => { cargar(); }, [edificioId]);

  async function cargar() {
    setLoading(true);
    try {
      const { data } = await api.get(`/edificios/${edificioId}/cuotas-ext`);
      setCuotas(data);
    } finally { setLoading(false); }
  }

  async function crear(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.post(`/edificios/${edificioId}/cuotas-ext`, {
        ...form,
        monto: parseFloat(form.monto),
      });
      setModal(false); setForm(EMPTY); cargar();
    } catch (err) { setError(err.response?.data?.error || 'Error al crear'); }
    finally { setSaving(false); }
  }

  async function eliminar(c) {
    if (!confirm(`¿Eliminar la cuota "${c.descripcion}"? Solo es posible si no hay pagos registrados.`)) return;
    try {
      await api.delete(`/edificios/${edificioId}/cuotas-ext/${c.id}`);
      cargar();
    } catch (err) { alert(err.response?.data?.error || 'Error al eliminar'); }
  }

  // Totales globales
  const totalRecaudado = cuotas.reduce((s, c) => s + c.stats.recaudado, 0);
  const totalPorCobrar = cuotas.reduce((s, c) => s + c.stats.porCobrar, 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Cuotas Extraordinarias</h1>
          <p className="page-subtitle">Cargos únicos por obras, reparaciones u otros conceptos</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setError(''); setModal(true); }}>
          + Nueva cuota
        </button>
      </div>

      {/* Resumen */}
      {cuotas.length > 0 && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Total emitidas</div>
            <div className="stat-value">{cuotas.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Recaudado (todos)</div>
            <div className="stat-value stat-green">{fmt(totalRecaudado)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Por cobrar (todos)</div>
            <div className="stat-value stat-amber">{fmt(totalPorCobrar)}</div>
          </div>
        </div>
      )}

      {loading ? <div className="loading">Cargando…</div> : cuotas.length === 0 ? (
        <div className="empty-state">
          <p>No hay cuotas extraordinarias registradas.</p>
          <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setError(''); setModal(true); }}>
            + Crear primera cuota
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Tipo</th>
                <th style={{ textAlign: 'right' }}>Monto</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th>Cobros</th>
                <th style={{ textAlign: 'right' }}>Recaudado</th>
                <th style={{ textAlign: 'right' }}>Por cobrar</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cuotas.map(c => {
                const eg = estadoGeneral(c.stats);
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>
                      <Link to={`/edificios/${edificioId}/cuotas-ext/${c.id}/pagos`}
                        style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                        {c.descripcion}
                      </Link>
                    </td>
                    <td>
                      <span className={`badge ${c.tipoDistribucion === 'FIJO' ? 'badge-blue' : 'badge-slate'}`}
                        style={{ fontSize: 11 }}>
                        {c.tipoDistribucion === 'FIJO' ? 'Fijo' : 'Proporcional'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{fmt(c.monto)}</td>
                    <td style={{ fontSize: 13, color: vencida(c.fechaVence) ? 'var(--red-600)' : undefined }}>
                      {fmtFecha(c.fechaVence)}
                    </td>
                    <td>{eg && <span className={`badge ${eg.cls}`}>{eg.label}</span>}</td>
                    <td style={{ fontSize: 13 }}>
                      <span style={{ color: 'var(--green-600)', fontWeight: 600 }}>{c.stats.pagados}</span>
                      <span style={{ color: 'var(--slate-400)' }}> / {c.stats.total}</span>
                      {c.stats.vencidos > 0 && (
                        <span style={{ color: 'var(--red-600)', marginLeft: 6 }}>({c.stats.vencidos} venc.)</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--green-600)', fontWeight: 600 }}>{fmt(c.stats.recaudado)}</td>
                    <td style={{ textAlign: 'right', color: c.stats.porCobrar > 0 ? 'var(--amber-600)' : 'var(--slate-400)' }}>
                      {fmt(c.stats.porCobrar)}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Link to={`/edificios/${edificioId}/cuotas-ext/${c.id}/pagos`}
                        className="btn btn-ghost btn-sm">Ver pagos</Link>
                      {c.stats.pagados === 0 && (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-500)' }}
                          onClick={() => eliminar(c)}>Eliminar</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nueva cuota extraordinaria</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={crear}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label>Descripción *</label>
                  <input className="form-control" required placeholder="Ej: Pintura fachada, Reparación ascensor…"
                    value={form.descripcion}
                    onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Tipo de distribución *</label>
                    <select className="form-control" value={form.tipoDistribucion}
                      onChange={e => setForm(f => ({ ...f, tipoDistribucion: e.target.value }))}>
                      <option value="FIJO">Fijo — mismo monto por unidad</option>
                      <option value="PROPORCIONAL">Proporcional — distribuido por coeficiente</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>
                      {form.tipoDistribucion === 'FIJO' ? 'Monto por unidad *' : 'Monto total *'}
                    </label>
                    <input type="number" min="0.01" step="0.01" className="form-control" required
                      value={form.monto}
                      onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Fecha de vencimiento *</label>
                  <input type="date" className="form-control" required value={form.fechaVence}
                    onChange={e => setForm(f => ({ ...f, fechaVence: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Notas</label>
                  <textarea className="form-control" rows={2} value={form.notas}
                    onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
                </div>
                <div className="alert" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 13 }}>
                  {form.tipoDistribucion === 'FIJO'
                    ? 'Se generará un pago por el mismo monto para cada unidad activa del edificio.'
                    : 'El monto total se distribuirá entre las unidades según su coeficiente de participación.'}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creando…' : 'Crear cuota y generar pagos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
