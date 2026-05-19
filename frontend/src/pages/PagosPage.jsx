import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { pdfUrl } from '../hooks/usePdfUrl';
import FileUpload from '../components/FileUpload';

const MESES_L = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const METODOS = ['EFECTIVO', 'TRANSFERENCIA', 'YAPPY', 'CHEQUE'];
const EMPTY_PAGO = { metodo: 'TRANSFERENCIA', referencia: '', fecha: '', notas: '', comprobante: '' };

function fmt(n) { return `$${Number(n).toLocaleString('es-PA', { minimumFractionDigits: 2 })}`; }
function estadoBadge(estado) {
  if (estado === 'PAGADO')   return <span className="badge badge-green">Pagado</span>;
  if (estado === 'VENCIDO')  return <span className="badge badge-red">Vencido</span>;
  return <span className="badge badge-amber">Pendiente</span>;
}

export default function PagosPage() {
  const { edificioId, cuotaId } = useParams();
  const [cuota, setCuota]     = useState(null);
  const [pagos, setPagos]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null); // pago seleccionado
  const [form, setForm]       = useState(EMPTY_PAGO);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [filtro, setFiltro]   = useState('');
  const [enviando, setEnviando]           = useState(false);
  const [enviandoRec, setEnviandoRec]     = useState(false);

  useEffect(() => { cargar(); }, [cuotaId]);

  async function cargar() {
    setLoading(true);
    try {
      const { data } = await api.get(`/edificios/${edificioId}/cuotas/${cuotaId}`);
      setCuota(data);
      setPagos(data.pagos);
    } finally { setLoading(false); }
  }

  async function registrarPago(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.put(`/edificios/${edificioId}/cuotas/pagos/${modal.id}/pagar`, {
        metodo:      form.metodo,
        referencia:  form.referencia   || undefined,
        comprobante: form.comprobante  || undefined,
        fecha:       form.fecha        || undefined,
        notas:       form.notas        || undefined,
      });
      setModal(null); setForm(EMPTY_PAGO); cargar();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  async function anularPago(pagoId) {
    if (!confirm('¿Anular este pago? Quedará como pendiente/vencido.')) return;
    try { await api.put(`/edificios/${edificioId}/cuotas/pagos/${pagoId}/anular`); cargar(); }
    catch (err) { alert(err.response?.data?.error || 'Error'); }
  }

  async function actualizarMora() {
    try {
      const { data } = await api.post(`/edificios/${edificioId}/cuotas/pagos/actualizar-mora`);
      alert(data.mensaje);
      cargar();
    } catch { alert('Error al actualizar mora'); }
  }

  async function enviarRecordatorio() {
    const pendCount = pagos.filter(p => p.estado !== 'PAGADO').length;
    if (!confirm(`¿Enviar recordatorio de pago a los ${pendCount} propietarios pendientes/vencidos con email registrado?`)) return;
    setEnviandoRec(true);
    try {
      const { data } = await api.post(`/edificios/${edificioId}/cuotas/${cuotaId}/recordatorio`);
      alert(data.mensaje + (data.sinEmail > 0 ? `\n(${data.sinEmail} sin email registrado)` : ''));
    } catch (err) { alert(err.response?.data?.error || 'Error al enviar'); }
    finally { setEnviandoRec(false); }
  }

  async function enviarEstadoPorEmail() {
    if (!confirm('¿Enviar el estado de cuenta por email a todos los propietarios con email registrado?')) return;
    setEnviando(true);
    try {
      const { data } = await api.post(`/edificios/${edificioId}/cuotas/${cuotaId}/enviar-estado`);
      alert(data.mensaje + (data.sinEmail > 0 ? `\n(${data.sinEmail} sin email registrado)` : '') + (data.errores > 0 ? `\n(${data.errores} con error)` : ''));
    } catch (err) { alert(err.response?.data?.error || 'Error al enviar'); }
    finally { setEnviando(false); }
  }

  const pagosFiltrados = filtro ? pagos.filter(p => p.estado === filtro) : pagos;
  const pagados   = pagos.filter(p => p.estado === 'PAGADO').length;
  const vencidos  = pagos.filter(p => p.estado === 'VENCIDO').length;
  const pendientes = pagos.filter(p => p.estado === 'PENDIENTE').length;
  const recaudado = pagos.filter(p => p.estado === 'PAGADO').reduce((s, p) => s + Number(p.monto), 0);

  if (loading) return <div className="loading">Cargando…</div>;
  if (!cuota) return <div className="loading">Cuota no encontrada</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to={`/edificios/${edificioId}/cuotas`} style={{ fontSize: 12, color: 'var(--slate-500)' }}>
            ← Cuotas
          </Link>
          <h1>Pagos — {MESES_L[cuota.mes]} {cuota.anio}</h1>
        </div>
        <div className="gap-8">
          <button className="btn btn-ghost btn-sm" onClick={actualizarMora}>↻ Actualizar mora</button>
          <button className="btn btn-ghost btn-sm" onClick={enviarRecordatorio} disabled={enviandoRec}>
            {enviandoRec ? 'Enviando…' : '📧 Recordatorio'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={enviarEstadoPorEmail} disabled={enviando}>
            {enviando ? 'Enviando…' : '📧 Enviar estado'}
          </button>
          <a className="btn btn-ghost btn-sm" href={pdfUrl(`/api/edificios/${edificioId}/cuotas/${cuotaId}/pagos.xlsx`)} download>
            📊 Excel
          </a>
          <a className="btn btn-ghost btn-sm" href={pdfUrl(`/api/edificios/${edificioId}/cuotas/${cuotaId}/reporte.pdf`)} target="_blank" rel="noreferrer">
            📄 PDF
          </a>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Recaudado</div><div className="stat-value stat-green">{fmt(recaudado)}</div></div>
        <div className="stat-card"><div className="stat-label">Pagados</div><div className="stat-value stat-green">{pagados}</div></div>
        <div className="stat-card"><div className="stat-label">Pendientes</div><div className="stat-value stat-amber">{pendientes}</div></div>
        <div className="stat-card"><div className="stat-label">Vencidos</div><div className="stat-value stat-red">{vencidos}</div></div>
      </div>

      {/* Filtros */}
      <div className="gap-8" style={{ marginBottom: 12 }}>
        {['', 'PAGADO', 'PENDIENTE', 'VENCIDO'].map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filtro === f ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFiltro(f)}
          >
            {f || 'Todos'}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Unidad</th><th>Propietario</th><th>Monto</th><th>Mora</th><th>Total</th>
                <th>Estado</th><th>F. Pago</th><th>Método</th><th>Doc.</th><th></th>
              </tr>
            </thead>
            <tbody>
              {pagosFiltrados.map(p => {
                const mora  = Number(p.interesMora);
                const total = Number(p.monto) + mora;
                return (
                  <tr key={p.id}>
                    <td><strong>{p.unidad?.numero}</strong></td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.unidad?.propietario?.nombre || '—'}
                    </td>
                    <td>{fmt(p.monto)}</td>
                    <td style={{ color: mora > 0 ? 'var(--red-600)' : 'inherit' }}>
                      {mora > 0 ? fmt(mora) : '—'}
                    </td>
                    <td style={{ fontWeight: 600 }}>{fmt(total)}</td>
                    <td>{estadoBadge(p.estado)}</td>
                    <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>
                      {p.fechaPago ? new Date(p.fechaPago).toLocaleDateString('es-PA') : '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>{p.metodo || '—'}</td>
                    <td>
                      {p.comprobante
                        ? <a href={p.comprobante} target="_blank" rel="noopener noreferrer"
                            title="Ver comprobante"
                            style={p.estado !== 'PAGADO' ? { fontWeight: 700, color: 'var(--amber-600)' } : {}}>
                            📎{p.estado !== 'PAGADO' ? ' Revisar' : ''}
                          </a>
                        : <span style={{ color: 'var(--slate-300)' }}>—</span>}
                    </td>
                    <td>
                      <div className="gap-8">
                        {p.estado !== 'PAGADO' && (
                          <button className="btn btn-success btn-sm" onClick={() => { setError(''); setForm(EMPTY_PAGO); setModal(p); }}>
                            Pagar
                          </button>
                        )}
                        {p.estado === 'PAGADO' && (
                          <>
                            <a className="btn btn-ghost btn-sm" href={pdfUrl(`/api/edificios/${edificioId}/cuotas/pagos/${p.id}/recibo.pdf`)} target="_blank" rel="noreferrer">
                              Recibo
                            </a>
                            <button className="btn btn-danger btn-sm" onClick={() => anularPago(p.id)}>Anular</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal registrar pago */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Registrar pago — Unidad {modal.unidad?.numero}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <form onSubmit={registrarPago}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div style={{ background: 'var(--slate-50)', padding: '10px 12px', borderRadius: 6, marginBottom: 14, fontSize: 13 }}>
                  <strong>{modal.unidad?.propietario?.nombre || 'Sin propietario'}</strong>
                  <span style={{ marginLeft: 12, color: 'var(--slate-500)' }}>
                    Monto: {fmt(modal.monto)} + Mora: {fmt(modal.interesMora)} = <strong>{fmt(Number(modal.monto) + Number(modal.interesMora))}</strong>
                  </span>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Método *</label>
                    <select required value={form.metodo} onChange={e => setForm(f => ({ ...f, metodo: e.target.value }))}>
                      {METODOS.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Fecha de pago</label>
                    <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Referencia</label>
                  <input value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))} placeholder="Nro. de transferencia, cheque, etc." />
                </div>
                <div className="form-group">
                  <label>Notas</label>
                  <input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Comprobante de pago</label>
                  <FileUpload
                    value={form.comprobante}
                    onChange={url => setForm(f => ({ ...f, comprobante: url || '' }))}
                    label="Adjuntar comprobante"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Guardando…' : 'Confirmar pago'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
