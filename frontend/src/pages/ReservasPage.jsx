import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';

const AREAS = ['SALON', 'PISCINA', 'GIMNASIO', 'TERRAZA', 'BBQ', 'OTRO'];
const AREA_ICON = { SALON: '🎉', PISCINA: '🏊', GIMNASIO: '🏋️', TERRAZA: '🌿', BBQ: '🔥', OTRO: '📍' };
const AREA_COLOR = {
  SALON:    '#2563eb', PISCINA:  '#0891b2', GIMNASIO: '#7c3aed',
  TERRAZA:  '#16a34a', BBQ:      '#ea580c', OTRO:     '#64748b',
};
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES_L = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const EMPTY = { unidadId: '', area: 'SALON', fecha: '', horaInicio: '09:00', horaFin: '12:00', notas: '' };

function isoFecha(d) { return d.toISOString().slice(0, 10); }
function lunes(d) {
  const c = new Date(d);
  const day = c.getDay();
  c.setDate(c.getDate() - (day === 0 ? 6 : day - 1));
  c.setHours(0, 0, 0, 0);
  return c;
}
function addDias(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }

function estadoBadge(estado) {
  if (estado === 'APROBADA')  return <span className="badge badge-green">Aprobada</span>;
  if (estado === 'CANCELADA') return <span className="badge badge-slate">Cancelada</span>;
  return <span className="badge badge-amber">Pendiente</span>;
}

