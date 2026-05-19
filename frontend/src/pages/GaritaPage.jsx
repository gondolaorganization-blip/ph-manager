import { useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const ESTADO_COL = {
  PENDIENTE: { bg: '#fef9c3', color: '#854d0e', label: 'Pendiente' },
  'LLEGÓ':   { bg: '#dcfce7', color: '#166534', label: 'Llegó' },
};

const fmtFecha = (d) => {
  const date = new Date(d.slice(0, 10) + 'T12:00:00');
  const hoy  = new Date(); hoy.setHours(0, 0, 0, 0);
  const man  = new Date(hoy); man.setDate(man.getDate() + 1);
  const pas  = new Date(hoy); pas.setDate(pas.getDate() + 2);
  if (date >= hoy && date < man) return 'Hoy';
  if (date >= man && date < pas) return 'Mañana';
  return date.toLocaleDateString('es-PA');
};

export default function GaritaPage() {
  const { edificioId } = useParams();

  const [pin,          setPin]          = useState('');
  const [data,         setData]         = useState(null);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [modalEntrada, setModalEntrada] = useState(null); // visita completa
  const [cedula,       setCedula]       = useState('');
  const [placaReal,    setPlacaReal]    = useState('');
  const [fotoUrl,      setFotoUrl]      = useState('');
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  async function autenticar(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data: d } = await axios.get(`/api/garita/${edificioId}?pin=${pin}`);
      setData(d);
    } catch (err) {
      setError(err.response?.data?.error || 'PIN inválido');
    } finally {
      setLoading(false);
    }
  }

  function abrirEntrada(visita) {
    setCedula('');
    setPlacaReal(visita.placa ?? '');
    setFotoUrl('');
    setModalEntrada(visita);
  }

  async function subirFoto(file) {
    if (!file) return;
    setSubiendoFoto(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await axios.post(`/api/garita/${edificioId}/upload?pin=${pin}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFotoUrl(data.url);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al subir foto');
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function confirmarEntrada() {
    try {
      const body = { pin };
      if (cedula.trim())   body.cedulaVisitante = cedula.trim();
      if (placaReal.trim()) body.placa          = placaReal.trim().toUpperCase();
      if (fotoUrl)          body.fotoDocumento   = fotoUrl;
      const { data: v } = await axios.put(`/api/garita/${edificioId}/visitas/${modalEntrada.id}/entrada`, body);
      setData(prev => ({ ...prev, visitas: prev.visitas.map(x => x.id === modalEntrada.id ? v : x) }));
    } catch (err) {
      alert(err.response?.data?.error || 'Error');
    }
    setModalEntrada(null);
  }

  async function marcarSalida(visitaId) {
    try {
      const { data: v } = await axios.put(`/api/garita/${edificioId}/visitas/${visitaId}/salida`, { pin });
      setData(prev => ({ ...prev, visitas: prev.visitas.map(x => x.id === visitaId ? v : x) }));
    } catch (err) {
      alert(err.response?.data?.error || 'Error');
    }
  }

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#1e293b', borderRadius: 16, padding: 40, width: '100%', maxWidth: 360, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
          <h1 style={{ color: '#f8fafc', fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>Garita de Seguridad</h1>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 28 }}>Ingresa el PIN para acceder</p>
          <form onSubmit={autenticar}>
            <input
              type="password" inputMode="numeric" pattern="\d*" autoFocus
              value={pin} onChange={e => setPin(e.target.value)}
              placeholder="PIN numérico"
              style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '2px solid #334155', borderRadius: 10, color: '#f8fafc', fontSize: 20, textAlign: 'center', letterSpacing: 6, boxSizing: 'border-box', marginBottom: 14 }}
            />
            {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 14 }}>{error}</div>}
            <button type="submit" disabled={loading || !pin}
              style={{ width: '100%', padding: 14, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 16, cursor: 'pointer', opacity: (loading || !pin) ? .6 : 1 }}>
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const hoyVisitas   = data.visitas.filter(v => fmtFecha(v.fechaVisita) === 'Hoy');
  const manVisitas   = data.visitas.filter(v => fmtFecha(v.fechaVisita) === 'Mañana');

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', padding: 20 }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, paddingTop: 8 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Garita — {data.edificio?.nombre}</h1>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>Visitas de hoy y mañana</p>
          </div>
          <button onClick={() => { setData(null); setPin(''); }}
            style={{ padding: '8px 16px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
            Salir
          </button>
        </div>

        {[['Hoy', hoyVisitas], ['Mañana', manVisitas]].map(([titulo, lista]) => (
          <div key={titulo} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>{titulo}</h2>
            {lista.length === 0 ? (
              <p style={{ color: '#475569', fontSize: 14 }}>Sin visitas registradas</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lista.map(v => {
                  const col = ESTADO_COL[v.estado] ?? { bg: '#1e293b', color: '#94a3b8', label: v.estado };
                  return (
                    <div key={v.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '14px 18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: 15 }}>{v.nombreVisitante}</span>
                            <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: col.bg, color: col.color }}>{col.label}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 14, fontSize: 13, color: '#94a3b8', flexWrap: 'wrap' }}>
                            <span>🏢 Unidad {v.unidad?.numero}</span>
                            {v.horaEsperada && <span>🕐 {v.horaEsperada}</span>}
                            {v.placa && <span>🚗 {v.placa}</span>}
                            <span>👥 {v.cantidadPersonas}</span>
                          </div>
                          <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>Propietario: {v.propietario?.nombre}</div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                          {v.estado === 'PENDIENTE' && (
                            <button onClick={() => abrirEntrada(v)}
                              style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                              Marcar entrada
                            </button>
                          )}
                          {v.estado === 'LLEGÓ' && !v.salida && (
                            <button onClick={() => marcarSalida(v.id)}
                              style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                              Marcar salida
                            </button>
                          )}
                          {v.salida && <span style={{ fontSize: 11, color: '#22c55e' }}>Salida registrada</span>}
                          {v.cedulaVisitante && <span style={{ fontSize: 11, color: '#94a3b8' }}>ID: {v.cedulaVisitante}</span>}
                          {v.fotoDocumento && (
                            <a href={v.fotoDocumento} target="_blank" rel="noreferrer"
                              style={{ fontSize: 11, color: '#60a5fa' }}>Ver foto doc.</a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal marcar entrada */}
      {modalEntrada && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 24, width: '100%', maxWidth: 420, maxHeight: '95vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 2px', color: '#f8fafc', fontSize: 17, fontWeight: 700 }}>
              Registrar entrada
            </h2>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 13 }}>
              {modalEntrada.nombreVisitante} · Unidad {modalEntrada.unidad?.numero}
            </p>

            {/* Cédula / pasaporte */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Cédula o pasaporte</label>
              <input
                autoFocus
                value={cedula}
                onChange={e => setCedula(e.target.value)}
                placeholder="Ej. 8-123-4567 o PE123456"
                style={inputStyle}
              />
            </div>

            {/* Placa */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>
                Placa del vehículo
                {modalEntrada.placa && <span style={{ color: '#475569', fontWeight: 400, marginLeft: 6 }}>(esperada: {modalEntrada.placa})</span>}
              </label>
              <input
                value={placaReal}
                onChange={e => setPlacaReal(e.target.value.toUpperCase())}
                placeholder="ABC-1234"
                style={inputStyle}
              />
            </div>

            {/* Foto del documento */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Foto del documento de identidad</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, border: '2px dashed #334155', borderRadius: 10, padding: '16px 10px', cursor: 'pointer', color: '#64748b', fontSize: 13, textAlign: 'center' }}>
                  {subiendoFoto ? (
                    <span>Subiendo...</span>
                  ) : fotoUrl ? (
                    <span style={{ color: '#22c55e' }}>✓ Foto cargada</span>
                  ) : (
                    <>
                      <span style={{ fontSize: 22 }}>📷</span>
                      <span>Capturar / seleccionar foto</span>
                    </>
                  )}
                  <input
                    type="file" accept="image/*" capture="environment"
                    style={{ display: 'none' }}
                    onChange={e => subirFoto(e.target.files[0])}
                  />
                </label>
                {fotoUrl && (
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={fotoUrl} alt="Documento" style={{ width: 90, height: 70, objectFit: 'cover', borderRadius: 8, border: '1px solid #334155' }} />
                    <button onClick={() => setFotoUrl('')}
                      style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, background: '#dc2626', border: 'none', borderRadius: '50%', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModalEntrada(null)}
                style={{ flex: 1, padding: '12px', background: '#334155', color: '#cbd5e1', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 14 }}>
                Cancelar
              </button>
              <button onClick={confirmarEntrada} disabled={subiendoFoto}
                style={{ flex: 2, padding: '12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 14, opacity: subiendoFoto ? .6 : 1 }}>
                Confirmar entrada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' };
const inputStyle = { width: '100%', padding: '11px 14px', background: '#0f172a', border: '1.5px solid #334155', borderRadius: 9, color: '#f8fafc', fontSize: 15, boxSizing: 'border-box' };
