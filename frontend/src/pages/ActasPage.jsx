import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import FileUpload from '../components/FileUpload';

// ── Constantes ────────────────────────────────────────────────────────────────
const TIPOS       = ['ORDINARIA', 'EXTRAORDINARIA'];
const MODALIDADES = ['PRESENCIAL', 'VIRTUAL', 'MIXTA'];
const ESTADOS_ASIST = ['AUSENTE', 'PRESENTE', 'REPRESENTADO'];
const CICLO_ESTADO  = { AUSENTE: 'PRESENTE', PRESENTE: 'REPRESENTADO', REPRESENTADO: 'AUSENTE' };
const MOD_CLASS     = { PRESENCIAL: 'badge-slate', VIRTUAL: 'badge-blue', MIXTA: 'badge-amber' };
const ESTADO_CLASS  = { PRESENTE: 'badge-green', AUSENTE: 'badge-slate', REPRESENTADO: 'badge-blue' };

const TIPOS_VOT = [
  { value: 'SIMPLE',   label: 'Mayoría simple' },
  { value: 'P51',      label: '51% — Junta Directiva / mejoras / bienes comunes' },
  { value: 'P66',      label: '66% — Modificación de cuotas' },
  { value: 'P66_75V',  label: '66% + 75% valor — Reforma Reglamento' },
  { value: 'P75V',     label: '75% valor — Disolución / demolición' },
];

const RESULTADO_CLASS = { APROBADA: 'badge-green', NEGADA: 'badge-red', PENDIENTE: 'badge-amber' };

const EMPTY_ACTA = {
  tipo: 'ORDINARIA', modalidad: 'PRESENCIAL',
  fecha: new Date().toISOString().slice(0, 10),
  lugar: '', horaInicio: '', horaFin: '',
  convocatoria: '', fechaConvocatoria: '', convocadoPor: '',
  presidente: '', presidenteCedula: '',
  secretario: '', secretarioCedula: '',
  acuerdos: '', autorizadoPara: '', documento: '',
};

const EMPTY_PROPUESTA = {
  descripcion: '', tipoVotacion: 'SIMPLE',
  votosAFavor: 0, votosEnContra: 0, abstenciones: 0,
  requiereInscripcionRP: false, notas: '',
};

