import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import Pagination from '../components/Pagination';

const ESTADOS     = ['PENDIENTE', 'APROBADA', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA'];
const PRIORIDADES = ['URGENTE', 'NORMAL', 'BAJA'];
const EMPTY = { descripcion: '', proveedorId: '', monto: '', prioridad: 'NORMAL', fechaEstimada: '', notas: '', comprobante: '' };
const SIGUIENTE_ESTADO = { PENDIENTE: 'APROBADA', APROBADA: 'EN_PROCESO', EN_PROCESO: 'COMPLETADA' };

const ESTADO_CLASS = { PENDIENTE: 'badge-amber', APROBADA: 'badge-blue', EN_PROCESO: 'badge-blue', COMPLETADA: 'badge-green', CANCELADA: 'badge-slate' };
const PRIORIDAD_CLASS = { URGENTE: 'badge-red', NORMAL: 'badge-slate', BAJA: 'badge-slate' };

function fmt(n) { return n ? `$${Number(n).toLocaleString('es-PA', { minimumFractionDigits: 2 })}` : '—'; }
function fmtFecha(d) { return d ? new Date(d).toLocaleDateString('es-PA') : '—'; }
function fmtDatetime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-PA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function EstadoBadge({ estado }) {
  return <span className={`badge ${ESTADO_CLASS[estado] || 'badge-slate'}`}>{estado.replace('_', ' ')}</span>;
}

export default function OrdenesPage() {
  const { edificioId } = useParams();

  const [ordenes,      setOrdenes]      = useState({ data: [], total: 0, page: 1, pages: 1, limit: 20, counts: {}, montoTotal: 0 });
  const [proveedores,  setProveedores]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [page,         setPage]         = useState(1);
  const [filtroEstado, setFiltroEstado] = useState('');

  // Modal formulario (crear/editar)
  const [modal,    setModal]    = useState(false);
  const [editando, setEditando] = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);
  const [formError, setFormError] = useState('');

  // Modal detalle
  const [detalle,         setDetalle]         = useState(null);   // orden completa
  const [loadingDetalle,  setLoadingDetalle]   = useState(false);

  // Modal avanzar estado
  const [modalEstado,   setModalEstado]   = useState(null);  // { orden, siguiente }
  const [notaEstado,    setNotaEstado]    = useState('');
  const [savingEstado,  setSavingEstado]  = useState(false);

  // Adjuntos en detalle
  const [subiendoAdj,  setSubiendoAdj]  = useState(false);
  const [notificando,  setNotificando]  = useState(false);
  const adjRef = useRef(null);

  useEffect(() => { setPage(1); }, [edificioId, filtroEstado]);
  useEffect(() => { cargar(); }, [edificioId, filtroEstado, page]);

  async function cargar() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filtroEstado) params.set('estado', filtroEstado);
      const [o, p] = await Promise.all([
        api.get(`/edificios/${edificioId}/ordenes?${params}`),
        api.get(`/edificios/${edificioId}/proveedores`),
      ]);
      setOrdenes(o.data);
      setProveedores(p.data.filter(p => p.activo));
    } finally { setLoading(false); }
  }

  async function abrirDetalle(o) {
    setLoadingDetalle(true);
    setDetalle(o);
    try {
      const { data } = await api.get(`/edificios/${edificioId}/ordenes/${o.id}`);
      setDetalle(data);
    } finally { setLoadingDetalle(false); }
  }

  function abrirNueva() { setEditando(null); setForm(EMPTY); setFormError(''); setModal(true); }

  function abrirEditar(o) {
    setEditando(o);
    setForm({
      descripcion:   o.descripcion,
      proveedorId:   o.proveedorId  || '',
      monto:         o.monto        || '',
      prioridad:     o.prioridad,
      fechaEstimada: o.fechaEstimada ? o.fechaEstimada.slice(0, 10) : '',
      notas:         o.notas        || '',
      comprobante:   o.comprobante  || '',
    });
    setFormError(''); setModal(true);
  }

  async function guardar(e) {
    e.preventDefault(); setFormError(''); setSaving(true);
    try {
      const payload = {
        descripcion:   form.descripcion,
        proveedorId:   form.proveedorId  || null,
        monto:         form.monto        || null,
        prioridad:     form.prioridad,
        fechaEstimada: form.fechaEstimada || null,
        notas:         form.notas        || null,
        comprobante:   form.comprobante  || null,
      };
      if (editando) {
        await api.put(`/edificios/${edificioId}/ordenes/${editando.id}`, payload);
      } else {
        await api.post(`/edificios/${edificioId}/ordenes`, payload);
      }
      setModal(false); cargar();
      if (detalle?.id === editando?.id) abrirDetalle({ id: editando.id });
    } catch (err) { setFormError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  function pedirAvance(o) {
    const siguiente = SIGUIENTE_ESTADO[o.estado];
    if (!siguiente) return;
    setModalEstado({ orden: o, siguiente });
    setNotaEstado('');
  }

  async function confirmarAvance() {
    if (!modalEstado) return;
    setSavingEstado(true);
    try {
      await api.put(`/edificios/${edificioId}/ordenes/${modalEstado.orden.id}`, {
        estado: modalEstado.siguiente,
        notaLog: notaEstado || null,
      });
      setModalEstado(null);
      cargar();
      if (detalle?.id === modalEstado.orden.id) abrirDetalle({ id: modalEstado.orden.id });
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
    finally { setSavingEstado(false); }
  }

  async function cancelarOrden(o) {
    if (!confirm('¿Cancelar esta orden?')) return;
    try {
      await api.put(`/edificios/${edificioId}/ordenes/${o.id}`, { estado: 'CANCELADA', notaLog: null });
      cargar();
      if (detalle?.id === o.id) abrirDetalle({ id: o.id });
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  }

  async function eliminar(o) {
    if (!confirm('¿Eliminar esta orden?')) return;
    try {
      await api.delete(`/edificios/${edificioId}/ordenes/${o.id}`);
      cargar();
      if (detalle?.id === o.id) setDetalle(null);
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  }

  async function subirAdjunto(file) {
    if (!detalle || !file) return;
    setSubiendoAdj(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      await api.post(`/edificios/${edificioId}/ordenes/${detalle.id}/adjuntos`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      abrirDetalle({ id: detalle.id });
    } catch (err) { alert(err.response?.data?.error || 'Error al subir'); }
    finally { setSubiendoAdj(false); }
  }

  async function eliminarAdjunto(adjuntoId) {
    if (!confirm('¿Eliminar este adjunto?')) return;
    try {
      await api.delete(`/edificios/${edificioId}/ordenes/${detalle.id}/adjuntos/${adjuntoId}`);
      abrirDetalle({ id: detalle.id });
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  }

  async function notificarProveedor() {
    setNotificando(true);
    try {
      const { data } = await api.post(`/edificios/${edificioId}/ordenes/${detalle.id}/notificar-proveedor`);
      alert(data.mensaje);
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
    finally { setNotificando(false); }
  }

  const counts     = ordenes.counts     || {};
  const totalMonto = ordenes.montoTotal || 0;

  if (loading) return <div className="loading">Cargando…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Órdenes de Trabajo</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href={`/api/edificios/${edificioId}/ordenes.xlsx${filtroEstado ? `?estado=${filtroEstado}` : ''}`}
            className="btn btn-ghost btn-sm" download>
            ⬇ Excel
          </a>
          <button className="btn btn-primary" onClick={abrirNueva}>+ Nueva orden</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="stats-grid">
        {ESTADOS.map(e => (
          <div key={e} className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setFiltroEstado(filtroEstado === e ? '' : e)}>
            <div className="stat-label">{e.replace('_', ' ')}</div>
            <div className={`stat-value ${e === 'COMPLETADA' ? 'stat-green' : e === 'CANCELADA' ? '' : counts[e] > 0 ? 'stat-amber' : ''}`}>
              {counts[e] ?? 0}
            </div>
          </div>
        ))}
        <div className="stat-card">
          <div className="stat-label">Monto total</div>
          <div className="stat-value stat-blue" style={{ fontSize: 16 }}>{fmt(totalMonto)}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="gap-8" style={{ marginBottom: 12 }}>
        <button className={`btn btn-sm ${!filtroEstado ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFiltroEstado('')}>Todas</button>
        {ESTADOS.map(e => (
          <button key={e} className={`btn btn-sm ${filtroEstado === e ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFiltroEstado(filtroEstado === e ? '' : e)}>
            {e.replace('_', ' ')}
          </button>
        ))}
      </div>

      {ordenes.data.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 40 }}>🔧</div>
          <p>{filtroEstado ? `No hay órdenes en estado ${filtroEstado.replace('_', ' ')}.` : 'No hay órdenes de trabajo aún.'}</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Descripción</th><th>Prioridad</th><th>Proveedor</th>
                  <th>Monto</th><th>F. Estimada</th><th>Estado</th><th></th>
                </tr>
              </thead>
              <tbody>
                {ordenes.data.map(o => (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => abrirDetalle(o)}>
                    <td style={{ color: 'var(--slate-400)', fontSize: 12 }}>#{o.id}</td>
                    <td style={{ maxWidth: 220 }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.descripcion}</div>
                      {o.notas && <div style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 2 }}>{o.notas.slice(0, 60)}</div>}
                    </td>
                    <td><span className={`badge ${PRIORIDAD_CLASS[o.prioridad]}`}>{o.prioridad}</span></td>
                    <td style={{ fontSize: 12 }}>
                      {o.proveedor
                        ? <div><div style={{ fontWeight: 500 }}>{o.proveedor.nombre}</div><div style={{ color: 'var(--slate-500)' }}>{o.proveedor.servicio}</div></div>
                        : <span style={{ color: 'var(--slate-400)' }}>Sin asignar</span>}
                    </td>
                    <td style={{ fontWeight: o.monto ? 600 : 400, color: o.monto ? 'inherit' : 'var(--slate-400)' }}>{fmt(o.monto)}</td>
                    <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>{fmtFecha(o.fechaEstimada)}</td>
                    <td><EstadoBadge estado={o.estado} /></td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="gap-8">
                        {SIGUIENTE_ESTADO[o.estado] && (
                          <button className="btn btn-success btn-sm" onClick={() => pedirAvance(o)}>
                            → {SIGUIENTE_ESTADO[o.estado].replace('_', ' ')}
                          </button>
                        )}
                        {!['COMPLETADA', 'CANCELADA'].includes(o.estado) && (
                          <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(o)}>Editar</button>
                        )}
                        {['PENDIENTE', 'APROBADA'].includes(o.estado) && (
                          <button className="btn btn-danger btn-sm" onClick={() => cancelarOrden(o)}>Cancelar</button>
                        )}
                        {['PENDIENTE', 'CANCELADA'].includes(o.estado) && (
                          <button className="btn btn-danger btn-sm" onClick={() => eliminar(o)}>✕</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={ordenes.page} pages={ordenes.pages} total={ordenes.total} limit={ordenes.limit} onChange={p => setPage(p)} />
        </div>
      )}

      {/* ── Modal formulario crear/editar ── */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editando ? 'Editar orden' : 'Nueva orden de trabajo'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={guardar}>
              <div className="modal-body">
                {formError && <div className="alert alert-error">{formError}</div>}
                <div className="form-group">
                  <label>Descripción *</label>
                  <textarea rows={2} required value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} style={{ resize: 'vertical' }} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Prioridad</label>
                    <select value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}>
                      {PRIORIDADES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Monto estimado ($)</label>
                    <input type="number" step="0.01" min="0" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Proveedor</label>
                    <select value={form.proveedorId} onChange={e => setForm(f => ({ ...f, proveedorId: e.target.value }))}>
                      <option value="">-- Sin asignar --</option>
                      {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.servicio})</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Fecha estimada</label>
                    <input type="date" value={form.fechaEstimada} onChange={e => setForm(f => ({ ...f, fechaEstimada: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Notas</label>
                  <input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal avanzar estado ── */}
      {modalEstado && (
        <div className="modal-backdrop" onClick={() => setModalEstado(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cambiar estado</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalEstado(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, marginBottom: 16 }}>
                Orden <strong>#{modalEstado.orden.id}</strong> — {modalEstado.orden.descripcion.slice(0, 60)}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, fontSize: 14 }}>
                <EstadoBadge estado={modalEstado.orden.estado} />
                <span style={{ color: 'var(--slate-400)' }}>→</span>
                <EstadoBadge estado={modalEstado.siguiente} />
              </div>
              <div className="form-group">
                <label>Nota <span style={{ fontWeight: 400, color: 'var(--slate-400)' }}>(opcional)</span></label>
                <input
                  autoFocus
                  placeholder="Ej: Se aprobó en reunión del 15/05, presupuesto confirmado…"
                  value={notaEstado}
                  onChange={e => setNotaEstado(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalEstado(null)}>Cancelar</button>
              <button className="btn btn-success" onClick={confirmarAvance} disabled={savingEstado}>
                {savingEstado ? 'Guardando…' : `Confirmar → ${modalEstado.siguiente.replace('_', ' ')}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal detalle ── */}
      {detalle && (
        <div className="modal-backdrop" onClick={() => setDetalle(null)}>
          <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Orden #{detalle.id}</h2>
              <div className="gap-8">
                {!['COMPLETADA', 'CANCELADA'].includes(detalle.estado) && (
                  <button className="btn btn-ghost btn-sm" onClick={() => { setDetalle(null); abrirEditar(detalle); }}>Editar</button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => setDetalle(null)}>✕</button>
              </div>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {loadingDetalle ? (
                <p style={{ color: 'var(--slate-400)', fontSize: 13 }}>Cargando…</p>
              ) : (
                <>
                  {/* Info principal */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13, marginBottom: 20 }}>
                    <div><span style={{ color: 'var(--slate-500)' }}>Estado</span><br /><EstadoBadge estado={detalle.estado} /></div>
                    <div><span style={{ color: 'var(--slate-500)' }}>Prioridad</span><br /><span className={`badge ${PRIORIDAD_CLASS[detalle.prioridad]}`}>{detalle.prioridad}</span></div>
                    <div><span style={{ color: 'var(--slate-500)' }}>Monto</span><br /><strong>{fmt(detalle.monto)}</strong></div>
                    <div><span style={{ color: 'var(--slate-500)' }}>F. Estimada</span><br />{fmtFecha(detalle.fechaEstimada)}</div>
                    {detalle.fechaCierre && <div><span style={{ color: 'var(--slate-500)' }}>F. Cierre</span><br />{fmtFecha(detalle.fechaCierre)}</div>}
                    <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--slate-500)' }}>Descripción</span><br />{detalle.descripcion}</div>
                    {detalle.notas && <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--slate-500)' }}>Notas</span><br />{detalle.notas}</div>}
                  </div>

                  {/* Proveedor */}
                  {detalle.proveedor && (
                    <div style={{ background: 'var(--slate-50)', borderRadius: 8, padding: '12px 14px', marginBottom: 20, fontSize: 13 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>Proveedor</div>
                      <div><strong>{detalle.proveedor.nombre}</strong> · {detalle.proveedor.servicio}</div>
                      {detalle.proveedor.email && <div style={{ color: 'var(--slate-500)' }}>{detalle.proveedor.email}</div>}
                      {detalle.proveedor.email && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ marginTop: 8 }}
                          onClick={notificarProveedor}
                          disabled={notificando}
                        >
                          {notificando ? 'Enviando…' : '📧 Notificar al proveedor'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Historial */}
                  {detalle.logs?.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)', letterSpacing: '.05em', marginBottom: 10 }}>
                        Historial de estados
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {detalle.logs.map((log, i) => (
                          <div key={log.id} style={{ display: 'flex', gap: 12, paddingBottom: 12 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', background: i === detalle.logs.length - 1 ? 'var(--blue-600)' : 'var(--slate-300)', marginTop: 3, flexShrink: 0 }} />
                              {i < detalle.logs.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--slate-200)', marginTop: 2 }} />}
                            </div>
                            <div style={{ flex: 1, paddingBottom: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <EstadoBadge estado={log.estado} />
                                <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>{fmtDatetime(log.creadoEn)}</span>
                              </div>
                              {log.nota && <div style={{ fontSize: 12, color: 'var(--slate-600)', marginTop: 3 }}>{log.nota}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Adjuntos */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)', letterSpacing: '.05em', marginBottom: 10 }}>
                      Adjuntos ({detalle.adjuntos?.length ?? 0})
                    </div>
                    {detalle.adjuntos?.map(a => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--slate-100)', fontSize: 13 }}>
                        <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue-600)' }}>
                          📎 {a.nombre}
                        </a>
                        <button className="btn btn-danger btn-sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => eliminarAdjunto(a.id)}>✕</button>
                      </div>
                    ))}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      style={{ display: 'none' }}
                      ref={adjRef}
                      onChange={e => e.target.files[0] && subirAdjunto(e.target.files[0])}
                    />
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ marginTop: 10 }}
                      onClick={() => adjRef.current?.click()}
                      disabled={subiendoAdj}
                    >
                      {subiendoAdj ? 'Subiendo…' : '+ Agregar adjunto'}
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              {SIGUIENTE_ESTADO[detalle.estado] && (
                <button className="btn btn-success" onClick={() => { setDetalle(null); pedirAvance(detalle); }}>
                  → {SIGUIENTE_ESTADO[detalle.estado].replace('_', ' ')}
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => setDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
