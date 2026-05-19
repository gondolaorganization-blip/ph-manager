import { useEffect, useState } from 'react';
import axios from 'axios';
import { usePortalAuth } from '../../context/PortalAuthContext';

const AREAS = ['SALON', 'PISCINA', 'GIMNASIO', 'TERRAZA', 'BBQ', 'OTRO'];
const AREA_ICON  = { SALON: '🎉', PISCINA: '🏊', GIMNASIO: '🏋️', TERRAZA: '🌿', BBQ: '🔥', OTRO: '📍' };
const AREA_LABEL = { SALON: 'Salón', PISCINA: 'Piscina', GIMNASIO: 'Gimnasio', TERRAZA: 'Terraza', BBQ: 'BBQ', OTRO: 'Otro' };

const ESTADO_STYLE = {
  PENDIENTE: { bg: '#fef9c3', color: '#854d0e' },
  APROBADA:  { bg: '#dcfce7', color: '#166534' },
  CANCELADA: { bg: '#f1f5f9', color: '#64748b' },
};

const fmtFecha = (d) => new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-PA', { weekday: 'short', day: '2-digit', month: 'short' });
const hoy = () => new Date().toISOString().slice(0, 10);

const initForm = { area: 'SALON', fecha: hoy(), horaInicio: '09:00', horaFin: '11:00', notas: '' };

