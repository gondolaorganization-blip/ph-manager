import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { pdfUrl } from '../hooks/usePdfUrl';

const MESES_L = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const EMPTY = { mes: '', anio: new Date().getFullYear(), monto: '', fechaVence: '', usarCoeficiente: true };

function fmt(n) { return `$${Number(n).toLocaleString('es-PA', { minimumFractionDigits: 2 })}`; }

export default function CuotasPage() {
  const { edificioId } = useParams();
  const [cuotas, setCuotas]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [cargandoSig, setCargandoSig] = useState(false);

  useEffect(() => { cargar(); }, [edificioId]);

  async function cargar() {
    setLoading(true);
    try { const { data } = await api.get(`/edificios/${edificioId}/cuotas`); setCuotas(data); }
    finally { setLoading(false); }
  }

  async function abrirNueva() {
    setError(''); setSuccess(''); setForm(EMPTY); setModal(true);
  }

  async function generarSiguiente() {
    setCargandoSig(true);
    try {
      const { data } = await api.get(`/edificios/${edificioId}/cuotas/siguiente`);
      if (data.yaExiste) {
        alert(`Ya existe una cuota para ${MESES_L[data.mes]} ${data.anio}.`);
        return;
      }
      setError(''); setSuccess('');
      setForm({ mes: data.mes, anio: data.anio, monto: data.monto || '', fechaVence: data.fechaVence, usarCoeficiente: true });
      setModal(true);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al obtener sugerencia');
    } finally { setCargandoSig(false); }
  }

  async function crearCuota(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const { data: r } = await api.post(`/edificios/${edificioId}/cuotas`, {
        mes: parseInt(form.mes), anio: parseInt(form.anio),
        monto: parseFloat(form.monto), fechaVence: form.fechaVence,
        usarCoeficiente: form.usarCoeficiente,
      });
      setModal(false);
      setSuccess(`Cuota de ${MESES_L[r.mes]} ${r.anio} creada — ${r.pagosGenerados} pagos generados.`);
      cargar();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  async function eliminarCuota(id) {
    if (!confirm('¿Eliminar esta cuota? Se borrarán todos los pagos pendientes.')) return;
    try { await api.delete(`/edificios/${edificioId}/cuotas/${id}`); cargar(); }
    catch (err) { alert(err.response?.data?.error || 'Error al eliminar'); }
  }

  if (loading) return <div className="loading">Cargando…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Cuotas de Mantenimiento</h1>
        <div className="gap-8">
          <button className="btn btn-ghost" onClick={generarSiguiente} disabled={cargandoSig}>
            {cargandoSig ? 'Cargando…' : '⚡ Generar mes siguiente'}
          </button>
          <button className="btn btn-primary" onClick={abrirNueva}>+ Nueva cuota</button>
        </div>
      </div>

      {success && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          ✓ {success}
        </div>
      )}

      {cuotas.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 40 }}>💰</div>
          <p>No hay cuotas registradas. Usa <strong>⚡ Generar mes siguiente</strong> para crear la primera.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Período</th><th>Monto</th><th>Vence</th>
                  <th>Pagados</th><th>Pendientes</th><th>Vencidos</th>
                  <th>Recaudado</th><th>Por cobrar</th><th></th>
                </tr>
              </thead>
              <tbody>
                {cuotas.map(c => (
                  <tr key={c.id}>
                    <td><strong>{MESES_L[c.mes]} {c.anio}</strong></td>
                    <td>{fmt(c.monto)}</td>
                    <td>{new Date(c.fechaVence).toLocaleDateString('es-PA')}</td>
                    <td><span className="badge badge-green">{c.stats.pagados}</span></td>
                    <td><span className="badge badge-amber">{c.stats.pendientes}</span></td>
                    <td><span className="badge badge-red">{c.stats.vencidos}</span></td>
                    <td style={{ color: 'var(--green-600)', fontWeight: 600 }}>{fmt(c.stats.recaudado)}</td>
                    <td style={{ color: 'var(--amber-600)' }}>{fmt(c.stats.porCobrar)}</td>
                    <td>
                      <div className="gap-8">
                        <Link className="btn btn-ghost btn-sm" to={`/edificios/${edificioId}/cuotas/${c.id}/pagos`}>
                          Ver pagos
                        </Link>
                        <a className="btn btn-ghost btn-sm" href={pdfUrl(`/api/edificios/${edificioId}/cuotas/${c.id}/reporte.pdf`)} target="_blank" rel="noreferrer">
                          PDF
                        </a>
                        {c.stats.pagados === 0 && (
                          <button className="btn btn-danger btn-sm" onClick={() => eliminarCuota(c.id)}>✕</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nueva cuota</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={crearCuota}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-row">
                  <div className="form-group">
                    <label>Mes *</label>
                    <select required value={form.mes} onChange={e => setForm(f => ({ ...f, mes: e.target.value }))}>
                      <option value="">-- Seleccionar --</option>
                      {MESES_L.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Año *</label>
                    <input type="number" required value={form.anio} onChange={e => setForm(f => ({ ...f, anio: e.target.value }))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Monto base ($) *</label>
                    <input type="number" step="0.01" min="0.01" required value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Fecha de vencimiento *</label>
                    <input type="date" required value={form.fechaVence} onChange={e => setForm(f => ({ ...f, fechaVence: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.usarCoeficiente} onChange={e => setForm(f => ({ ...f, usarCoeficiente: e.target.checked }))} style={{ width: 'auto' }} />
                    Distribuir por coeficiente de participación
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Generando…' : 'Crear cuota'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
