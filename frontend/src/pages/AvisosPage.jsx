import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import Pagination from '../components/Pagination';

const TIPOS = ['GENERAL', 'URGENTE', 'MANTENIMIENTO', 'CONVOCATORIA'];
const TIPO_BADGE = { GENERAL: 'badge-slate', URGENTE: 'badge-red', MANTENIMIENTO: 'badge-blue', CONVOCATORIA: 'badge-amber' };
const EMPTY = { titulo: '', mensaje: '', tipo: 'GENERAL', adjunto: '', notificar: false };

export default function AvisosPage() {
  const { edificioId } = useParams();
  const [avisos, setAvisos]     = useState({ data: [], total: 0, page: 1, pages: 1, limit: 25, meta: { total: 0, activos: 0, urgentes: 0, convocatorias: 0 } });
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [filtro, setFiltro]         = useState('activos'); // 'activos' | 'todos'
  const [page, setPage]             = useState(1);
  const [uploadingAdj, setUploadingAdj] = useState(false);

  // Modal envío de correo
  const [modalCorreo, setModalCorreo]       = useState(null);  // aviso seleccionado
  const [destinatarios, setDestinatarios]   = useState([]);
  const [excluidos, setExcluidos]           = useState(new Set());
  const [loadingDest, setLoadingDest]       = useState(false);
  const [enviando, setEnviando]             = useState(false);
  const [resultadoEnvio, setResultadoEnvio] = useState(null);

  useEffect(() => { setPage(1); }, [edificioId, filtro]);
  useEffect(() => { cargar(); }, [edificioId, filtro, page]);

  async function cargar() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 25 });
      if (filtro === 'activos') params.set('activo', 'true');
      const { data } = await api.get(`/edificios/${edificioId}/avisos?${params}`);
      setAvisos(data);
    }
    finally { setLoading(false); }
  }

  function abrirNuevo() {
    setEditando(null); setForm(EMPTY); setError(''); setModal(true);
  }

  function abrirEditar(a) {
    setEditando(a);
    setForm({ titulo: a.titulo, mensaje: a.mensaje, tipo: a.tipo, adjunto: a.adjunto || '' });
    setError(''); setModal(true);
  }

  async function subirAdjunto(file) {
    setUploadingAdj(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm(f => ({ ...f, adjunto: data.url }));
    } catch { setError('Error al subir el archivo adjunto'); }
    finally { setUploadingAdj(false); }
  }

  async function guardar(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      if (editando) {
        await api.put(`/edificios/${edificioId}/avisos/${editando.id}`, form);
      } else {
        const { data } = await api.post(`/edificios/${edificioId}/avisos`, form);
        if (data.emailResult) {
          alert(`Aviso publicado y correo enviado a ${data.emailResult.enviados} de ${data.emailResult.total} propietarios.`);
        }
      }
      setModal(false); cargar();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  async function toggleActivo(a) {
    try { await api.put(`/edificios/${edificioId}/avisos/${a.id}`, { activo: !a.activo }); cargar(); }
    catch (err) { alert(err.response?.data?.error || 'Error'); }
  }

  async function eliminar(a) {
    if (!confirm(`¿Eliminar aviso "${a.titulo}"?`)) return;
    try { await api.delete(`/edificios/${edificioId}/avisos/${a.id}`); cargar(); }
    catch (err) { alert(err.response?.data?.error || 'Error'); }
  }

  async function abrirModalCorreo(aviso) {
    setModalCorreo(aviso);
    setExcluidos(new Set());
    setResultadoEnvio(null);
    setLoadingDest(true);
    try {
      const { data } = await api.get(`/edificios/${edificioId}/avisos/destinatarios`);
      setDestinatarios(data);
    } catch { setDestinatarios([]); }
    finally { setLoadingDest(false); }
  }

  function toggleExcluir(id) {
    setExcluidos(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  async function enviarCorreos() {
    setEnviando(true);
    setResultadoEnvio(null);
    try {
      const { data } = await api.post(
        `/edificios/${edificioId}/avisos/${modalCorreo.id}/enviar-correo`,
        { excluirIds: [...excluidos] },
      );
      setResultadoEnvio({ ok: true, ...data });
      setAvisos(prev => ({
        ...prev,
        data: prev.data.map(a => a.id === data.aviso.id ? { ...a, ...data.aviso } : a),
      }));
    } catch (err) {
      setResultadoEnvio({ ok: false, mensaje: err.response?.data?.error || 'Error al enviar' });
    } finally { setEnviando(false); }
  }

  const meta    = avisos.meta || {};
  const activos = meta.activos || 0;

  if (loading) return <div className="loading">Cargando…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Tablero de Avisos</h1>
        <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo aviso</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Total avisos</div><div className="stat-value">{meta.total || 0}</div></div>
        <div className="stat-card"><div className="stat-label">Activos</div><div className="stat-value stat-green">{activos}</div></div>
        <div className="stat-card"><div className="stat-label">Urgentes</div><div className="stat-value stat-red">{meta.urgentes || 0}</div></div>
        <div className="stat-card"><div className="stat-label">Convocatorias</div><div className="stat-value stat-amber">{meta.convocatorias || 0}</div></div>
      </div>

      <div className="gap-8" style={{ marginBottom: 14 }}>
        <button className={`btn btn-sm ${filtro === 'activos' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFiltro('activos')}>
          Activos ({activos})
        </button>
        <button className={`btn btn-sm ${filtro === 'todos' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFiltro('todos')}>
          Todos ({meta.total || 0})
        </button>
      </div>

      {avisos.data.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 40 }}>📢</div>
          <p>No hay avisos {filtro === 'activos' ? 'activos' : 'registrados'} aún.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {avisos.data.map(a => (
            <div
              key={a.id}
              className="card"
              style={{
                opacity:    a.activo ? 1 : 0.6,
                borderLeft: a.tipo === 'URGENTE' ? '3px solid var(--red-600)' :
                            a.tipo === 'CONVOCATORIA' ? '3px solid var(--amber-600)' :
                            a.tipo === 'MANTENIMIENTO' ? '3px solid var(--blue-600)' : undefined,
              }}
            >
              <div className="card-header" style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <span className={`badge ${TIPO_BADGE[a.tipo]}`}>{a.tipo}</span>
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</span>
                  {!a.activo && <span className="badge badge-slate">Inactivo</span>}
                </div>
                <div className="gap-8" style={{ flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>
                    {new Date(a.creadoEn).toLocaleDateString('es-PA')}
                  </span>
                  {a.emailEnviado && (
                    <span className="badge badge-green" style={{ fontSize: 10 }} title={`Enviado a ${a.emailEnviadoCount} propietarios`}>
                      ✉ {a.emailEnviadoCount}
                    </span>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => abrirModalCorreo(a)} title="Enviar por correo a propietarios">
                    📧 Correo
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(a)}>Editar</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleActivo(a)}>
                    {a.activo ? 'Archivar' : 'Activar'}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => eliminar(a)}>✕</button>
                </div>
              </div>
              <div style={{ padding: '10px 16px 14px', fontSize: 13, color: 'var(--slate-700)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {a.mensaje}
              </div>
              {a.adjunto && (
                <div style={{ padding: '0 16px 12px' }}>
                  <a href={a.adjunto} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: 'var(--blue-600)' }}>
                    📎 Ver adjunto
                  </a>
                </div>
              )}
            </div>
          ))}
          <Pagination
            page={avisos.page} pages={avisos.pages}
            total={avisos.total} limit={avisos.limit}
            onChange={p => setPage(p)}
          />
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editando ? 'Editar aviso' : 'Nuevo aviso'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={guardar}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>Título *</label>
                    <input required value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Tipo</label>
                    <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                      {TIPOS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Mensaje *</label>
                  <textarea
                    rows={5} required
                    style={{ resize: 'vertical' }}
                    value={form.mensaje}
                    onChange={e => setForm(f => ({ ...f, mensaje: e.target.value }))}
                    placeholder="Contenido del aviso para los residentes..."
                  />
                </div>
                <div className="form-group">
                  <label>Adjunto (PDF o imagen — se enviará con el correo)</label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input
                      type="file" accept=".pdf,image/*"
                      style={{ flex: 1, fontSize: 13 }}
                      disabled={uploadingAdj}
                      onChange={e => e.target.files[0] && subirAdjunto(e.target.files[0])}
                    />
                    {uploadingAdj && <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>Subiendo…</span>}
                  </div>
                  {form.adjunto && (
                    <div style={{ fontSize: 12, marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <a href={form.adjunto} target="_blank" rel="noreferrer" style={{ color: 'var(--blue-600)' }}>
                        📎 Ver adjunto actual
                      </a>
                      <button type="button" className="btn btn-ghost btn-sm"
                        onClick={() => setForm(f => ({ ...f, adjunto: '' }))}
                        style={{ fontSize: 11, padding: '2px 8px' }}>
                        Quitar
                      </button>
                    </div>
                  )}
                </div>
                {!editando && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 2px' }}>
                    <input type="checkbox" id="notificar" checked={form.notificar}
                      onChange={e => setForm(f => ({ ...f, notificar: e.target.checked }))} />
                    <label htmlFor="notificar" style={{ fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
                      Enviar correo a todos los propietarios al publicar
                    </label>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving || uploadingAdj}>
                  {saving ? 'Publicando…' : 'Publicar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Modal envío de correo ─────────────────────────────────────────── */}
      {modalCorreo && (
        <div className="modal-backdrop" onClick={() => setModalCorreo(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Enviar por correo</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalCorreo(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Resumen del aviso */}
              <div style={{ background: 'var(--slate-50)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--slate-200)' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{modalCorreo.titulo}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                  <span className={`badge ${TIPO_BADGE[modalCorreo.tipo]}`}>{modalCorreo.tipo}</span>
                  {modalCorreo.adjunto
                    ? <span style={{ fontSize: 12, color: 'var(--blue-600)' }}>
                        📎 <a href={modalCorreo.adjunto} target="_blank" rel="noreferrer">Adjunto incluido</a>
                      </span>
                    : <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>Sin adjunto</span>
                  }
                </div>
              </div>

              {/* Resultado del envío */}
              {resultadoEnvio && (
                <div className={`alert ${resultadoEnvio.ok ? 'alert-success' : 'alert-error'}`}>
                  {resultadoEnvio.ok
                    ? <>✓ {resultadoEnvio.message}{resultadoEnvio.errores?.length > 0 && ` · ${resultadoEnvio.errores.length} error(es)`}</>
                    : resultadoEnvio.mensaje}
                </div>
              )}

              {/* Lista de destinatarios */}
              {loadingDest ? (
                <div style={{ textAlign: 'center', color: 'var(--slate-400)', padding: 16 }}>Cargando destinatarios…</div>
              ) : destinatarios.length === 0 ? (
                <div className="alert alert-error">No hay propietarios con email registrado en este edificio.</div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      Destinatarios — {destinatarios.length - excluidos.size} de {destinatarios.length} seleccionados
                    </span>
                    <div className="gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => setExcluidos(new Set())}>Todos</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setExcluidos(new Set(destinatarios.map(d => d.id)))}>Ninguno</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflowY: 'auto' }}>
                    {destinatarios.map(d => {
                      const checked = !excluidos.has(d.id);
                      return (
                        <label key={d.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
                          borderRadius: 6, cursor: 'pointer',
                          background: checked ? '#f0fdf4' : 'var(--slate-50)',
                          border: `1px solid ${checked ? '#bbf7d0' : 'var(--slate-200)'}`,
                        }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleExcluir(d.id)} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{d.nombre}</div>
                            <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>{d.email} · Unidad {d.unidad?.numero}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalCorreo(null)}>Cerrar</button>
              <button
                className="btn btn-primary"
                onClick={enviarCorreos}
                disabled={enviando || loadingDest || (destinatarios.length - excluidos.size) === 0 || !!resultadoEnvio?.ok}
              >
                {enviando
                  ? 'Enviando…'
                  : `Enviar a ${destinatarios.length - excluidos.size} propietario(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
