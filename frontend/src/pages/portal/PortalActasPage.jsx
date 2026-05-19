import { useEffect, useState } from 'react';
import axios from 'axios';
import { usePortalAuth } from '../../context/PortalAuthContext';

const TIPO_STYLE = {
  ORDINARIA:      { bg: '#eff6ff', color: '#1d4ed8', label: 'Ordinaria' },
  EXTRAORDINARIA: { bg: '#fff7ed', color: '#c2410c', label: 'Extraordinaria' },
};

const ESTADO_ASIST = {
  PRESENTE:     { bg: '#f0fdf4', color: '#15803d', label: 'Presente' },
  REPRESENTADO: { bg: '#eff6ff', color: '#1d4ed8', label: 'Representado' },
  AUSENTE:      { bg: '#f8fafc', color: '#64748b', label: 'Ausente' },
};

const RESULTADO_STYLE = {
  APROBADA: { color: '#15803d' },
  APROBADO: { color: '#15803d' },
  NEGADA:   { color: '#dc2626' },
  NEGADO:   { color: '#dc2626' },
  PENDIENTE:{ color: '#d97706' },
  INFORMATIVO: { color: '#475569' },
};

const CARGO_LABEL = {
  PRESIDENTE:     'Presidente',
  VICEPRESIDENTE: 'Vicepresidente',
  SECRETARIO:     'Secretario',
  TESORERO:       'Tesorero',
  VOCAL:          'Vocal',
  DIRECTOR:       'Director',
};

function fmtFecha(d) {
  return new Date(d).toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' });
}

