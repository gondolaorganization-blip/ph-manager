import { useEffect, useState } from 'react';
import axios from 'axios';
import { usePortalAuth } from '../../context/PortalAuthContext';

const ESTADOS_COLOR = {
  PENDIENTE: { bg: '#fef9c3', color: '#854d0e' },
  'LLEGÓ':   { bg: '#dcfce7', color: '#166534' },
  NO_LLEGÓ:  { bg: '#fee2e2', color: '#991b1b' },
  CANCELADA: { bg: '#f1f5f9', color: '#475569' },
};

const fmtFecha = (d) => d ? new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-PA') : '';

const initForm = { nombreVisitante: '', fechaVisita: '', horaEsperada: '', placa: '', cantidadPersonas: 1, notas: '' };

export default function PortalVisitasPage() {
  const { token, propietario } = usePortalAuth();
  const edificioId = propietario?.unidad?.edificioId;

  const [visitas,   setVisitas]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);   // 'crear' | 'editar' | false
  const [editando,  setEditando]  = useState(null);
  const [form,      setForm]      = useState(initForm);
  const [guardando, setGuardando] = useState(false);
  const [error,     setError]     = useState('');

  const api = { headers: { Authorization: `Bearer ${token}` } };

  async function cargar() {
    setLoading(true);
    try {
      const { data } = await axios.get(`/api/portal/${edificioId}/visitas`, api);
      setVisitas(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { if (edificioId) cargar(); }, [edificioId]);

  function abrirCrear() {
    setForm(initForm);
    setEditando(null);
    setError('');
    setModal('crear');
  }

  function abrirEditar(v) {
    setForm({
      nombreVisitante:  v.nombreVisitante,
      fechaVisita:      v.fechaVisita?.slice(0, 10) ?? '',
      horaEsperada:     v.horaEsperada  ?? '',
      placa:            v.placa         ?? '',
      cantidadPersonas: v.cantidadPersonas,
      notas:            v.notas         ?? '',
    });
    setEditando(v);
    setError('');
    setModal('editar');
  }

  async function guardar() {
    if (!form.nombreVisitante || !form.fechaVisita) { setError('Nombre y fecha son requeridos'); return; }
    setGuardando(true);
    setError('');
    try {
      if (modal === 'crear') {
        await axios.post(`/api/portal/${edificioId}/visitas`, form, api);
      } else {
        await axios.put(`/api/portal/${edificioId}/visitas/${editando.id}`, form, api);
      }
      setModal(false);
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function cancelar(id) {
    if (!confirm('¿Cancelar esta visita?')) return;
    try {
      await axios.delete(`/api/portal/${edificioId}/visitas/${id}`, api);
      cargar();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al cancelar');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Mis Visitas</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Registra las visitas que esperas</p>
        </div>
        <button
          onClick={abrirCrear}
          style={{ padding: '10px 20px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
        >
          + Nueva visita
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#64748b' }}>Cargando...</p>
      ) : visitas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚶</div>
          <p>No tienes visitas registradas</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visitas.map(v => {
            const col = ESTADOS_COLOR[v.estado] ?? { bg: '#f1f5f9', color: '#475569' };
            return (
              <div key={v.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{v.nombreVisitante}</span>
                    <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: col.bg, color: col.color }}>
                      {v.estado}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span>📅 {fmtFecha(v.fechaVisita)}</span>
                    {v.horaEsperada && <span>🕐 {v.horaEsperada}</span>}
                    {v.placa && <span>🚗 {v.placa}</span>}
                    <span>👥 {v.cantidadPersonas} persona{v.cantidadPersonas !== 1 ? 's' : ''}</span>
                  </div>
                  {v.notas && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{v.notas}</div>}
                </div>
                {v.estado === 'PENDIENTE' && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => abrirEditar(v)}
                      style={{ padding: '6px 14px', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                      Editar
                    </button>
                    <button onClick={() => cancelar(v.id)}
                      style={{ padding: '6px 14px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700 }}>
              {modal === 'crear' ? 'Registrar Visita' : 'Editar Visita'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Nombre del visitante *">
                <input value={form.nombreVisitante} onChange={e => setForm(f => ({ ...f, nombreVisitante: e.target.value }))}
                  style={inputStyle} placeholder="Juan Pérez" />
              </Field>
              <Field label="Fecha de visita *">
                <input type="date" value={form.fechaVisita} onChange={e => setForm(f => ({ ...f, fechaVisita: e.target.value }))}
                  style={inputStyle} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Hora esperada">
                  <input type="time" value={form.horaEsperada} onChange={e => setForm(f => ({ ...f, horaEsperada: e.target.value }))}
                    style={inputStyle} />
                </Field>
                <Field label="Cantidad de personas">
                  <input type="number" min={1} max={20} value={form.cantidadPersonas}
                    onChange={e => setForm(f => ({ ...f, cantidadPersonas: parseInt(e.target.value) || 1 }))}
                    style={inputStyle} />
                </Field>
              </div>
              <Field label="Placa del vehículo">
                <input value={form.placa} onChange={e => setForm(f => ({ ...f, placa: e.target.value.toUpperCase() }))}
                  style={inputStyle} placeholder="ABC-1234" />
              </Field>
              <Field label="Notas">
                <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Información adicional..." />
              </Field>
            </div>

            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginTop: 14 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)}
                style={{ padding: '9px 20px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando}
                style={{ padding: '9px 20px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, opacity: guardando ? .7 : 1 }}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = { width: '100%', padding: '9px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' };

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
