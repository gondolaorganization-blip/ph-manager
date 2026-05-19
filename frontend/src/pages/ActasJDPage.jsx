import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import FileUpload from '../components/FileUpload';

// ── Constantes ────────────────────────────────────────────────────────────────
const CARGOS   = ['PRESIDENTE', 'VICEPRESIDENTE', 'SECRETARIO', 'TESORERO', 'VOCAL', 'DIRECTOR'];
const ESTADOS_DIR = ['PRESENTE', 'AUSENTE', 'JUSTIFICADO'];
const RESULTADOS_PUNTO = ['APROBADO', 'NEGADO', 'INFORMATIVO', 'PENDIENTE'];

const ESTADO_DIR_CLASS = { PRESENTE: 'badge-green', AUSENTE: 'badge-slate', JUSTIFICADO: 'badge-amber' };
const RESULTADO_PUNTO_CLASS = { APROBADO: 'badge-green', NEGADO: 'badge-red', INFORMATIVO: 'badge-blue', PENDIENTE: 'badge-amber' };
const CICLO_ESTADO_DIR = { PRESENTE: 'AUSENTE', AUSENTE: 'JUSTIFICADO', JUSTIFICADO: 'PRESENTE' };

const EMPTY_ACTA = {
  fecha: new Date().toISOString().slice(0, 10),
  horaInicio: '', horaFin: '', lugar: '',
  presidente: '', presidenteCedula: '',
  secretario: '', secretarioCedula: '',
  acuerdos: '', documento: '',
};

const EMPTY_DIRECTOR = { nombre: '', cedula: '', cargo: 'DIRECTOR', estado: 'PRESENTE' };
const EMPTY_PUNTO    = { descripcion: '', resultado: 'INFORMATIVO', notas: '' };