/* ── Asamblea card ─────────────────────────────────────────── */
function CardAsamblea({ acta, propietarioUnidadId }) {
  const [abierto, setAbierto] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const { token, propietario } = usePortalAuth();
  const edificioId = propietario?.unidad?.edificioId;

  const q          = Number(acta.quorum);
  const hayQuorum  = q >= 50;
  const tipo       = TIPO_STYLE[acta.tipo] ?? TIPO_STYLE.ORDINARIA;
  const miAsist    = acta.asistencias?.[0];
  const estadoAsist = ESTADO_ASIST[miAsist?.estado ?? 'AUSENTE'];
  const aprobadas  = acta.propuestas?.filter(p => p.resultado === 'APROBADA').length ?? 0;
  const totalProp  = acta.propuestas?.length ?? 0;

  async function descargar() {
    setDescargando(true);
    try {
      const { data } = await axios.get(
        `/api/portal/${edificioId}/actas/${acta.id}/docx`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' },
      );
      const url  = URL.createObjectURL(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
      const link = document.createElement('a');
      link.href  = url;
      link.download = `Acta_${acta.numero ?? 'SN'}_${acta.anio ?? ''}.docx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch { alert('Error al descargar el documento'); }
    finally { setDescargando(false); }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>
              N°{acta.numero ?? 'S/N'}{acta.anio ? `/${acta.anio}` : ''}
            </span>
            <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: tipo.bg, color: tipo.color }}>
              {tipo.label}
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#475569' }}>
            {fmtFecha(acta.fecha)}
            {acta.lugar && <span style={{ marginLeft: 8, color: '#94a3b8' }}>· {acta.lugar}</span>}
          </div>
        </div>

        <div style={{ textAlign: 'center', minWidth: 70 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: hayQuorum ? '#16a34a' : '#dc2626' }}>{q.toFixed(1)}%</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>quórum</div>
        </div>

        <div style={{ textAlign: 'center', minWidth: 90 }}>
          <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: estadoAsist.bg, color: estadoAsist.color }}>
            {estadoAsist.label}
          </span>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>mi asistencia</div>
        </div>

        {totalProp > 0 && (
          <div style={{ textAlign: 'center', minWidth: 70 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{aprobadas}/{totalProp}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>aprobadas</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {totalProp > 0 && (
            <button onClick={() => setAbierto(v => !v)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: abierto ? '#f1f5f9' : '#fff', cursor: 'pointer', fontSize: 12, color: '#475569' }}>
              {abierto ? 'Cerrar' : 'Ver propuestas'}
            </button>
          )}
          {acta.documento && (
            <a href={acta.documento} target="_blank" rel="noopener noreferrer"
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, color: '#475569', textDecoration: 'none' }}>
              📎 PDF firmado
            </a>
          )}
          <button onClick={descargar} disabled={descargando}
            style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#1e3a5f', color: '#fff', cursor: 'pointer', fontSize: 12, opacity: descargando ? 0.6 : 1 }}>
            {descargando ? '…' : '⬇ Word'}
          </button>
        </div>
      </div>

      {abierto && acta.propuestas?.length > 0 && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 20px', background: '#f8fafc' }}>
          {(acta.presidente || acta.secretario) && (
            <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#475569', marginBottom: 12 }}>
              {acta.presidente && <span><strong>Presidente:</strong> {acta.presidente}</span>}
              {acta.secretario && <span><strong>Secretario:</strong> {acta.secretario}</span>}
            </div>
          )}
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '.05em', marginBottom: 8 }}>Propuestas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {acta.propuestas.map((prop, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13 }}>
                <span style={{ color: '#94a3b8', minWidth: 20 }}>{prop.orden}.</span>
                <span style={{ flex: 1, color: '#374151' }}>{prop.descripcion}</span>
                <span style={{ fontWeight: 700, fontSize: 12, ...(RESULTADO_STYLE[prop.resultado] ?? {}) }}>{prop.resultado}</span>
              </div>
            ))}
          </div>
          {acta.acuerdos && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>Acuerdos adicionales</div>
              <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{acta.acuerdos}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── JD card ───────────────────────────────────────────────── */
function CardJD({ acta, token, edificioId }) {
  const [abierto, setAbierto]       = useState(false);
  const [descargando, setDescargando] = useState(false);

  const presentes  = acta.directores?.filter(d => d.estado === 'PRESENTE').length ?? 0;
  const totalDir   = acta.directores?.length ?? 0;
  const q          = totalDir ? +(presentes / totalDir * 100).toFixed(1) : 0;
  const hayQuorum  = q >= 50;
  const totalPuntos = acta.puntos?.length ?? 0;

  async function descargar() {
    setDescargando(true);
    try {
      const { data } = await axios.get(
        `/api/portal/${edificioId}/actas-jd/${acta.id}/docx`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' },
      );
      const url  = URL.createObjectURL(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
      const link = document.createElement('a');
      link.href  = url;
      link.download = `ActaJD_${acta.numero ?? 'SN'}_${acta.anio ?? ''}.docx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch { alert('Error al descargar el documento'); }
    finally { setDescargando(false); }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>
              N°{acta.numero ?? 'S/N'}{acta.anio ? `/${acta.anio}` : ''}
            </span>
            <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#f0fdf4', color: '#15803d' }}>
              Junta Directiva
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#475569' }}>
            {fmtFecha(acta.fecha)}
            {acta.lugar && <span style={{ marginLeft: 8, color: '#94a3b8' }}>· {acta.lugar}</span>}
          </div>
        </div>

        {totalDir > 0 && (
          <div style={{ textAlign: 'center', minWidth: 70 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: hayQuorum ? '#16a34a' : '#dc2626' }}>{q}%</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>quórum JD</div>
          </div>
        )}

        {totalPuntos > 0 && (
          <div style={{ textAlign: 'center', minWidth: 70 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{totalPuntos}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>puntos</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {totalPuntos > 0 && (
            <button onClick={() => setAbierto(v => !v)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: abierto ? '#f1f5f9' : '#fff', cursor: 'pointer', fontSize: 12, color: '#475569' }}>
              {abierto ? 'Cerrar' : 'Ver puntos'}
            </button>
          )}
          {acta.documento && (
            <a href={acta.documento} target="_blank" rel="noopener noreferrer"
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, color: '#475569', textDecoration: 'none' }}>
              📎 PDF firmado
            </a>
          )}
          <button onClick={descargar} disabled={descargando}
            style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#1e3a5f', color: '#fff', cursor: 'pointer', fontSize: 12, opacity: descargando ? 0.6 : 1 }}>
            {descargando ? '…' : '⬇ Word'}
          </button>
        </div>
      </div>

      {abierto && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 20px', background: '#f8fafc' }}>
          {acta.directores?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '.05em', marginBottom: 8 }}>Directores</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {acta.directores.map((d, i) => (
                  <span key={i} style={{
                    fontSize: 12, padding: '3px 10px', borderRadius: 8,
                    background: d.estado === 'PRESENTE' ? '#f0fdf4' : '#f8fafc',
                    color:      d.estado === 'PRESENTE' ? '#15803d' : '#64748b',
                    border: '1px solid #e2e8f0',
                  }}>
                    <strong>{CARGO_LABEL[d.cargo] ?? d.cargo}:</strong> {d.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}
          {acta.puntos?.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '.05em', marginBottom: 8 }}>Puntos del Acta</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {acta.puntos.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13 }}>
                    <span style={{ color: '#94a3b8', minWidth: 20 }}>{p.orden}.</span>
                    <span style={{ flex: 1, color: '#374151' }}>{p.descripcion}</span>
                    <span style={{ fontWeight: 700, fontSize: 12, ...(RESULTADO_STYLE[p.resultado] ?? {}) }}>{p.resultado}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {acta.acuerdos && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>Acuerdos</div>
              <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{acta.acuerdos}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────── */
export default function PortalActasPage() {
  const { token, propietario } = usePortalAuth();
  const edificioId = propietario?.unidad?.edificioId;

  const [tab,      setTab]     = useState('asamblea');
  const [actas,    setActas]   = useState([]);
  const [actasJD,  setActasJD] = useState([]);
  const [loading,  setLoading] = useState(true);

  useEffect(() => {
    if (!edificioId) return;
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(`/api/portal/${edificioId}/actas`,    { headers }),
      axios.get(`/api/portal/${edificioId}/actas-jd`, { headers }),
    ]).then(([r1, r2]) => {
      setActas(r1.data);
      setActasJD(r2.data);
    }).finally(() => setLoading(false));
  }, [edificioId, token]);

  if (loading) return <p style={{ color: '#64748b' }}>Cargando...</p>;

  const tabStyle = (active) => ({
    padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
    background: active ? '#1e3a5f' : 'transparent',
    color:      active ? '#fff'    : '#64748b',
  });

  const lista = tab === 'asamblea' ? actas : actasJD;

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Actas</h1>
      <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 14 }}>Actas de tu edificio</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f1f5f9', padding: 4, borderRadius: 10, width: 'fit-content' }}>
        <button style={tabStyle(tab === 'asamblea')} onClick={() => setTab('asamblea')}>
          Asamblea ({actas.length})
        </button>
        <button style={tabStyle(tab === 'jd')} onClick={() => setTab('jd')}>
          Junta Directiva ({actasJD.length})
        </button>
      </div>

      {lista.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
          <p>No hay actas registradas aún</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tab === 'asamblea'
            ? actas.map(a => <CardAsamblea key={a.id} acta={a} />)
            : actasJD.map(a => <CardJD key={a.id} acta={a} token={token} edificioId={edificioId} />)
          }
        </div>
      )}
    </div>
  );
}
