import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { usePortalAuth } from '../../context/PortalAuthContext';

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function hoy()         { return new Date().toISOString().slice(0, 10); }
function primerDiaAnio() { return `${new Date().getFullYear()}-01-01`; }
function fmt(n)        { return `$${Number(n).toLocaleString('es-PA', { minimumFractionDigits: 2 })}`; }

const ESTADO_STYLE = {
  PENDIENTE: { bg: '#fef9c3', color: '#854d0e', label: 'Pendiente' },
  VENCIDO:   { bg: '#fee2e2', color: '#991b1b', label: 'Vencido'   },
  PAGADO:    { bg: '#dcfce7', color: '#166534', label: 'Pagado'    },
};

export default function PortalEstadoCuentaPage() {
  const { token, propietario } = usePortalAuth();
  const edificioId = propietario?.unidad?.edificioId;

  const [pagos,       setPagos]       = useState([]);
  const [cuotasExt,      setCuotasExt]      = useState([]);
  const [uploadingExt,   setUploadingExt]   = useState(null); // pagoExtId
  const [uploadExtMsg,   setUploadExtMsg]   = useState({});
  const [loading,        setLoading]        = useState(true);
  const [uploading,   setUploading]   = useState(null); // pagoId
  const [uploadMsg,   setUploadMsg]   = useState({});   // { [pagoId]: {ok, msg} }
  const [verHistorial, setVerHistorial] = useState(false);
  const [verExtHistorial, setVerExtHistorial] = useState(false);

  const [desde,       setDesde]       = useState(primerDiaAnio());
  const [hasta,       setHasta]       = useState(hoy());
  const [descargando,       setDescargando]       = useState(false);
  const [descargandoRecibo, setDescargandoRecibo] = useState(null); // pagoId

  const fileRefs    = useRef({});
  const fileExtRefs = useRef({});

  useEffect(() => { if (edificioId) cargar(); }, [edificioId]);

  async function cargar() {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        axios.get(`/api/portal/${edificioId}/pagos`,      { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`/api/portal/${edificioId}/cuotas-ext`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setPagos(r1.data);
      setCuotasExt(r2.data);
    } finally { setLoading(false); }
  }

  function cargarPagos() { cargar(); }

  async function subirComprobanteExt(pagoExtId, file) {
    setUploadingExt(pagoExtId);
    setUploadExtMsg(m => ({ ...m, [pagoExtId]: null }));
    const fd = new FormData();
    fd.append('file', file);
    try {
      await axios.post(`/api/portal/${edificioId}/cuotas-ext/${pagoExtId}/comprobante`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      setUploadExtMsg(m => ({ ...m, [pagoExtId]: { ok: true, msg: 'Comprobante enviado' } }));
      cargar();
    } catch (err) {
      setUploadExtMsg(m => ({ ...m, [pagoExtId]: { ok: false, msg: err.response?.data?.error || 'Error al subir' } }));
    } finally { setUploadingExt(null); }
  }

  async function subirComprobante(pagoId, file) {
    setUploading(pagoId);
    setUploadMsg(m => ({ ...m, [pagoId]: null }));
    const fd = new FormData();
    fd.append('file', file);
    try {
      await axios.post(`/api/portal/${edificioId}/pagos/${pagoId}/comprobante`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      setUploadMsg(m => ({ ...m, [pagoId]: { ok: true, msg: 'Comprobante enviado correctamente' } }));
      cargarPagos();
    } catch (err) {
      setUploadMsg(m => ({ ...m, [pagoId]: { ok: false, msg: err.response?.data?.error || 'Error al subir' } }));
    } finally { setUploading(null); }
  }

  async function descargarRecibo(pago) {
    setDescargandoRecibo(pago.id);
    try {
      const { data } = await axios.get(
        `/api/portal/${edificioId}/pagos/${pago.id}/recibo.pdf`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' },
      );
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      const a   = document.createElement('a');
      a.href = url;
      a.download = `Recibo_${MESES[pago.cuota.mes]}_${pago.cuota.anio}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Error al generar el recibo'); }
    finally { setDescargandoRecibo(null); }
  }

  async function descargarPDF() {
    setDescargando(true);
    try {
      const params = `?desde=${desde}&hasta=${hasta}`;
      const { data } = await axios.get(`/api/portal/${edificioId}/estado-cuenta${params}`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      const a   = document.createElement('a');
      a.href = url; a.download = `Estado_Cuenta_${propietario.unidad?.numero}_${desde}_${hasta}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch { alert('Error al generar el estado de cuenta'); }
    finally { setDescargando(false); }
  }

  const pendientes = pagos.filter(p => p.estado !== 'PAGADO');
  const pagados    = pagos.filter(p => p.estado === 'PAGADO');

  const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', marginBottom: 16 };
  const badge = (estado) => {
    const s = ESTADO_STYLE[estado] ?? ESTADO_STYLE.PENDIENTE;
    return <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>;
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Estado de Cuenta</h1>
      <p style={{ margin: '0 0 28px', color: '#64748b', fontSize: 14 }}>
        Revisa tus cuotas y sube comprobantes de pago
      </p>

      {/* ── Pagos pendientes / vencidos ── */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 16 }}>
          Cuotas pendientes
          {pendientes.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, background: pendientes.some(p => p.estado === 'VENCIDO') ? '#fee2e2' : '#fef9c3', color: pendientes.some(p => p.estado === 'VENCIDO') ? '#991b1b' : '#854d0e', padding: '2px 8px', borderRadius: 99 }}>
              {pendientes.length}
            </span>
          )}
        </div>

        {loading ? (
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Cargando…</p>
        ) : pendientes.length === 0 ? (
          <p style={{ color: '#22c55e', fontSize: 14, fontWeight: 600 }}>✓ Estás al día con todos tus pagos</p>
        ) : (
          pendientes.map(p => {
            const mora  = Number(p.interesMora);
            const total = Number(p.monto) + mora;
            const msg   = uploadMsg[p.id];
            return (
              <div key={p.id} style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, paddingBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                      Cuota {MESES[p.cuota.mes]} {p.cuota.anio}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      Vence: {p.fechaVence?.slice(0, 10)}
                    </div>
                    <div style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>
                      Cuota: {fmt(p.monto)}
                      {mora > 0 && <span style={{ color: '#dc2626', marginLeft: 8 }}>+ mora {fmt(mora)}</span>}
                      <span style={{ fontWeight: 700, marginLeft: 8 }}>= {fmt(total)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    {badge(p.estado)}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {p.comprobante && (
                        <a href={p.comprobante} target="_blank" rel="noreferrer"
                          style={{ fontSize: 12, color: '#2563eb' }}>
                          Ver comprobante
                        </a>
                      )}
                      <input
                        type="file" accept="image/*,application/pdf"
                        style={{ display: 'none' }}
                        ref={el => fileRefs.current[p.id] = el}
                        onChange={e => e.target.files[0] && subirComprobante(p.id, e.target.files[0])}
                      />
                      <button
                        onClick={() => fileRefs.current[p.id]?.click()}
                        disabled={uploading === p.id}
                        style={{ padding: '6px 14px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: uploading === p.id ? .6 : 1 }}
                      >
                        {uploading === p.id ? 'Subiendo…' : p.comprobante ? '↑ Reemplazar' : '↑ Subir comprobante'}
                      </button>
                    </div>
                    {msg && (
                      <span style={{ fontSize: 11, color: msg.ok ? '#16a34a' : '#dc2626' }}>
                        {msg.ok ? '✓' : '✗'} {msg.msg}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Cuotas extraordinarias ── */}
      {cuotasExt.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 16 }}>
            Cuotas extraordinarias
            {cuotasExt.filter(c => c.estado !== 'PAGADO').length > 0 && (
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, background: cuotasExt.some(c => c.estado === 'VENCIDO') ? '#fee2e2' : '#fef9c3', color: cuotasExt.some(c => c.estado === 'VENCIDO') ? '#991b1b' : '#854d0e', padding: '2px 8px', borderRadius: 99 }}>
                {cuotasExt.filter(c => c.estado !== 'PAGADO').length} pendiente(s)
              </span>
            )}
          </div>
          {cuotasExt.map(c => {
            const msg = uploadExtMsg[c.id];
            return (
              <div key={c.id} style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, paddingBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{c.cuota.descripcion}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      Vence: {c.fechaVence?.slice(0, 10) || c.cuota.fechaVence?.slice(0, 10)}
                      {c.estado === 'PAGADO' && c.fechaPago && <span style={{ marginLeft: 8 }}>· Pagado: {c.fechaPago?.slice(0, 10)} · {c.metodo || '—'}</span>}
                    </div>
                    {msg && (
                      <span style={{ fontSize: 11, color: msg.ok ? '#16a34a' : '#dc2626' }}>
                        {msg.ok ? '✓' : '✗'} {msg.msg}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{fmt(c.monto)}</span>
                      {badge(c.estado)}
                    </div>
                    {c.estado === 'PAGADO' ? (
                      <a href={`/api/portal/${edificioId}/cuotas-ext/${c.id}/recibo.pdf`}
                        target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, color: '#1e3a5f', fontWeight: 600, textDecoration: 'none', padding: '6px 12px', border: '1px solid #1e3a5f', borderRadius: 8, display: 'inline-block' }}>
                        ⬇ Recibo PDF
                      </a>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {c.comprobante && (
                          <a href={c.comprobante} target="_blank" rel="noreferrer"
                            style={{ fontSize: 12, color: '#2563eb' }}>Ver comprobante</a>
                        )}
                        <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                          ref={el => fileExtRefs.current[c.id] = el}
                          onChange={e => e.target.files[0] && subirComprobanteExt(c.id, e.target.files[0])} />
                        <button
                          onClick={() => fileExtRefs.current[c.id]?.click()}
                          disabled={uploadingExt === c.id}
                          style={{ padding: '6px 14px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: uploadingExt === c.id ? .6 : 1 }}
                        >
                          {uploadingExt === c.id ? 'Subiendo…' : c.comprobante ? '↑ Reemplazar' : '↑ Subir comprobante'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Historial de pagos ── */}
      {pagados.length > 0 && (
        <div style={card}>
          <button
            onClick={() => setVerHistorial(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15, color: '#0f172a', padding: 0, display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}
          >
            Historial de pagos ({pagados.length})
            <span style={{ fontSize: 13, color: '#64748b' }}>{verHistorial ? '▲' : '▼'}</span>
          </button>
          {verHistorial && pagados.map(p => (
            <div key={p.id} style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
                    Cuota {MESES[p.cuota.mes]} {p.cuota.anio}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Pagado: {p.fechaPago?.slice(0, 10) || '—'} · {p.metodo || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{fmt(p.monto)}</span>
                  {badge(p.estado)}
                  {p.comprobante && (
                    <a href={p.comprobante} target="_blank" rel="noreferrer"
                      style={{ fontSize: 12, color: '#2563eb' }}>
                      Ver comprobante
                    </a>
                  )}
                  <button
                    onClick={() => descargarRecibo(p)}
                    disabled={descargandoRecibo === p.id}
                    style={{ padding: '4px 10px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: descargandoRecibo === p.id ? .6 : 1 }}
                  >
                    {descargandoRecibo === p.id ? '…' : '⬇ Recibo'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Descargar PDF ── */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 14 }}>Descargar estado de cuenta (PDF)</div>
        <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
          </div>
        </div>
        <button
          onClick={descargarPDF} disabled={descargando}
          style={{ width: '100%', padding: '12px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: descargando ? 'not-allowed' : 'pointer', fontSize: 14, opacity: descargando ? .7 : 1 }}
        >
          {descargando ? 'Generando PDF...' : '⬇ Descargar PDF'}
        </button>
      </div>
    </div>
  );
}