function fmtFecha(f) {
  return new Date(f).toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ActasJDPage() {
  const { edificioId } = useParams();
  const [actas, setActas]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState(null);  // actaId inline expand

  // Modales
  const [modalForm, setModalForm]         = useState(false);
  const [modalDirectores, setModalDirectores] = useState(null);  // acta
  const [modalPuntos, setModalPuntos]     = useState(null);      // acta

  // Form acta
  const [editando, setEditando] = useState(null);
  const [form, setForm]         = useState(EMPTY_ACTA);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  // Directores local
  const [directores, setDirectores]         = useState([]);
  const [savingDir, setSavingDir]           = useState(false);
  const [editDir, setEditDir]               = useState(null);  // índice o null
  const [formDir, setFormDir]               = useState(EMPTY_DIRECTOR);

  // Puntos local
  const [puntos, setPuntos]             = useState([]);
  const [savingPuntos, setSavingPuntos] = useState(false);
  const [editPunto, setEditPunto]       = useState(null);
  const [formPunto, setFormPunto]       = useState(EMPTY_PUNTO);

  useEffect(() => { cargar(); }, [edificioId]);

  async function descargarDocx(a) {
    try {
      const { data } = await api.get(`/edificios/${edificioId}/actas-jd/${a.id}/docx`, { responseType: 'blob' });
      const url  = URL.createObjectURL(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `ActaJD_${a.numero ?? 'SN'}_${a.anio ?? ''}.docx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch { alert('Error al generar el documento Word'); }
  }

  async function cargar() {
    setLoading(true);
    try {
      const { data } = await api.get(`/edificios/${edificioId}/actas-jd`);
      setActas(data);
    } finally { setLoading(false); }
  }

  // ── Acta CRUD ──────────────────────────────────────────────────────────────
  function abrirNueva() {
    setEditando(null); setForm(EMPTY_ACTA); setError(''); setModalForm(true);
  }

  function abrirEditar(a) {
    setEditando(a);
    setForm({
      fecha:            a.fecha.slice(0, 10),
      horaInicio:       a.horaInicio       || '',
      horaFin:          a.horaFin          || '',
      lugar:            a.lugar            || '',
      presidente:       a.presidente       || '',
      presidenteCedula: a.presidenteCedula || '',
      secretario:       a.secretario       || '',
      secretarioCedula: a.secretarioCedula || '',
      acuerdos:         a.acuerdos         || '',
      documento:        a.documento        || '',
    });
    setError(''); setModalForm(true);
  }

  async function guardarActa(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const payload = { ...form };
      ['horaInicio', 'horaFin', 'lugar', 'presidente', 'presidenteCedula', 'secretario', 'secretarioCedula', 'acuerdos'].forEach(k => {
        if (!payload[k]) payload[k] = null;
      });
      payload.documento = payload.documento || null;

      if (editando) {
        await api.put(`/edificios/${edificioId}/actas-jd/${editando.id}`, payload);
      } else {
        await api.post(`/edificios/${edificioId}/actas-jd`, payload);
      }
      setModalForm(false); cargar();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  async function eliminarActa(a) {
    if (!confirm(`¿Eliminar Acta JD N°${a.numero ?? 'S/N'}${a.anio ? `/${a.anio}` : ''} del ${fmtFecha(a.fecha)}?`)) return;
    try { await api.delete(`/edificios/${edificioId}/actas-jd/${a.id}`); cargar(); }
    catch (err) { alert(err.response?.data?.error || 'Error'); }
  }

  // ── Directores ────────────────────────────────────────────────────────────
  function abrirDirectores(acta) {
    setDirectores(acta.directores.map(d => ({ ...d })));
    setEditDir(null); setFormDir(EMPTY_DIRECTOR);
    setModalDirectores(acta);
  }

  function agregarDirector() {
    if (!formDir.nombre.trim()) return;
    if (editDir !== null) {
      const arr = [...directores]; arr[editDir] = { ...formDir }; setDirectores(arr);
    } else {
      setDirectores(prev => [...prev, { ...formDir }]);
    }
    setEditDir(null); setFormDir(EMPTY_DIRECTOR);
  }

  function iniciarEditDir(idx) {
    setEditDir(idx);
    setFormDir({ ...directores[idx], cedula: directores[idx].cedula || '' });
  }

  function eliminarDirector(idx) {
    setDirectores(prev => prev.filter((_, i) => i !== idx));
  }

  function toggleEstadoDir(idx) {
    setDirectores(prev => prev.map((d, i) => i === idx ? { ...d, estado: CICLO_ESTADO_DIR[d.estado] } : d));
  }

  async function guardarDirectores() {
    setSavingDir(true);
    try {
      const payload = directores.map(d => ({
        nombre: d.nombre,
        cedula: d.cedula || null,
        cargo:  d.cargo  || 'DIRECTOR',
        estado: d.estado || 'PRESENTE',
      }));
      const { data } = await api.put(`/edificios/${edificioId}/actas-jd/${modalDirectores.id}/directores`, { directores: payload });
      setActas(prev => prev.map(a => a.id === data.id ? data : a));
      setModalDirectores(data);
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
    finally { setSavingDir(false); }
  }

  // ── Puntos ────────────────────────────────────────────────────────────────
  function abrirPuntos(acta) {
    setPuntos(acta.puntos.map(p => ({ ...p })));
    setEditPunto(null); setFormPunto(EMPTY_PUNTO);
    setModalPuntos(acta);
  }

  function agregarPunto() {
    if (!formPunto.descripcion.trim()) return;
    if (editPunto !== null) {
      const arr = [...puntos]; arr[editPunto] = { ...formPunto }; setPuntos(arr);
    } else {
      setPuntos(prev => [...prev, { ...formPunto }]);
    }
    setEditPunto(null); setFormPunto(EMPTY_PUNTO);
  }

  function iniciarEditPunto(idx) {
    setEditPunto(idx);
    setFormPunto({ ...puntos[idx], notas: puntos[idx].notas || '' });
  }

  function eliminarPunto(idx) {
    setPuntos(prev => prev.filter((_, i) => i !== idx));
  }

  async function guardarPuntos() {
    setSavingPuntos(true);
    try {
      const payload = puntos.map(p => ({
        descripcion: p.descripcion,
        resultado:   p.resultado || 'INFORMATIVO',
        notas:       p.notas || null,
      }));
      const { data } = await api.put(`/edificios/${edificioId}/actas-jd/${modalPuntos.id}/puntos`, { puntos: payload });
      setActas(prev => prev.map(a => a.id === data.id ? data : a));
      setModalPuntos(data);
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
    finally { setSavingPuntos(false); }
  }

  // ── Quórum local (en modal directores) ────────────────────────────────────
  function quorumLocalDir() {
    if (!directores.length) return { pct: 0, presentes: 0, total: 0 };
    const presentes = directores.filter(d => d.estado === 'PRESENTE').length;
    const pct = +(presentes / directores.length * 100).toFixed(1);
    return { pct, presentes, total: directores.length };
  }

  if (loading) return <div className="loading">Cargando…</div>;

  const quorumProm = actas.length
    ? (actas.reduce((s, a) => s + Number(a.quorum), 0) / actas.length).toFixed(1)
    : '—';

  return (
    <div className="page">
      <div className="page-header">
        <h1>Actas de Junta Directiva</h1>
        <button className="btn btn-primary" onClick={abrirNueva}>+ Nueva acta JD</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Total actas</div><div className="stat-value">{actas.length}</div></div>
        <div className="stat-card"><div className="stat-label">Quórum promedio</div><div className="stat-value stat-green">{quorumProm}{actas.length ? '%' : ''}</div></div>
        <div className="stat-card">
          <div className="stat-label">Con quórum válido</div>
          <div className="stat-value stat-blue">{actas.filter(a => Number(a.quorum) >= 50).length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Puntos aprobados (total)</div>
          <div className="stat-value stat-amber">
            {actas.reduce((s, a) => s + (a.puntos?.filter(p => p.resultado === 'APROBADO').length ?? 0), 0)}
          </div>
        </div>
      </div>

      {actas.length === 0 ? (
        <div className="empty-state"><div style={{ fontSize: 40 }}>📋</div><p>No hay actas de Junta Directiva registradas aún.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {actas.map(a => {
            const q        = Number(a.quorum);
            const hayQuorum = q >= 50;
            const aprobados = a.puntos?.filter(p => p.resultado === 'APROBADO').length ?? 0;
            const totalPuntos = a.puntos?.length ?? 0;
            const abierto   = detalle === a.id;

            return (
              <div key={a.id} className="card">
                <div className="card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: 'var(--slate-700)' }}>
                      N°{a.numero ?? 'S/N'}{a.anio ? `/${a.anio}` : ''}
                    </span>
                    <span style={{ fontWeight: 600 }}>{fmtFecha(a.fecha)}</span>
                    {a.horaInicio && <span style={{ fontSize: 12, color: 'var(--slate-500)' }}>{a.horaInicio}{a.horaFin ? ` – ${a.horaFin}` : ''}</span>}
                    {a.lugar && <span style={{ fontSize: 12, color: 'var(--slate-500)' }}>📍 {a.lugar}</span>}
                    <span style={{ fontSize: 12, color: hayQuorum ? 'var(--green-600)' : 'var(--red-600)', fontWeight: 600 }}>
                      {hayQuorum ? '✓' : '✗'} Quórum {q.toFixed(1)}%
                    </span>
                    {a.directores?.length > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--slate-500)' }}>
                        {a.directores.filter(d => d.estado === 'PRESENTE').length}/{a.directores.length} directores
                      </span>
                    )}
                    {totalPuntos > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--slate-500)' }}>
                        {aprobados}/{totalPuntos} puntos aprobados
                      </span>
                    )}
                  </div>
                  <div className="gap-8">
                    <button className="btn btn-ghost btn-sm" onClick={() => setDetalle(abierto ? null : a.id)}>
                      {abierto ? 'Cerrar' : 'Ver detalle'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirDirectores(a)}>👥 Directores</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirPuntos(a)}>📋 Puntos</button>
                    {a.documento && (
                      <a className="btn btn-ghost btn-sm" href={a.documento} target="_blank" rel="noopener noreferrer">📎</a>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => descargarDocx(a)}>⬇ Word</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(a)}>Editar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => eliminarActa(a)}>✕</button>
                  </div>
                </div>

                {abierto && (
                  <div className="card-body" style={{ borderTop: '1px solid var(--slate-100)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {(a.presidente || a.secretario) && (
                      <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
                        {a.presidente && <span><strong>Presidente:</strong> {a.presidente}{a.presidenteCedula ? ` (${a.presidenteCedula})` : ''}</span>}
                        {a.secretario && <span><strong>Secretario:</strong> {a.secretario}{a.secretarioCedula ? ` (${a.secretarioCedula})` : ''}</span>}
                      </div>
                    )}

                    {a.directores?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)', marginBottom: 6 }}>Directores</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {a.directores.map((d, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                              padding: '3px 8px', borderRadius: 6, background: 'var(--slate-50)', border: '1px solid var(--slate-200)' }}>
                              <span className={`badge ${ESTADO_DIR_CLASS[d.estado]}`} style={{ padding: '1px 5px', fontSize: 10 }}>{d.estado}</span>
                              <span style={{ fontWeight: 600 }}>{d.nombre}</span>
                              {d.cargo !== 'DIRECTOR' && <span style={{ color: 'var(--slate-400)' }}>· {d.cargo}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {a.puntos?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)', marginBottom: 6 }}>Puntos del orden del día</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {a.puntos.map((p, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                              <span style={{ color: 'var(--slate-400)', minWidth: 20 }}>{i + 1}.</span>
                              <span style={{ flex: 1 }}>{p.descripcion}</span>
                              <span className={`badge ${RESULTADO_PUNTO_CLASS[p.resultado]}`}>{p.resultado}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {a.acuerdos && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)', marginBottom: 4 }}>Acuerdos adicionales</div>
                        <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--slate-700)' }}>{a.acuerdos}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal crear/editar acta ────────────────────────────────────────── */}
      {modalForm && (
        <div className="modal-backdrop" onClick={() => setModalForm(false)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editando ? `Editar Acta JD N°${editando.numero ?? 'S/N'}${editando.anio ? `/${editando.anio}` : ''}` : 'Nueva acta de Junta Directiva'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalForm(false)}>✕</button>
            </div>
            <form onSubmit={guardarActa}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {error && <div className="alert alert-error">{error}</div>}

                <div className="form-row">
                  <div className="form-group">
                    <label>Fecha *</label>
                    <input type="date" required value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Hora inicio</label>
                    <input type="time" value={form.horaInicio} onChange={e => setForm(f => ({ ...f, horaInicio: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Hora fin</label>
                    <input type="time" value={form.horaFin} onChange={e => setForm(f => ({ ...f, horaFin: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Lugar</label>
                  <input value={form.lugar} placeholder="Ej: Oficina de administración, sala de reuniones" onChange={e => setForm(f => ({ ...f, lugar: e.target.value }))} />
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>Presidente de la JD</label>
                    <input value={form.presidente} onChange={e => setForm(f => ({ ...f, presidente: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Cédula</label>
                    <input value={form.presidenteCedula} placeholder="X-XXX-XXXX" onChange={e => setForm(f => ({ ...f, presidenteCedula: e.target.value }))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>Secretario</label>
                    <input value={form.secretario} onChange={e => setForm(f => ({ ...f, secretario: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Cédula</label>
                    <input value={form.secretarioCedula} placeholder="X-XXX-XXXX" onChange={e => setForm(f => ({ ...f, secretarioCedula: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Acuerdos adicionales</label>
                  <textarea rows={4} style={{ resize: 'vertical', fontFamily: 'inherit' }} value={form.acuerdos}
                    placeholder="Otros acuerdos u observaciones no incluidos en los puntos del orden del día…"
                    onChange={e => setForm(f => ({ ...f, acuerdos: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>Documento firmado (PDF)</label>
                  <FileUpload value={form.documento} onChange={url => setForm(f => ({ ...f, documento: url || '' }))} accept=".pdf,image/*" label="Adjuntar acta firmada" />
                </div>

                {!editando && (
                  <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>
                    El quórum se calculará automáticamente al registrar los directores. Los puntos del orden del día se agregan en el paso siguiente.
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal directores ────────────────────────────────────────────────── */}
      {modalDirectores && (() => {
        const { pct, presentes, total } = quorumLocalDir();
        const hayQuorum = pct >= 50;
        return (
          <div className="modal-backdrop" onClick={() => setModalDirectores(null)}>
            <div className="modal" style={{ maxWidth: 660 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Directores — Acta JD N°{modalDirectores.numero ?? 'S/N'}{modalDirectores.anio ? `/${modalDirectores.anio}` : ''} · {fmtFecha(modalDirectores.fecha)}</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setModalDirectores(null)}>✕</button>
              </div>
              <div className="modal-body">
                {/* Banner quórum */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: 10, marginBottom: 12,
                  background: hayQuorum ? '#f0fdf4' : '#fff7ed',
                  border: `2px solid ${hayQuorum ? '#4ade80' : '#fb923c'}`,
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: hayQuorum ? '#15803d' : '#c2410c' }}>
                      {presentes} de {total} directores presentes
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--slate-500)', marginTop: 2 }}>
                      {hayQuorum ? '✓ Quórum alcanzado' : '✗ Sin quórum — se requiere más del 50% de directores presentes'}
                    </div>
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: hayQuorum ? '#16a34a' : '#ea580c' }}>
                    {pct.toFixed(1)}%
                  </div>
                </div>

                <p style={{ fontSize: 12, color: 'var(--slate-500)', marginBottom: 10 }}>
                  Clic en el badge de estado para alternarlo entre PRESENTE → AUSENTE → JUSTIFICADO.
                </p>

                {/* Lista directores */}
                {directores.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                    {directores.map((d, i) => (
                      <div key={i} style={{
                        padding: '8px 12px', borderRadius: 8, border: '1px solid',
                        borderColor: d.estado === 'PRESENTE' ? '#bbf7d0' : 'var(--slate-200)',
                        background: d.estado === 'PRESENTE' ? '#f0fdf4' : 'var(--slate-50)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{d.nombre}</span>
                          {d.cedula && <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>{d.cedula}</span>}
                          {d.cargo !== 'DIRECTOR' && (
                            <span style={{ fontSize: 11, background: 'var(--slate-200)', borderRadius: 4, padding: '1px 6px' }}>{d.cargo}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button
                            className={`badge ${ESTADO_DIR_CLASS[d.estado]}`}
                            style={{ cursor: 'pointer', border: 'none', fontWeight: 700, fontSize: 11, padding: '4px 10px' }}
                            onClick={() => toggleEstadoDir(i)}
                          >
                            {d.estado}
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => iniciarEditDir(i)}>Editar</button>
                          <button className="btn btn-danger btn-sm" onClick={() => eliminarDirector(i)}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Form agregar/editar director */}
                <div style={{ background: 'var(--slate-50)', padding: 14, borderRadius: 10, border: '1px solid var(--slate-200)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-500)', marginBottom: 10 }}>
                    {editDir !== null ? `Editando director ${editDir + 1}` : 'Agregar director'}
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 2 }}>
                      <label>Nombre *</label>
                      <input value={formDir.nombre} placeholder="Nombre completo"
                        onChange={e => setFormDir(f => ({ ...f, nombre: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>Cédula</label>
                      <input value={formDir.cedula} placeholder="X-XXX-XXXX"
                        onChange={e => setFormDir(f => ({ ...f, cedula: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Cargo</label>
                      <select value={formDir.cargo} onChange={e => setFormDir(f => ({ ...f, cargo: e.target.value }))}>
                        {CARGOS.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Estado</label>
                      <select value={formDir.estado} onChange={e => setFormDir(f => ({ ...f, estado: e.target.value }))}>
                        {ESTADOS_DIR.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={agregarDirector} disabled={!formDir.nombre.trim()}>
                      {editDir !== null ? 'Actualizar' : '+ Agregar'}
                    </button>
                    {editDir !== null && (
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditDir(null); setFormDir(EMPTY_DIRECTOR); }}>Cancelar</button>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setModalDirectores(null)}>Cerrar</button>
                <button className="btn btn-primary" onClick={guardarDirectores} disabled={savingDir}>
                  {savingDir ? 'Guardando…' : 'Guardar directores'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal puntos ────────────────────────────────────────────────────── */}
      {modalPuntos && (
        <div className="modal-backdrop" onClick={() => setModalPuntos(null)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Puntos — Acta JD N°{modalPuntos.numero ?? 'S/N'}{modalPuntos.anio ? `/${modalPuntos.anio}` : ''} · {fmtFecha(modalPuntos.fecha)}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalPuntos(null)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Lista puntos */}
              {puntos.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {puntos.map((p, i) => (
                    <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--slate-50)', border: '1px solid var(--slate-200)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{i + 1}. {p.descripcion}</div>
                          {p.notas && <div style={{ fontSize: 12, color: 'var(--slate-500)', marginTop: 2 }}>{p.notas}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span className={`badge ${RESULTADO_PUNTO_CLASS[p.resultado]}`}>{p.resultado}</span>
                          <button className="btn btn-ghost btn-sm" onClick={() => iniciarEditPunto(i)}>Editar</button>
                          <button className="btn btn-danger btn-sm" onClick={() => eliminarPunto(i)}>✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Form punto */}
              <div style={{ background: 'var(--slate-50)', padding: 14, borderRadius: 10, border: '1px solid var(--slate-200)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-500)', marginBottom: 10 }}>
                  {editPunto !== null ? `Editando punto ${editPunto + 1}` : 'Agregar punto'}
                </div>
                <div className="form-group">
                  <label>Descripción *</label>
                  <textarea rows={2} style={{ resize: 'vertical', fontFamily: 'inherit' }}
                    value={formPunto.descripcion}
                    onChange={e => setFormPunto(f => ({ ...f, descripcion: e.target.value }))}
                    placeholder="Ej: Aprobación del informe financiero del mes de abril…" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Resultado</label>
                    <select value={formPunto.resultado} onChange={e => setFormPunto(f => ({ ...f, resultado: e.target.value }))}>
                      {RESULTADOS_PUNTO.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>Notas</label>
                    <input value={formPunto.notas} onChange={e => setFormPunto(f => ({ ...f, notas: e.target.value }))}
                      placeholder="Observaciones opcionales…" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={agregarPunto} disabled={!formPunto.descripcion.trim()}>
                    {editPunto !== null ? 'Actualizar' : '+ Agregar'}
                  </button>
                  {editPunto !== null && (
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditPunto(null); setFormPunto(EMPTY_PUNTO); }}>Cancelar</button>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalPuntos(null)}>Cerrar</button>
              <button className="btn btn-primary" onClick={guardarPuntos} disabled={savingPuntos}>
                {savingPuntos ? 'Guardando…' : 'Guardar puntos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