function fmtFecha(f) {
  return new Date(f).toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ActasPage() {
  const { edificioId } = useParams();
  const [actas, setActas]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState(null);   // actaId inline expand

  // Modales
  const [modalForm, setModalForm]         = useState(false);
  const [modalAsist, setModalAsist]       = useState(null);
  const [modalPropuestas, setModalPropuestas] = useState(null);

  // Form acta
  const [editando, setEditando] = useState(null);
  const [form, setForm]         = useState(EMPTY_ACTA);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  // Asistencia local
  const [asistMap, setAsistMap] = useState({});   // { unidadId: { estado, modalidadAsistencia, mandatario, mandatarioCedula } }
  const [savingAsist, setSavingAsist] = useState(false);

  // Propuestas local
  const [propuestas, setPropuestas]     = useState([]);
  const [savingProp, setSavingProp]     = useState(false);
  const [editProp, setEditProp]         = useState(null);   // índice o null
  const [formProp, setFormProp]         = useState(EMPTY_PROPUESTA);

  useEffect(() => { cargar(); }, [edificioId]);

  async function descargarDocx(a) {
    try {
      const { data } = await api.get(`/edificios/${edificioId}/actas/${a.id}/docx`, { responseType: 'blob' });
      const url  = URL.createObjectURL(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Acta_${a.numero ?? 'SN'}_${a.anio ?? ''}.docx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch { alert('Error al generar el documento Word'); }
  }

  async function cargar() {
    setLoading(true);
    try {
      const { data } = await api.get(`/edificios/${edificioId}/actas`);
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
      tipo:             a.tipo,
      modalidad:        a.modalidad        || 'PRESENCIAL',
      fecha:            a.fecha.slice(0, 10),
      lugar:            a.lugar            || '',
      horaInicio:       a.horaInicio       || '',
      horaFin:          a.horaFin          || '',
      convocatoria:      a.convocatoria      || '',
      fechaConvocatoria: a.fechaConvocatoria ? a.fechaConvocatoria.slice(0, 10) : '',
      convocadoPor:      a.convocadoPor      || '',
      presidente:        a.presidente        || '',
      presidenteCedula: a.presidenteCedula || '',
      secretario:        a.secretario        || '',
      secretarioCedula:  a.secretarioCedula  || '',
      acuerdos:          a.acuerdos          || '',
      autorizadoPara:    a.autorizadoPara    || '',
      documento:         a.documento         || '',
    });
    setError(''); setModalForm(true);
  }

  async function guardarActa(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const payload = { ...form, documento: form.documento || null };
      ['lugar','horaInicio','horaFin','convocatoria','convocadoPor',
       'presidente','presidenteCedula','secretario','secretarioCedula',
       'acuerdos','autorizadoPara'].forEach(k => { if (!payload[k]) payload[k] = null; });
      if (!payload.fechaConvocatoria) payload.fechaConvocatoria = null;

      if (editando) {
        await api.put(`/edificios/${edificioId}/actas/${editando.id}`, payload);
      } else {
        await api.post(`/edificios/${edificioId}/actas`, payload);
      }
      setModalForm(false); cargar();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  async function eliminarActa(a) {
    if (!confirm(`¿Eliminar Acta N°${a.numero ?? 'S/N'}${a.anio ? `/${a.anio}` : ''} del ${fmtFecha(a.fecha)}?`)) return;
    try { await api.delete(`/edificios/${edificioId}/actas/${a.id}`); cargar(); }
    catch (err) { alert(err.response?.data?.error || 'Error'); }
  }

  // ── Asistencia ────────────────────────────────────────────────────────────
  function abrirAsistencia(acta) {
    const mapa = {};
    for (const ast of acta.asistencias) {
      mapa[ast.unidad.id] = {
        estado:              ast.estado,
        modalidadAsistencia: ast.modalidadAsistencia || 'PRESENCIAL',
        mandatario:          ast.mandatario          || '',
        mandatarioCedula:    ast.mandatarioCedula    || '',
      };
    }
    setAsistMap(mapa);
    setModalAsist(acta);
  }

  function toggleEstado(unidadId) {
    setAsistMap(prev => ({
      ...prev,
      [unidadId]: {
        ...prev[unidadId],
        estado: CICLO_ESTADO[prev[unidadId]?.estado || 'AUSENTE'],
      },
    }));
  }

  function toggleModalidadAsist(unidadId) {
    setAsistMap(prev => ({
      ...prev,
      [unidadId]: {
        ...prev[unidadId],
        modalidadAsistencia: prev[unidadId]?.modalidadAsistencia === 'PRESENCIAL' ? 'VIRTUAL' : 'PRESENCIAL',
      },
    }));
  }

  function setMandatario(unidadId, field, value) {
    setAsistMap(prev => ({ ...prev, [unidadId]: { ...prev[unidadId], [field]: value } }));
  }

  async function guardarAsistencia() {
    setSavingAsist(true);
    try {
      const payload = Object.entries(asistMap).map(([unidadId, v]) => ({
        unidadId: parseInt(unidadId),
        estado:              v.estado,
        modalidadAsistencia: v.modalidadAsistencia,
        mandatario:          v.mandatario          || null,
        mandatarioCedula:    v.mandatarioCedula    || null,
      }));
      const { data } = await api.put(`/edificios/${edificioId}/actas/${modalAsist.id}/asistencias`, { asistencias: payload });
      setActas(prev => prev.map(a => a.id === data.id ? data : a));
      setModalAsist(data);
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
    finally { setSavingAsist(false); }
  }

  // ── Propuestas ────────────────────────────────────────────────────────────
  function abrirPropuestas(acta) {
    setPropuestas(acta.propuestas.map(p => ({ ...p })));
    setEditProp(null); setFormProp(EMPTY_PROPUESTA);
    setModalPropuestas(acta);
  }

  function iniciarEditProp(idx) {
    setEditProp(idx);
    setFormProp({ ...propuestas[idx], notas: propuestas[idx].notas || '' });
  }

  function agregarPropuesta() {
    if (!formProp.descripcion.trim()) return;
    const nueva = { ...formProp };
    if (editProp !== null) {
      const arr = [...propuestas]; arr[editProp] = nueva; setPropuestas(arr);
    } else {
      setPropuestas(prev => [...prev, nueva]);
    }
    setEditProp(null); setFormProp(EMPTY_PROPUESTA);
  }

  function eliminarPropuesta(idx) {
    setPropuestas(prev => prev.filter((_, i) => i !== idx));
  }

  async function guardarPropuestas() {
    setSavingProp(true);
    try {
      const { data } = await api.put(`/edificios/${edificioId}/actas/${modalPropuestas.id}/propuestas`, { propuestas });
      setActas(prev => prev.map(a => a.id === data.id ? data : a));
      setModalPropuestas(data);
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
    finally { setSavingProp(false); }
  }

  // ── Quórum local (en modal asistencia) ───────────────────────────────────
  function quorumLocal(acta) {
    const habilitados = acta.asistencias.filter(a => a.unidad.propietario);
    const presentes   = habilitados.filter(a => {
      const e = asistMap[a.unidad.id]?.estado ?? a.estado;
      return e === 'PRESENTE' || e === 'REPRESENTADO';
    });
    const coefPresente = presentes.reduce((s, a) => s + Number(a.unidad.coeficiente), 0);
    const pct = habilitados.length ? +(presentes.length / habilitados.length * 100).toFixed(1) : 0;
    return { pct, presentes: presentes.length, habilitados: habilitados.length, coefPresente: +(coefPresente * 100).toFixed(2) };
  }

  if (loading) return <div className="loading">Cargando…</div>;

  const totalOrdinarias     = actas.filter(a => a.tipo === 'ORDINARIA').length;
  const totalExtraordinarias = actas.filter(a => a.tipo === 'EXTRAORDINARIA').length;
  const quorumProm = actas.length
    ? (actas.reduce((s, a) => s + Number(a.quorum), 0) / actas.length).toFixed(1)
    : '—';

  return (
    <div className="page">
      <div className="page-header">
        <h1>Actas de Asamblea</h1>
        <button className="btn btn-primary" onClick={abrirNueva}>+ Nueva acta</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Total actas</div><div className="stat-value">{actas.length}</div></div>
        <div className="stat-card"><div className="stat-label">Ordinarias</div><div className="stat-value stat-blue">{totalOrdinarias}</div></div>
        <div className="stat-card"><div className="stat-label">Extraordinarias</div><div className="stat-value stat-amber">{totalExtraordinarias}</div></div>
        <div className="stat-card"><div className="stat-label">Quórum promedio</div><div className="stat-value stat-green">{quorumProm}{actas.length ? '%' : ''}</div></div>
      </div>

      {actas.length === 0 ? (
        <div className="empty-state"><div style={{ fontSize: 40 }}>📄</div><p>No hay actas registradas aún.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {actas.map(a => {
            const q        = Number(a.quorum);
            const hayQuorum = q >= 50;
            const aprobadas = a.propuestas?.filter(p => p.resultado === 'APROBADA').length ?? 0;
            const totalProp = a.propuestas?.length ?? 0;
            const abierto   = detalle === a.id;

            return (
              <div key={a.id} className="card">
                <div className="card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: 'var(--slate-700)' }}>
                      N°{a.numero ?? 'S/N'}{a.anio ? `/${a.anio}` : ''}
                    </span>
                    <span className={`badge ${a.tipo === 'ORDINARIA' ? 'badge-blue' : 'badge-amber'}`}>{a.tipo}</span>
                    <span className={`badge ${MOD_CLASS[a.modalidad] || 'badge-slate'}`}>{a.modalidad}</span>
                    <span style={{ fontWeight: 600 }}>{fmtFecha(a.fecha)}</span>
                    {a.horaInicio && <span style={{ fontSize: 12, color: 'var(--slate-500)' }}>{a.horaInicio}{a.horaFin ? ` – ${a.horaFin}` : ''}</span>}
                    <span style={{ fontSize: 12, color: hayQuorum ? 'var(--green-600)' : 'var(--red-600)', fontWeight: 600 }}>
                      {hayQuorum ? '✓' : '✗'} Quórum {q.toFixed(1)}%
                    </span>
                    {totalProp > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--slate-500)' }}>
                        {aprobadas}/{totalProp} propuestas aprobadas
                      </span>
                    )}
                  </div>
                  <div className="gap-8">
                    <button className="btn btn-ghost btn-sm" onClick={() => setDetalle(abierto ? null : a.id)}>
                      {abierto ? 'Cerrar' : 'Ver detalle'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirAsistencia(a)}>👥 Asistencia</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirPropuestas(a)}>📋 Propuestas</button>
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
                    {/* Presidente / Secretario */}
                    {(a.presidente || a.secretario) && (
                      <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
                        {a.presidente && <span><strong>Presidente:</strong> {a.presidente}{a.presidenteCedula ? ` (${a.presidenteCedula})` : ''}</span>}
                        {a.secretario && <span><strong>Secretario:</strong> {a.secretario}{a.secretarioCedula ? ` (${a.secretarioCedula})` : ''}</span>}
                      </div>
                    )}
                    {/* Convocatoria */}
                    {a.convocatoria && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)', marginBottom: 4 }}>Convocatoria</div>
                        <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--slate-700)', background: 'var(--slate-50)', padding: '8px 12px', borderRadius: 6 }}>
                          {a.convocatoria}
                        </div>
                      </div>
                    )}
                    {/* Propuestas resumen */}
                    {a.propuestas?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)', marginBottom: 6 }}>Propuestas</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {a.propuestas.map((p, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                              <span style={{ color: 'var(--slate-400)', minWidth: 20 }}>{i + 1}.</span>
                              <span style={{ flex: 1 }}>{p.descripcion}</span>
                              <span className={`badge ${RESULTADO_CLASS[p.resultado]}`}>{p.resultado}</span>
                              {p.requiereInscripcionRP && <span className="badge badge-amber" style={{ fontSize: 10 }}>RP</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Acuerdos */}
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
          <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editando ? `Editar Acta N°${editando.numero ?? 'S/N'}${editando.anio ? `/${editando.anio}` : ''}` : 'Nueva acta de asamblea'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalForm(false)}>✕</button>
            </div>
            <form onSubmit={guardarActa}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {error && <div className="alert alert-error">{error}</div>}

                <div className="form-row">
                  <div className="form-group">
                    <label>Tipo *</label>
                    <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                      {TIPOS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Modalidad *</label>
                    <select value={form.modalidad} onChange={e => setForm(f => ({ ...f, modalidad: e.target.value }))}>
                      {MODALIDADES.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Fecha *</label>
                    <input type="date" required value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                  </div>
                </div>

                <div className="form-row">
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
                  <label>Lugar / medio tecnológico</label>
                  <input value={form.lugar} placeholder="Ej: Salón de usos múltiples, piso 1 / Zoom Meeting ID 123-456" onChange={e => setForm(f => ({ ...f, lugar: e.target.value }))} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Presidente</label>
                    <input value={form.presidente} onChange={e => setForm(f => ({ ...f, presidente: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Cédula</label>
                    <input value={form.presidenteCedula} onChange={e => setForm(f => ({ ...f, presidenteCedula: e.target.value }))} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Secretario</label>
                    <input value={form.secretario} onChange={e => setForm(f => ({ ...f, secretario: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Cédula</label>
                    <input value={form.secretarioCedula} onChange={e => setForm(f => ({ ...f, secretarioCedula: e.target.value }))} />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--slate-100)', paddingTop: 12, marginTop: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--slate-400)', marginBottom: 10 }}>
                    Convocatoria
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Fecha de la convocatoria</label>
                      <input type="date" value={form.fechaConvocatoria}
                        onChange={e => setForm(f => ({ ...f, fechaConvocatoria: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>Convocada por</label>
                      <input value={form.convocadoPor} placeholder="Ej: Junta Directiva del edificio…"
                        onChange={e => setForm(f => ({ ...f, convocadoPor: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Transcripción del aviso de convocatoria</label>
                    <textarea rows={4} style={{ resize: 'vertical', fontFamily: 'inherit' }} value={form.convocatoria}
                      placeholder="Copie aquí el texto del aviso de convocatoria enviado a los propietarios…"
                      onChange={e => setForm(f => ({ ...f, convocatoria: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Acuerdos adicionales</label>
                  <textarea rows={4} style={{ resize: 'vertical', fontFamily: 'inherit' }} value={form.acuerdos}
                    placeholder="Otros acuerdos, observaciones o puntos tratados no incluidos en las propuestas…"
                    onChange={e => setForm(f => ({ ...f, acuerdos: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>Autorizado para inscripción en Registro Público</label>
                  <textarea rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }} value={form.autorizadoPara}
                    placeholder="Ej: Los propietarios autorizan a Juan Pérez, cédula X-XXX-XXXX, para comparecer ante el Registro Público y solicitar la inscripción del presente acuerdo…"
                    onChange={e => setForm(f => ({ ...f, autorizadoPara: e.target.value }))} />
                  <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>Cláusula de autorización para inscribir acuerdos ante el Registro Público de Panamá</span>
                </div>

                <div className="form-group">
                  <label>Documento firmado (PDF)</label>
                  <FileUpload value={form.documento} onChange={url => setForm(f => ({ ...f, documento: url || '' }))} accept=".pdf,image/*" label="Adjuntar acta firmada" />
                </div>

                {!editando && (
                  <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>
                    El quórum se calculará automáticamente al registrar la asistencia. Las propuestas se agregan en el paso siguiente.
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

      {/* ── Modal asistencia ────────────────────────────────────────────────── */}
      {modalAsist && (() => {
        const { pct, presentes, habilitados, coefPresente } = quorumLocal(modalAsist);
        const hayQuorum = pct >= 50;
        return (
          <div className="modal-backdrop" onClick={() => setModalAsist(null)}>
            <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Asistencia — Acta N°{modalAsist.numero ?? 'S/N'}{modalAsist.anio ? `/${modalAsist.anio}` : ''} · {fmtFecha(modalAsist.fecha)}</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setModalAsist(null)}>✕</button>
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
                    <div style={{ fontWeight: 700, fontSize: 14, color: hayQuorum ? 'var(--green-700, #15803d)' : '#c2410c' }}>
                      {presentes} de {habilitados} propietarios presentes / representados
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--slate-500)', marginTop: 2 }}>
                      {hayQuorum ? '✓ Quórum alcanzado (Ley 284, Art.67)' : '✗ Sin quórum — se requiere más del 50% de propietarios'}
                      {' · '}Coeficiente presente: {coefPresente.toFixed(2)}%
                    </div>
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: hayQuorum ? '#16a34a' : '#ea580c' }}>
                    {pct.toFixed(1)}%
                  </div>
                </div>

                <p style={{ fontSize: 12, color: 'var(--slate-500)', marginBottom: 10 }}>
                  Clic en el estado para alternarlo · Si es REPRESENTADO, ingresa el mandatario · Indica si asistió de forma presencial o virtual.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {modalAsist.asistencias.map(ast => {
                    const d      = asistMap[ast.unidad.id] ?? { estado: ast.estado, modalidadAsistencia: 'PRESENCIAL', mandatario: '', mandatarioCedula: '' };
                    const estado = d.estado;
                    const esPresente = estado === 'PRESENTE' || estado === 'REPRESENTADO';
                    return (
                      <div key={ast.unidad.id} style={{
                        padding: '8px 12px', borderRadius: 8, border: '1px solid',
                        borderColor: esPresente ? '#bbf7d0' : 'var(--slate-200)',
                        background: esPresente ? '#f0fdf4' : 'var(--slate-50)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <strong style={{ minWidth: 36 }}>#{ast.unidad.numero}</strong>
                            {ast.unidad.numFinca && <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>F:{ast.unidad.numFinca}</span>}
                            <span style={{ fontSize: 12, color: 'var(--slate-500)' }}>{ast.unidad.tipo}</span>
                            <span style={{ fontSize: 13 }}>{ast.unidad.propietario?.nombre ?? <em style={{ color: 'var(--slate-400)' }}>Sin propietario</em>}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>{(Number(ast.unidad.coeficiente) * 100).toFixed(2)}%</span>
                            {esPresente && (
                              <button
                                className={`badge ${d.modalidadAsistencia === 'VIRTUAL' ? 'badge-blue' : 'badge-slate'}`}
                                style={{ cursor: 'pointer', border: 'none', fontSize: 11, padding: '3px 8px' }}
                                onClick={() => toggleModalidadAsist(ast.unidad.id)}
                              >
                                {d.modalidadAsistencia === 'VIRTUAL' ? '🖥 Virtual' : '🏢 Presencial'}
                              </button>
                            )}
                            <button
                              className={`badge ${ESTADO_CLASS[estado]}`}
                              style={{ cursor: 'pointer', border: 'none', fontWeight: 700, fontSize: 12, padding: '4px 10px' }}
                              onClick={() => toggleEstado(ast.unidad.id)}
                            >
                              {estado}
                            </button>
                          </div>
                        </div>
                        {estado === 'REPRESENTADO' && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                            <input
                              style={{ flex: 2, fontSize: 12, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--slate-300)' }}
                              placeholder="Nombre del mandatario"
                              value={d.mandatario || ''}
                              onChange={e => setMandatario(ast.unidad.id, 'mandatario', e.target.value)}
                            />
                            <input
                              style={{ flex: 1, fontSize: 12, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--slate-300)' }}
                              placeholder="Cédula"
                              value={d.mandatarioCedula || ''}
                              onChange={e => setMandatario(ast.unidad.id, 'mandatarioCedula', e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setModalAsist(null)}>Cerrar</button>
                <button className="btn btn-primary" onClick={guardarAsistencia} disabled={savingAsist}>
                  {savingAsist ? 'Guardando…' : 'Guardar asistencia'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal propuestas ────────────────────────────────────────────────── */}
      {modalPropuestas && (() => {
        const totalUnidades = modalPropuestas.asistencias.length;
        const presentes = modalPropuestas.asistencias.filter(a => a.estado === 'PRESENTE' || a.estado === 'REPRESENTADO').length;
        return (
          <div className="modal-backdrop" onClick={() => setModalPropuestas(null)}>
            <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Propuestas — Acta N°{modalPropuestas.numero ?? 'S/N'}{modalPropuestas.anio ? `/${modalPropuestas.anio}` : ''} · {fmtFecha(modalPropuestas.fecha)}</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setModalPropuestas(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div style={{ fontSize: 12, color: 'var(--slate-500)', marginBottom: 12 }}>
                  Total unidades: {totalUnidades} · Propietarios presentes/representados: {presentes}
                </div>

                {/* Lista propuestas */}
                {propuestas.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                    {propuestas.map((p, i) => (
                      <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--slate-50)', border: '1px solid var(--slate-200)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{i + 1}. {p.descripcion}</div>
                            <div style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 2 }}>
                              {TIPOS_VOT.find(t => t.value === p.tipoVotacion)?.label || p.tipoVotacion}
                              {' · '}✓{p.votosAFavor} ✗{p.votosEnContra} —{p.abstenciones}
                              {p.requiereInscripcionRP && <span className="badge badge-amber" style={{ marginLeft: 6, fontSize: 10 }}>Inscripción RP</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span className={`badge ${RESULTADO_CLASS[p.resultado]}`}>{p.resultado}</span>
                            <button className="btn btn-ghost btn-sm" onClick={() => iniciarEditProp(i)}>Editar</button>
                            <button className="btn btn-danger btn-sm" onClick={() => eliminarPropuesta(i)}>✕</button>
                          </div>
                        </div>
                        {p.notas && <div style={{ fontSize: 12, color: 'var(--slate-500)', marginTop: 4 }}>{p.notas}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Form propuesta */}
                <div style={{ background: 'var(--slate-50)', padding: 14, borderRadius: 10, border: '1px solid var(--slate-200)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-500)', marginBottom: 10 }}>
                    {editProp !== null ? `Editando propuesta ${editProp + 1}` : 'Agregar propuesta'}
                  </div>
                  <div className="form-group">
                    <label>Descripción *</label>
                    <textarea rows={2} style={{ resize: 'vertical', fontFamily: 'inherit' }}
                      value={formProp.descripcion}
                      onChange={e => setFormProp(f => ({ ...f, descripcion: e.target.value }))}
                      placeholder="Ej: Aprobación del presupuesto de mantenimiento 2026…" />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Tipo de votación</label>
                      <select value={formProp.tipoVotacion} onChange={e => setFormProp(f => ({ ...f, tipoVotacion: e.target.value }))}>
                        {TIPOS_VOT.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: '0 0 160px' }}>
                      <label>Resultado</label>
                      <select value={formProp.resultado || 'PENDIENTE'} onChange={e => setFormProp(f => ({ ...f, resultado: e.target.value }))}>
                        <option value="PENDIENTE">Auto-calcular</option>
                        <option value="APROBADA">Aprobada</option>
                        <option value="NEGADA">Negada</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Votos a favor</label>
                      <input type="number" min="0" value={formProp.votosAFavor} onChange={e => setFormProp(f => ({ ...f, votosAFavor: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>Votos en contra</label>
                      <input type="number" min="0" value={formProp.votosEnContra} onChange={e => setFormProp(f => ({ ...f, votosEnContra: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>Abstenciones</label>
                      <input type="number" min="0" value={formProp.abstenciones} onChange={e => setFormProp(f => ({ ...f, abstenciones: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={formProp.requiereInscripcionRP}
                        onChange={e => setFormProp(f => ({ ...f, requiereInscripcionRP: e.target.checked }))} />
                      Requiere inscripción en Registro Público
                    </label>
                  </div>
                  <div className="form-group">
                    <label>Notas</label>
                    <input value={formProp.notas} onChange={e => setFormProp(f => ({ ...f, notas: e.target.value }))} placeholder="Observaciones opcionales…" />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={agregarPropuesta} disabled={!formProp.descripcion.trim()}>
                      {editProp !== null ? 'Actualizar' : '+ Agregar'}
                    </button>
                    {editProp !== null && (
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditProp(null); setFormProp(EMPTY_PROPUESTA); }}>Cancelar</button>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setModalPropuestas(null)}>Cerrar</button>
                <button className="btn btn-primary" onClick={guardarPropuestas} disabled={savingProp}>
                  {savingProp ? 'Guardando…' : 'Guardar propuestas'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
