import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import { pdfUrl } from '../hooks/usePdfUrl';

const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const BUCKETS = [
  { key: '1-30',  label: '1–30 días',  color: 'var(--amber-600)' },
  { key: '31-60', label: '31–60 días', color: '#ea580c' },
  { key: '61-90', label: '61–90 días', color: 'var(--red-600)' },
  { key: '91+',   label: '91+ días',   color: '#7f1d1d' },
];

function fmt(n) { return `$${Number(n).toLocaleString('es-PA', { minimumFractionDigits: 2 })}`; }

export default function MorososPage() {
  const { edificioId }   = useParams();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [notif, setNotif]       = useState(null);   // { enviados, sinEmail, total }
  const [sending, setSending]   = useState(false);

  useEffect(() => { cargar(); }, [edificioId]);

  async function cargar() {
    setLoading(true);
    try { const r = await api.get(`/edificios/${edificioId}/cuotas/morosos`); setData(r.data); }
    finally { setLoading(false); }
  }

  async function enviarRecordatorios() {
    if (!confirm('¿Enviar aviso por email a todos los propietarios morosos que tengan correo registrado?')) return;
    setSending(true); setNotif(null);
    try {
      const { data: r } = await api.post(`/edificios/${edificioId}/cuotas/morosos/notificar`);
      setNotif(r);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al enviar recordatorios');
    } finally { setSending(false); }
  }

  if (loading) return <div className="loading">Cargando…</div>;
  if (!data) return null;

  const { totalMorosos, totalDeuda, buckets } = data;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Reporte de Morosos</h1>
        <div className="gap-8">
          <button className="btn btn-ghost" onClick={enviarRecordatorios} disabled={sending || totalMorosos === 0}>
            {sending ? 'Enviando…' : '📧 Enviar recordatorios'}
          </button>
          <a
            className="btn btn-ghost"
            href={pdfUrl(`/api/edificios/${edificioId}/cuotas/reportes/morosos.xlsx`)}
            download
          >
            📊 Excel
          </a>
          <a
            className="btn btn-primary"
            href={pdfUrl(`/api/edificios/${edificioId}/cuotas/reportes/morosos.pdf`)}
            target="_blank" rel="noreferrer"
          >
            📄 PDF
          </a>
        </div>
      </div>

      {notif && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          ✓ Recordatorios enviados: <strong>{notif.enviados}</strong> emails.
          {notif.sinEmail > 0 && ` ${notif.sinEmail} propietario(s) sin email registrado.`}
        </div>
      )}

      {/* Resumen por bucket */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total morosos</div>
          <div className="stat-value stat-red">{totalMorosos}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Deuda total</div>
          <div className="stat-value stat-red">{fmt(totalDeuda)}</div>
        </div>
        {BUCKETS.map(b => {
          const items = buckets[b.key] || [];
          const deuda = items.reduce((s, u) => s + u.totalDeuda, 0);
          return (
            <div key={b.key} className="stat-card">
              <div className="stat-label" style={{ color: b.color }}>{b.label}</div>
              <div className="stat-value" style={{ color: b.color }}>{items.length}</div>
              <div className="stat-sub">{fmt(deuda)}</div>
            </div>
          );
        })}
      </div>

      {totalMorosos === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 40 }}>✅</div>
          <p>¡No hay unidades morosas! Todos los pagos están al día.</p>
        </div>
      ) : (
        BUCKETS.map(b => {
          const items = buckets[b.key] || [];
          if (items.length === 0) return null;
          return (
            <div key={b.key} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: b.color }} />
                <h3 style={{ fontSize: 14, fontWeight: 600, color: b.color }}>{b.label} — {items.length} unidad(es)</h3>
              </div>
              <div className="card">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Unidad</th><th>Propietario</th><th>Teléfono</th>
                        <th>Cuotas vencidas</th><th>Días máx.</th><th>Deuda total</th>
                        <th>Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item.unidad.id}>
                          <td><strong>{item.unidad.numero}</strong></td>
                          <td>{item.propietario?.nombre || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>{item.propietario?.telefono || '—'}</td>
                          <td><span className="badge badge-red">{item.cuotas.length}</span></td>
                          <td style={{ color: b.color, fontWeight: 600 }}>{item.diasMaxVencidos}d</td>
                          <td style={{ fontWeight: 700, color: b.color }}>{fmt(item.totalDeuda)}</td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {item.cuotas.map((c, i) => (
                                <span key={i} style={{ fontSize: 11, background: 'var(--slate-100)', padding: '2px 6px', borderRadius: 4 }}>
                                  {MESES[c.mes]}/{c.anio}: {fmt(c.total)}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
