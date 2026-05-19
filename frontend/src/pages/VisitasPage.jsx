import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import { pdfUrl } from '../hooks/usePdfUrl';

const ESTADOS = ['PENDIENTE', 'LLEGÓ', 'NO_LLEGÓ', 'CANCELADA'];

const ESTADO_STYLE = {
  PENDIENTE: { bg: '#fef9c3', color: '#854d0e' },
  'LLEGÓ':   { bg: '#dcfce7', color: '#166534' },
  NO_LLEGÓ:  { bg: '#fee2e2', color: '#991b1b' },
  CANCELADA: { bg: '#f1f5f9', color: '#475569' },
};

const fmtFecha = (d) => d ? new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-PA') : '—';
const fmtHora  = (d) => d ? new Date(d).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }) : '—';
const hoy      = () => new Date().toISOString().slice(0, 10);

export default function VisitasPage() {
  const { edificioId } = useParams();

  const [visitas,  setVisitas]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [fecha,    setFecha]    = useState(hoy());
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [modalEstado, setModalEstado] = useState(null); // { visita }
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [guardando,   setGuardando]   = useState(false);

  useEffect(() => { cargar(); }, [edificioId, fecha]);

  async function cargar() {
    setLoading(true);
    try {
      const params = fecha ? `?fecha=${fecha}` : '';
      const { data } = await api.get(`/edificios/${edificioId}/visitas${params}`);
      setVisitas(data);
    } finally { setLoading(false); }
  }

  function limpiarFecha() {
    setFecha('');
  }

  async function cambiarEstado() {
    if (!nuevoEstado) return;
    setGuardando(true);
    try {
      await api.put(`/edificios/${edificioId}/visitas/${modalEstado.id}/estado`, { estado: nuevoEstado });
      setModalEstado(null);
      cargar();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al cambiar estado');
    } finally { setGuardando(false); }
  }

  const filtradas = visitas.filter(v => {
    if (filtroEstado && v.estado !== filtroEstado) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return (
        v.nombreVisitante.toLowerCase().includes(q) ||
        v.unidad?.numero?.toLowerCase().includes(q) ||
        v.propietario?.nombre?.toLowerCase().includes(q) ||
        v.placa?.toLowerCase().includes(q) ||
        v.cedulaVisitante?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = ESTADOS.reduce((acc, e) => {
    acc[e] = visitas.filter(v => v.estado === e).length;
    return acc;
  }, {});

  return (
    <div className="page">
      <div className="page-header">
        <h1>Visitas</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            style={{ fontSize: 13, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--slate-300)' }} />
          {fecha && (
            <button className="btn btn-ghost btn-sm" onClick={limpiarFecha}>Ver todas</button>
          )}
          <a
            className="btn btn-ghost btn-sm"
            href={pdfUrl(`/api/edificios/${edificioId}/visitas.xlsx${fecha ? `?fecha=${fecha}` : ''}`)}
            download
          >
            📊 Excel
          </a>
        </div>
      </div>

      {/* Stats del día */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {ESTADOS.map(e => {
          const s = ESTADO_STYLE[e];
          return (
            <div key={e} className="stat-card" style={{ cursor: 'pointer', outline: filtroEstado === e ? `2px solid #1e3a5f` : 'none' }}
              onClick={() => setFiltroEstado(f => f === e ? '' : e)}>
              <div className="stat-label">{e}</div>
              <div className="stat-value" style={{ color: s.color, fontSize: 26 }}>{counts[e]}</div>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="Buscar visitante, unidad, propietario, placa…"
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ flex: 1, minWidth: 220, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--slate-200)', fontSize: 13 }}
        />
        {(filtroEstado || busqueda) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setFiltroEstado(''); setBusqueda(''); }}>
            Limpiar filtros
          </button>
        )}
        <span style={{ fontSize: 13, color: 'var(--slate-400)', marginLeft: 'auto' }}>
          {filtradas.length} visita{filtradas.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Visitante</th>
                <th>Unidad</th>
                <th>Propietario</th>
                <th>Fecha</th>
                <th>Hora esp.</th>
                <th>Placa</th>
                <th>Personas</th>
                <th>Estado</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', padding: 32, color: 'var(--slate-400)' }}>Cargando…</td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', padding: 32, color: 'var(--slate-400)' }}>Sin visitas{fecha ? ` para ${fmtFecha(fecha)}` : ''}</td></tr>
              ) : filtradas.map(v => {
                const s = ESTADO_STYLE[v.estado] ?? ESTADO_STYLE.PENDIENTE;
                return (
                  <tr key={v.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{v.nombreVisitante}</div>
                      {v.cedulaVisitante && <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>ID: {v.cedulaVisitante}</div>}
                      {v.fotoDocumento && (
                        <a href={v.fotoDocumento} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--blue-600)' }}>Ver foto</a>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>{v.unidad?.numero}</td>
                    <td style={{ fontSize: 13, color: 'var(--slate-600)' }}>{v.propietario?.nombre}</td>
                    <td style={{ fontSize: 13 }}>{fmtFecha(v.fechaVisita)}</td>
                    <td style={{ fontSize: 13 }}>{v.horaEsperada || '—'}</td>
                    <td style={{ fontSize: 13 }}>{v.placa || '—'}</td>
                    <td style={{ fontSize: 13, textAlign: 'center' }}>{v.cantidadPersonas}</td>
                    <td>
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>
                        {v.estado}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>{fmtHora(v.entrada)}</td>
                    <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>{fmtHora(v.salida)}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm"
                        onClick={() => { setModalEstado(v); setNuevoEstado(v.estado); }}>
                        Estado
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal cambiar estado */}
      {modalEstado && (
        <div className="modal-backdrop" onClick={() => setModalEstado(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cambiar estado — {modalEstado.nombreVisitante}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalEstado(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--slate-500)' }}>
                Unidad {modalEstado.unidad?.numero} · {fmtFecha(modalEstado.fechaVisita)}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ESTADOS.map(e => {
                  const s = ESTADO_STYLE[e];
                  return (
                    <label key={e} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      border: `2px solid ${nuevoEstado === e ? s.color : 'var(--slate-200)'}`,
                      background: nuevoEstado === e ? s.bg : '#fff' }}>
                      <input type="radio" name="estado" value={e} checked={nuevoEstado === e} onChange={() => setNuevoEstado(e)} style={{ accentColor: s.color }} />
                      <span style={{ fontWeight: 600, fontSize: 14, color: s.color }}>{e}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalEstado(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={guardando || nuevoEstado === modalEstado.estado} onClick={cambiarEstado}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
