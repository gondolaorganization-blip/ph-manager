import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import FileUpload from '../components/FileUpload';
import { pdfUrl } from '../hooks/usePdfUrl';

const METODOS = ['EFECTIVO', 'TRANSFERENCIA', 'YAPPY', 'CHEQUE'];
const EMPTY_PAGO = { metodo: 'TRANSFERENCIA', referencia: '', fecha: '', notas: '', comprobante: '' };

function fmt(n) { return `$${Number(n || 0).toLocaleString('es-PA', { minimumFractionDigits: 2 })}`; }
function fmtFecha(d) { return d ? new Date(d).toLocaleDateString('es-PA') : '—'; }

function estadoBadge(estado) {
  if (estado === 'PAGADO')  return <span className="badge badge-green">Pagado</span>;
  if (estado === 'VENCIDO') return <span className="badge badge-red">Vencido</span>;
  return <span className="badge badge-amber">Pendiente</span>;
}

export default function PagosExtPage() {
  const { edificioId, cuotaExtId } = useParams();
  const [cuota, setCuota]     = useState(null);
  const [pagos, setPagos]     = useState([]);
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState(EMPTY_PAGO);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [filtro, setFiltro]         = useState('');
  const [enviandoRec, setEnviandoRec] = useState(false);

  useEffect(() => { cargar(); }, [cuotaExtId]);

  async function cargar() {
    setLoading(true);
    try {
      const { data } = await api.get(`/edificios/${edificioId}/cuotas-ext/${cuotaExtId}/pagos`);
      setCuota(data.cuota);
      setPagos(data.pagos);
      setStats(data.stats);
    } finally { setLoading(false); }
  }

  function abrirPago(pago) {
    setModal(pago);
    setForm({ ...EMPTY_PAGO, fecha: new Date().toISOString().slice(0, 10) });
    setError('');
  }

  async function registrarPago(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.put(
        `/edificios/${edificioId}/cuotas-ext/${cuotaExtId}/pagos/${modal.id}/pagar`,
        { metodo: form.metodo, referencia: form.referencia || undefined,
          comprobante: form.comprobante || undefined, fecha: form.fecha || undefined,
          notas: form.notas || undefined },
      );
      setModal(null); setForm(EMPTY_PAGO); cargar();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  async function anularPago(pagoId) {
    if (!confirm('¿Anular este pago? Quedará como pendiente o vencido.')) return;
    try {
      await api.put(`/edificios/${edificioId}/cuotas-ext/${cuotaExtId}/pagos/${pagoId}/anular`);
      cargar();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  }

  async function enviarRecordatorio() {
    const pendCount = pagos.filter(p => p.estado !== 'PAGADO').length;
    if (!confirm(`¿Enviar recordatorio a los ${pendCount} propietarios con pagos pendientes/vencidos?`)) return;
    setEnviandoRec(true);
    try {
      const { data } = await api.post(`/edificios/${edificioId}/cuotas-ext/${cuotaExtId}/recordatorio`);
      alert(data.mensaje + (data.sinEmail > 0 ? `\n(${data.sinEmail} sin email registrado)` : ''));
    } catch (err) { alert(err.response?.data?.error || 'Error al enviar'); }
    finally { setEnviandoRec(false); }
  }

  async function actualizarVencidos() {
    try {
      const { data } = await api.post(`/edificios/${edificioId}/cuotas-ext/${cuotaExtId}/mora`);
      alert(`${data.actualizados} pago(s) marcados como vencidos.`);
      cargar();
    } catch { alert('Error al actualizar vencidos'); }
  }

  const pagosFiltrados = filtro ? pagos.filter(p => p.estado === filtro) : pagos;

  return (
    <div className="page">
      {/* Breadcrumb */}
      <div style={{ marginBottom: 16 }}>
        <Link to={`/edificios/${edificioId}/cuotas-ext`}
          style={{ color: 'var(--slate-500)', textDecoration: 'none', fontSize: 13 }}>
          ← Cuotas Extraordinarias
        </Link>
      </div>

      {loading ? <div className="loading">Cargando…</div> : (
        <>
          {/* Header */}
          <div className="page-header">
            <div>
              <h1>{cuota?.descripcion}</h1>
              <p className="page-subtitle">
                {cuota?.tipoDistribucion === 'FIJO' ? `${fmt(cuota?.monto)} por unidad` : `${fmt(cuota?.monto)} total proporcional`}
                {' · '}Vence: {fmtFecha(cuota?.fechaVence)}
                {cuota?.notas && <span style={{ color: 'var(--slate-400)' }}> · {cuota.notas}</span>}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={enviarRecordatorio} disabled={enviandoRec}>
                {enviandoRec ? 'Enviando…' : '📧 Recordatorio'}
              </button>
              <button className="btn btn-ghost" onClick={actualizarVencidos}>Marcar vencidos</button>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="stats-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-label">Total unidades</div>
                <div className="stat-value">{stats.total}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Pagados</div>
                <div className="stat-value stat-green">{stats.pagados}</div>
                <div className="stat-sub">{stats.total > 0 ? ((stats.pagados / stats.total) * 100).toFixed(0) : 0}% cobrado</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Pendientes</div>
                <div className="stat-value stat-amber">{stats.pendientes}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Vencidos</div>
                <div className="stat-value stat-red">{stats.vencidos}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Recaudado</div>
                <div className="stat-value stat-green">{fmt(stats.recaudado)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Por cobrar</div>
                <div className="stat-value stat-amber">{fmt(stats.porCobrar)}</div>
              </div>
            </div>
          )}

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {['', 'PENDIENTE', 'PAGADO', 'VENCIDO'].map(f => (
              <button key={f}
                className={`btn btn-sm ${filtro === f ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFiltro(f)}>
                {f === '' ? `Todos (${pagos.length})` : f === 'PAGADO' ? `Pagados (${stats?.pagados || 0})` : f === 'VENCIDO' ? `Vencidos (${stats?.vencidos || 0})` : `Pendientes (${stats?.pendientes || 0})`}
              </button>
            ))}
          </div>

          {/* Tabla pagos */}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Unidad</th>
                  <th>Propietario</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                  <th>Estado</th>
                  <th>Método</th>
                  <th>F. Pago</th>
                  <th>Referencia</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagosFiltrados.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700 }}>{p.unidad?.numero}</td>
                    <td>{p.unidad?.propietario?.nombre || <span style={{ color: 'var(--slate-400)' }}>Sin propietario</span>}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(p.monto)}</td>
                    <td>{estadoBadge(p.estado)}</td>
                    <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>{p.metodo || '—'}</td>
                    <td style={{ fontSize: 12 }}>{fmtFecha(p.fechaPago)}</td>
                    <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>{p.referencia || '—'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {p.estado !== 'PAGADO' && (
                        <button className="btn btn-primary btn-sm" onClick={() => abrirPago(p)}>
                          Registrar pago
                        </button>
                      )}
                      {p.estado === 'PAGADO' && (
                        <>
                          <a href={pdfUrl(`/api/edificios/${edificioId}/cuotas-ext/${cuotaExtId}/pagos/${p.id}/recibo.pdf`)}
                            target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" title="Recibo PDF">
                            📄
                          </a>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--slate-500)' }}
                            onClick={() => anularPago(p.id)}>Anular</button>
                        </>
                      )}
                      {p.comprobante && (
                        <a href={p.comprobante} target="_blank" rel="noreferrer"
                          className="btn btn-ghost btn-sm">📎</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal pago */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Registrar pago</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <form onSubmit={registrarPago}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div style={{ background: 'var(--slate-50)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
                  <strong>{modal.unidad?.numero}</strong> — {modal.unidad?.propietario?.nombre || 'Sin propietario'} —{' '}
                  <strong style={{ color: 'var(--primary)' }}>{fmt(modal.monto)}</strong>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Método *</label>
                    <select className="form-control" required value={form.metodo}
                      onChange={e => setForm(f => ({ ...f, metodo: e.target.value }))}>
                      {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Fecha de pago *</label>
                    <input type="date" className="form-control" required value={form.fecha}
                      onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Referencia / N° de transacción</label>
                  <input className="form-control" value={form.referencia}
                    onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Comprobante</label>
                  <FileUpload value={form.comprobante}
                    onChange={url => setForm(f => ({ ...f, comprobante: url }))} />
                </div>
                <div className="form-group">
                  <label>Notas</label>
                  <input className="form-control" value={form.notas}
                    onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando…' : 'Confirmar pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