export default function PortalReservasPage() {
  const { token, propietario } = usePortalAuth();
  const edificioId = propietario?.unidad?.edificioId;
  const hdrs = { headers: { Authorization: `Bearer ${token}` } };

  const [reservas,     setReservas]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(false);
  const [form,         setForm]         = useState(initForm);
  const [ocupado,      setOcupado]      = useState([]);
  const [loadingDisp,  setLoadingDisp]  = useState(false);
  const [guardando,    setGuardando]    = useState(false);
  const [error,        setError]        = useState('');
  const [tab,          setTab]          = useState('proximas'); // 'proximas' | 'historial'

  useEffect(() => { if (edificioId) cargar(); }, [edificioId]);

  async function cargar() {
    setLoading(true);
    try {
      const { data } = await axios.get(`/api/portal/${edificioId}/reservas`, hdrs);
      setReservas(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function consultarDisponibilidad(area, fecha) {
    if (!area || !fecha) return;
    setLoadingDisp(true);
    setOcupado([]);
    try {
      const { data } = await axios.get(
        `/api/portal/${edificioId}/reservas/disponibilidad?area=${area}&fecha=${fecha}`, hdrs
      );
      setOcupado(data.ocupado ?? []);
    } catch { /* ignore */ }
    finally { setLoadingDisp(false); }
  }

  function abrirModal() {
    setForm(initForm);
    setOcupado([]);
    setError('');
    setModal(true);
    consultarDisponibilidad(initForm.area, initForm.fecha);
  }

  function cambiarForm(key, val) {
    const next = { ...form, [key]: val };
    setForm(next);
    if (key === 'area' || key === 'fecha') {
      consultarDisponibilidad(next.area, next.fecha);
    }
  }

  async function guardar() {
    if (!form.fecha || !form.horaInicio || !form.horaFin) {
      setError('Completa todos los campos requeridos'); return;
    }
    setError(''); setGuardando(true);
    try {
      await axios.post(`/api/portal/${edificioId}/reservas`, form, hdrs);
      setModal(false);
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally { setGuardando(false); }
  }

  async function cancelar(id) {
    if (!confirm('¿Cancelar esta reserva?')) return;
    try {
      await axios.delete(`/api/portal/${edificioId}/reservas/${id}`, hdrs);
      cargar();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al cancelar');
    }
  }

  const hoyStr = hoy();
  const proximas  = reservas.filter(r => r.fecha >= hoyStr && r.estado !== 'CANCELADA');
  const historial = reservas.filter(r => r.fecha <  hoyStr || r.estado === 'CANCELADA');
  const lista     = tab === 'proximas' ? proximas : historial;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Reservas de Áreas Comunes</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Reserva salón, piscina, BBQ y más</p>
        </div>
        <button onClick={abrirModal}
          style={{ padding: '10px 20px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          + Nueva reserva
        </button>
      </div>

      {/* Áreas disponibles */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        {AREAS.map(a => (
          <button key={a} onClick={() => { cambiarForm('area', a); setModal(true); setForm(f => ({ ...f, area: a })); consultarDisponibilidad(a, form.fecha); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#0f172a' }}>
            <span>{AREA_ICON[a]}</span>{AREA_LABEL[a]}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #e2e8f0', paddingBottom: 0 }}>
        {[['proximas', `Próximas (${proximas.length})`], ['historial', `Historial (${historial.length})`]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: tab === key ? 700 : 400, color: tab === key ? '#1e3a5f' : '#64748b', borderBottom: tab === key ? '2px solid #1e3a5f' : '2px solid transparent', marginBottom: -2 }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#64748b' }}>Cargando...</p>
      ) : lista.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📅</div>
          <p>{tab === 'proximas' ? 'No tienes reservas próximas' : 'Sin historial de reservas'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lista.map(r => {
            const s = ESTADO_STYLE[r.estado] ?? ESTADO_STYLE.PENDIENTE;
            return (
              <div key={r.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 28, flexShrink: 0 }}>{AREA_ICON[r.area]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{AREA_LABEL[r.area]}</span>
                    <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>
                      {r.estado}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <span>📅 {fmtFecha(r.fecha)}</span>
                    <span>🕐 {r.horaInicio} – {r.horaFin}</span>
                  </div>
                  {r.notas && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{r.notas}</div>}
                </div>
                {r.estado !== 'CANCELADA' && new Date(r.fecha.slice(0, 10) + 'T12:00:00') >= new Date(hoyStr + 'T00:00:00') && (
                  <button onClick={() => cancelar(r.id)}
                    style={{ padding: '7px 14px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                    Cancelar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal nueva reserva */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>Nueva Reserva</h2>

            {/* Área */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Área</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {AREAS.map(a => (
                  <button key={a} onClick={() => cambiarForm('area', a)}
                    style={{ padding: '7px 14px', borderRadius: 8, border: '2px solid', fontSize: 13, cursor: 'pointer', fontWeight: 500,
                      borderColor: form.area === a ? '#1e3a5f' : '#e2e8f0',
                      background:  form.area === a ? '#eff6ff' : '#fff',
                      color:       form.area === a ? '#1e3a5f' : '#374151' }}>
                    {AREA_ICON[a]} {AREA_LABEL[a]}
                  </button>
                ))}
              </div>
            </div>

            {/* Fecha */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Fecha</label>
              <input type="date" min={hoy()} value={form.fecha} onChange={e => cambiarForm('fecha', e.target.value)} style={inp} />
            </div>

            {/* Disponibilidad */}
            <div style={{ marginBottom: 16, background: '#f8fafc', borderRadius: 10, padding: '12px 14px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Horarios ocupados ese día
              </div>
              {loadingDisp ? (
                <span style={{ fontSize: 13, color: '#94a3b8' }}>Consultando...</span>
              ) : ocupado.length === 0 ? (
                <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>✓ Disponible todo el día</span>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ocupado.map(o => (
                    <span key={o.id} style={{ padding: '3px 10px', background: '#fee2e2', color: '#dc2626', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                      {o.horaInicio}–{o.horaFin}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Horas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={lbl}>Hora inicio</label>
                <input type="time" value={form.horaInicio} onChange={e => setForm(f => ({ ...f, horaInicio: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Hora fin</label>
                <input type="time" value={form.horaFin} onChange={e => setForm(f => ({ ...f, horaFin: e.target.value }))} style={inp} />
              </div>
            </div>

            {/* Notas */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Notas (opcional)</label>
              <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Ocasión, número de personas, etc." />
            </div>

            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 14 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)}
                style={{ padding: '9px 20px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando}
                style={{ padding: '9px 20px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, opacity: guardando ? .7 : 1 }}>
                {guardando ? 'Guardando...' : 'Solicitar reserva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 };
const inp = { width: '100%', padding: '9px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' };