export default function ReservasPage() {
  const { edificioId } = useParams();
  const [reservas, setReservas]   = useState([]);
  const [unidades, setUnidades]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [semana, setSemana]       = useState(() => lunes(new Date()));
  const [filtroArea, setFiltroArea] = useState('');
  const [vista, setVista]         = useState('semana'); // 'semana' | 'lista'
  const [modal, setModal]         = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [conflictos, setConflictos] = useState([]);

  useEffect(() => { cargarUnidades(); }, [edificioId]);
  useEffect(() => { cargar(); }, [edificioId, semana, filtroArea]);

  async function cargarUnidades() {
    try {
      const { data } = await api.get(`/edificios/${edificioId}/unidades`);
      setUnidades(data);
    } catch {}
  }

  async function cargar() {
    setLoading(true);
    try {
      const desde = isoFecha(semana);
      const hasta = isoFecha(addDias(semana, 6));
      // Traer reservas del rango de la semana visible
      const params = new URLSearchParams();
      if (filtroArea) params.set('area', filtroArea);
      const { data } = await api.get(`/edificios/${edificioId}/reservas?${params}`);
      // Filtrar por semana en el cliente
      const enSemana = data.filter(r => {
        const f = r.fecha.slice(0, 10);
        return f >= desde && f <= hasta;
      });
      setReservas(enSemana);
    } finally { setLoading(false); }
  }

  async function consultarDisponibilidad(area, fecha) {
    if (!area || !fecha) return;
    try {
      const { data } = await api.get(`/edificios/${edificioId}/reservas/disponibilidad?area=${area}&fecha=${fecha}`);
      setConflictos(data.ocupado || []);
    } catch { setConflictos([]); }
  }

  async function guardar(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.post(`/edificios/${edificioId}/reservas`, form);
      setModal(false); setForm(EMPTY); setConflictos([]);
      // Saltar semana al día de la reserva
      setSemana(lunes(new Date(form.fecha + 'T12:00:00')));
      cargar();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  async function cambiarEstado(r, estado) {
    const msg = estado === 'APROBADA' ? '¿Aprobar esta reserva?' : '¿Cancelar esta reserva?';
    if (!confirm(msg)) return;
    try { await api.put(`/edificios/${edificioId}/reservas/${r.id}`, { estado }); cargar(); }
    catch (err) { alert(err.response?.data?.error || 'Error'); }
  }

  async function eliminar(r) {
    if (!confirm('¿Eliminar esta reserva?')) return;
    try { await api.delete(`/edificios/${edificioId}/reservas/${r.id}`); cargar(); }
    catch (err) { alert(err.response?.data?.error || 'Error'); }
  }

  // Días de la semana actual
  const diasSemana = Array.from({ length: 7 }, (_, i) => addDias(semana, i));
  const hoy = isoFecha(new Date());

  // Agrupar reservas por fecha
  const porFecha = {};
  reservas.forEach(r => {
    const k = r.fecha.slice(0, 10);
    if (!porFecha[k]) porFecha[k] = [];
    porFecha[k].push(r);
  });

  const titulo = `${MESES_L[semana.getMonth()]} ${semana.getFullYear()}`;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Reservas de Áreas Comunes</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={`/api/edificios/${edificioId}/reservas.xlsx`} className="btn btn-ghost btn-sm" download>⬇ Excel</a>
          <button className="btn btn-primary" onClick={() => { setError(''); setForm(EMPTY); setConflictos([]); setModal(true); }}>
            + Nueva reserva
          </button>
        </div>
      </div>

      {/* Controles de semana + filtros */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setSemana(s => addDias(s, -7))}>←</button>
          <span style={{ fontWeight: 600, fontSize: 14, minWidth: 160, textAlign: 'center' }}>{titulo}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setSemana(s => addDias(s, 7))}>→</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSemana(lunes(new Date()))}>Hoy</button>
        </div>
        <div className="gap-8" style={{ flexWrap: 'wrap' }}>
          <button className={`btn btn-sm ${!filtroArea ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFiltroArea('')}>Todas</button>
          {AREAS.map(a => (
            <button key={a} className={`btn btn-sm ${filtroArea === a ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFiltroArea(filtroArea === a ? '' : a)}>
              {AREA_ICON[a]} {a}
            </button>
          ))}
        </div>
      </div>

      {/* Vista semana — grilla de 7 días */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 20 }}>
        {diasSemana.map(dia => {
          const key  = isoFecha(dia);
          const esHoy = key === hoy;
          const items = (porFecha[key] || []).filter(r => !filtroArea || r.area === filtroArea);
          return (
            <div key={key} style={{
              border: `1px solid ${esHoy ? 'var(--blue-600)' : 'var(--slate-300)'}`,
              borderRadius: 8,
              background: esHoy ? 'var(--blue-50)' : 'white',
              minHeight: 100,
            }}>
              {/* Cabecera del día */}
              <div style={{
                padding: '6px 8px',
                borderBottom: '1px solid var(--slate-100)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
              }}>
                <span style={{ fontSize: 10, color: esHoy ? 'var(--blue-600)' : 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  {DIAS[dia.getDay()]}
                </span>
                <span style={{ fontSize: 18, fontWeight: esHoy ? 700 : 400, color: esHoy ? 'var(--blue-600)' : 'var(--slate-900)' }}>
                  {dia.getDate()}
                </span>
              </div>
              {/* Reservas del día */}
              <div style={{ padding: '4px 4px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {items.map(r => (
                  <div key={r.id}
                    title={`${r.area} · ${r.horaInicio}–${r.horaFin} · ${r.unidad?.propietario?.nombre || r.unidad?.numero}`}
                    style={{
                      background: r.estado === 'CANCELADA' ? 'var(--slate-100)' : AREA_COLOR[r.area] + '22',
                      borderLeft: `3px solid ${r.estado === 'CANCELADA' ? 'var(--slate-300)' : AREA_COLOR[r.area]}`,
                      borderRadius: 4, padding: '3px 5px', fontSize: 10, cursor: 'default',
                      opacity: r.estado === 'CANCELADA' ? 0.6 : 1,
                    }}>
                    <div style={{ fontWeight: 600, color: r.estado === 'CANCELADA' ? 'var(--slate-500)' : AREA_COLOR[r.area] }}>
                      {AREA_ICON[r.area]} {r.area}
                    </div>
                    <div style={{ color: 'var(--slate-600)' }}>{r.horaInicio}–{r.horaFin}</div>
                    <div style={{ color: 'var(--slate-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.unidad?.numero}
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 11, color: 'var(--slate-300)' }}>—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lista detallada de la semana */}
      {reservas.length > 0 && (
        <div className="card">
          <div className="card-header">Detalle de la semana</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Área</th><th>Horario</th><th>Unidad</th><th>Propietario</th><th>Estado</th><th>Notas</th><th></th></tr>
              </thead>
              <tbody>
                {reservas
                  .filter(r => !filtroArea || r.area === filtroArea)
                  .map(r => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                      {new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-PA', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 12, color: AREA_COLOR[r.area] }}>
                        {AREA_ICON[r.area]} {r.area}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.horaInicio} – {r.horaFin}</td>
                    <td><strong>{r.unidad?.numero}</strong></td>
                    <td style={{ fontSize: 12 }}>{r.unidad?.propietario?.nombre || '—'}</td>
                    <td>{estadoBadge(r.estado)}</td>
                    <td style={{ fontSize: 12, color: 'var(--slate-500)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.notas || '—'}
                    </td>
                    <td>
                      <div className="gap-8">
                        {r.estado === 'PENDIENTE' && (
                          <button className="btn btn-success btn-sm" onClick={() => cambiarEstado(r, 'APROBADA')}>Aprobar</button>
                        )}
                        {r.estado !== 'CANCELADA' && (
                          <button className="btn btn-danger btn-sm" onClick={() => cambiarEstado(r, 'CANCELADA')}>Cancelar</button>
                        )}
                        {r.estado === 'CANCELADA' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => eliminar(r)}>✕</button>
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

      {reservas.length === 0 && !loading && (
        <div className="empty-state">
          <div style={{ fontSize: 40 }}>📅</div>
          <p>No hay reservas esta semana{filtroArea ? ` para ${filtroArea}` : ''}.</p>
        </div>
      )}

      {/* Modal nueva reserva */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nueva reserva</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={guardar}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}

                <div className="form-row">
                  <div className="form-group">
                    <label>Área *</label>
                    <select value={form.area} onChange={e => {
                      const a = e.target.value;
                      setForm(f => ({ ...f, area: a }));
                      if (form.fecha) consultarDisponibilidad(a, form.fecha);
                    }}>
                      {AREAS.map(a => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Fecha *</label>
                    <input type="date" required value={form.fecha} onChange={e => {
                      const f = e.target.value;
                      setForm(prev => ({ ...prev, fecha: f }));
                      consultarDisponibilidad(form.area, f);
                    }} />
                  </div>
                </div>

                {/* Horarios ocupados */}
                {conflictos.length > 0 && (
                  <div style={{ background: 'var(--amber-100)', border: '1px solid #fcd34d', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 12 }}>
                    <strong>⚠️ Horarios ya ocupados ese día:</strong>
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {conflictos.map(c => (
                        <span key={c.id} style={{ background: 'white', padding: '2px 8px', borderRadius: 4, border: '1px solid #fcd34d' }}>
                          {c.horaInicio}–{c.horaFin} (Unidad {c.unidad?.numero})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {form.fecha && conflictos.length === 0 && (
                  <div style={{ background: 'var(--green-100)', border: '1px solid #86efac', borderRadius: 6, padding: '7px 12px', marginBottom: 12, fontSize: 12, color: 'var(--green-600)' }}>
                    ✓ Área disponible ese día
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Hora inicio *</label>
                    <input type="time" required value={form.horaInicio} onChange={e => setForm(f => ({ ...f, horaInicio: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Hora fin *</label>
                    <input type="time" required value={form.horaFin} onChange={e => setForm(f => ({ ...f, horaFin: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Unidad *</label>
                  <select required value={form.unidadId} onChange={e => setForm(f => ({ ...f, unidadId: e.target.value }))}>
                    <option value="">-- Seleccionar unidad --</option>
                    {unidades.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.numero}{u.propietario ? ` — ${u.propietario.nombre}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Notas</label>
                  <input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Ej: Cumpleaños, capacidad 30 personas" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Reservar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
