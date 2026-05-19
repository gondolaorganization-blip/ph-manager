import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';

const EMPTY_UNIDAD = { numero: '', numFinca: '', piso: '', tipo: 'APARTAMENTO', metrosCuadrados: '', coeficiente: '' };
const EMPTY_PROP   = { nombre: '', cedula: '', email: '', telefono: '' };
const TIPOS = ['APARTAMENTO', 'LOCAL', 'ESTACIONAMIENTO', 'BODEGA', 'OFICINA'];

function fmt(n) { return `$${Number(n).toLocaleString('es-PA', { minimumFractionDigits: 2 })}`; }
function estadoBadge(u) {
  if (u.morosa) return <span className="badge badge-red">Morosa</span>;
  if (u.saldoPendiente > 0) return <span className="badge badge-amber">Pendiente</span>;
  return <span className="badge badge-green">Al día</span>;
}

export default function UnidadesPage() {
  const { edificioId } = useParams();
  const [unidades, setUnidades]  = useState([]);
  const [resumen, setResumen]    = useState(null);
  const [loading, setLoading]    = useState(true);
  const [modalUnidad, setModalUnidad] = useState(false);
  const [modalProp, setModalProp]     = useState(null); // unidad seleccionada
  const [form, setForm]          = useState(EMPTY_UNIDAD);
  const [formProp, setFormProp]  = useState(EMPTY_PROP);
  const [saving, setSaving]      = useState(false);
  const [error, setError]        = useState('');
  const [modalEditar, setModalEditar] = useState(null); // unidad a editar
  const [formEditar, setFormEditar]   = useState(EMPTY_UNIDAD);
  const [modalImport, setModalImport] = useState(false);
  const [importFile,  setImportFile]  = useState(null);
  const [importing,   setImporting]   = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => { cargar(); }, [edificioId]);

  async function cargar() {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        api.get(`/edificios/${edificioId}/unidades`),
        api.get(`/edificios/${edificioId}/unidades/resumen`),
      ]);
      setUnidades(u.data); setResumen(r.data);
    } finally { setLoading(false); }
  }

  async function crearUnidad(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.post(`/edificios/${edificioId}/unidades`, {
        ...form, piso: parseInt(form.piso), metrosCuadrados: parseFloat(form.metrosCuadrados), coeficiente: parseFloat(form.coeficiente),
      });
      setModalUnidad(false); setForm(EMPTY_UNIDAD); cargar();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  async function guardarPropietario(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.put(`/edificios/${edificioId}/unidades/${modalProp.id}/propietario`, formProp);
      setModalProp(null); setFormProp(EMPTY_PROP); cargar();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  function abrirEditar(u) {
    setFormEditar({
      numero:          u.numero,
      numFinca:        u.numFinca  || '',
      piso:            u.piso      ?? '',
      tipo:            u.tipo      || 'APARTAMENTO',
      metrosCuadrados: u.metrosCuadrados ?? '',
      coeficiente:     u.coeficiente    ?? '',
    });
    setError('');
    setModalEditar(u);
  }

  async function actualizarUnidad(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.put(`/edificios/${edificioId}/unidades/${modalEditar.id}`, {
        ...formEditar,
        piso:            formEditar.piso            !== '' ? parseInt(formEditar.piso)             : null,
        metrosCuadrados: formEditar.metrosCuadrados !== '' ? parseFloat(formEditar.metrosCuadrados) : undefined,
        coeficiente:     formEditar.coeficiente     !== '' ? parseFloat(formEditar.coeficiente)     : undefined,
      });
      setModalEditar(null); cargar();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  async function importarExcel(e) {
    e.preventDefault();
    if (!importFile) return;
    setImporting(true); setImportResult(null);
    const fd = new FormData();
    fd.append('file', importFile);
    try {
      const { data } = await api.post(`/edificios/${edificioId}/unidades/importar`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(data);
      if (data.creadas > 0) cargar();
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || 'Error al importar' });
    } finally { setImporting(false); }
  }

  function abrirModalProp(u) {
    setError('');
    setFormProp(u.propietario ? { nombre: u.propietario.nombre, cedula: u.propietario.cedula || '', email: u.propietario.email || '', telefono: u.propietario.telefono || '' } : EMPTY_PROP);
    setModalProp(u);
  }

  if (loading) return <div className="loading">Cargando…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Unidades</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={`/api/edificios/${edificioId}/unidades.xlsx`} className="btn btn-ghost btn-sm" download>⬇ Excel</a>
          <button className="btn btn-ghost btn-sm" onClick={() => { setImportFile(null); setImportResult(null); setModalImport(true); }}>⬆ Importar</button>
          <button className="btn btn-primary" onClick={() => { setError(''); setForm(EMPTY_UNIDAD); setModalUnidad(true); }}>+ Nueva unidad</button>
        </div>
      </div>

      {resumen && (
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-label">Total activas</div><div className="stat-value">{resumen.total}</div></div>
          <div className="stat-card"><div className="stat-label">Con propietario</div><div className="stat-value stat-green">{resumen.conPropietario}</div></div>
          <div className="stat-card"><div className="stat-label">Sin propietario</div><div className="stat-value stat-amber">{resumen.sinPropietario}</div></div>
          <div className="stat-card">
            <div className="stat-label">Coeficiente total</div>
            <div className="stat-value stat-blue">{(Number(resumen.coeficienteTotal) * 100).toFixed(2)}%</div>
            <div className="stat-sub">Pendiente: {(Number(resumen.coeficientePendiente) * 100).toFixed(4)}%</div>
          </div>
          <div className="stat-card"><div className="stat-label">M² totales</div><div className="stat-value">{Number(resumen.m2Total).toFixed(1)}</div></div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Unidad</th><th>Finca</th><th>Piso</th><th>Tipo</th><th>M²</th><th>Coef.</th>
                <th>Propietario</th><th>Saldo</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {unidades.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.numero}</strong></td>
                  <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>{u.numFinca || '—'}</td>
                  <td>{u.piso}</td>
                  <td><span className="badge badge-slate">{u.tipo}</span></td>
                  <td>{Number(u.metrosCuadrados).toFixed(1)}</td>
                  <td className="monospace">{(Number(u.coeficiente) * 100).toFixed(4)}%</td>
                  <td>{u.propietario?.nombre || <span style={{ color: 'var(--slate-400)' }}>Sin propietario</span>}</td>
                  <td style={{ color: u.saldoPendiente > 0 ? 'var(--red-600)' : 'inherit' }}>
                    {u.saldoPendiente > 0 ? fmt(u.saldoPendiente) : '—'}
                  </td>
                  <td>{estadoBadge(u)}</td>
                  <td>
                    <div className="gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirModalProp(u)}>
                        {u.propietario ? 'Propietario' : '+ Asignar'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(u)}>Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal nueva unidad */}
      {modalUnidad && (
        <div className="modal-backdrop" onClick={() => setModalUnidad(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nueva unidad</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalUnidad(false)}>✕</button>
            </div>
            <form onSubmit={crearUnidad}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-row">
                  <div className="form-group"><label>Número *</label><input required value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} /></div>
                  <div className="form-group"><label>Piso *</label><input type="number" required value={form.piso} onChange={e => setForm(f => ({ ...f, piso: e.target.value }))} /></div>
                </div>
                <div className="form-group">
                  <label>Número de finca (Registro Público)</label>
                  <input value={form.numFinca} placeholder="Ej: 12345" onChange={e => setForm(f => ({ ...f, numFinca: e.target.value }))} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Tipo *</label>
                    <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                      {TIPOS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>M² *</label><input type="number" step="0.01" required value={form.metrosCuadrados} onChange={e => setForm(f => ({ ...f, metrosCuadrados: e.target.value }))} /></div>
                </div>
                <div className="form-group">
                  <label>Coeficiente (0-1) *</label>
                  <input type="number" step="0.000001" min="0.000001" max="1" required value={form.coeficiente} onChange={e => setForm(f => ({ ...f, coeficiente: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalUnidad(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal propietario */}
      {modalProp && (
        <div className="modal-backdrop" onClick={() => setModalProp(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Propietario — Unidad {modalProp.numero}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalProp(null)}>✕</button>
            </div>
            <form onSubmit={guardarPropietario}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group"><label>Nombre *</label><input required value={formProp.nombre} onChange={e => setFormProp(f => ({ ...f, nombre: e.target.value }))} /></div>
                <div className="form-row">
                  <div className="form-group"><label>Cédula</label><input value={formProp.cedula} onChange={e => setFormProp(f => ({ ...f, cedula: e.target.value }))} /></div>
                  <div className="form-group"><label>Teléfono</label><input value={formProp.telefono} onChange={e => setFormProp(f => ({ ...f, telefono: e.target.value }))} /></div>
                </div>
                <div className="form-group"><label>Email</label><input type="email" value={formProp.email} onChange={e => setFormProp(f => ({ ...f, email: e.target.value }))} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalProp(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal editar unidad */}
      {modalEditar && (
        <div className="modal-backdrop" onClick={() => setModalEditar(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Editar unidad {modalEditar.numero}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalEditar(null)}>✕</button>
            </div>
            <form onSubmit={actualizarUnidad}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-row">
                  <div className="form-group">
                    <label>Número *</label>
                    <input required value={formEditar.numero} onChange={e => setFormEditar(f => ({ ...f, numero: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>N° Finca</label>
                    <input value={formEditar.numFinca} onChange={e => setFormEditar(f => ({ ...f, numFinca: e.target.value }))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Piso</label>
                    <input type="number" value={formEditar.piso} onChange={e => setFormEditar(f => ({ ...f, piso: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Tipo</label>
                    <select value={formEditar.tipo} onChange={e => setFormEditar(f => ({ ...f, tipo: e.target.value }))}>
                      {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>M²</label><input type="number" step="0.01" value={formEditar.metrosCuadrados} onChange={e => setFormEditar(f => ({ ...f, metrosCuadrados: e.target.value }))} /></div>
                  <div className="form-group">
                    <label>Coeficiente (0-1)</label>
                    <input type="number" step="0.000001" min="0" max="1" value={formEditar.coeficiente} onChange={e => setFormEditar(f => ({ ...f, coeficiente: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalEditar(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal importar Excel */}
      {modalImport && (
        <div className="modal-backdrop" onClick={() => { setModalImport(false); setImportResult(null); }}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Importar unidades desde Excel</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => { setModalImport(false); setImportResult(null); }}>✕</button>
            </div>
            <form onSubmit={importarExcel}>
              <div className="modal-body">
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#475569' }}>
                  <strong>Columnas del archivo Excel (fila 1 = encabezado):</strong>
                  <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8 }}>
                    A: Numero &nbsp;|&nbsp; B: Piso &nbsp;|&nbsp; C: Tipo<br />
                    D: MetrosCuadrados &nbsp;|&nbsp; E: Coeficiente (ej. 0.025)<br />
                    F: PropietarioNombre &nbsp;|&nbsp; G: PropietarioEmail<br />
                    H: PropietarioTelefono &nbsp;|&nbsp; I: PropietarioCedula
                  </div>
                  <div style={{ marginTop: 8 }}>
                    Tipos válidos: APARTAMENTO, LOCAL, ESTACIONAMIENTO, BODEGA, OFICINA, PARQUEO, OTRO
                  </div>
                  <a href={`/api/edificios/${edificioId}/unidades/plantilla.xlsx`} download
                    style={{ display: 'inline-block', marginTop: 8, color: '#1d4ed8', textDecoration: 'none', fontSize: 12 }}>
                    ⬇ Descargar plantilla de ejemplo
                  </a>
                </div>

                <div className="form-group">
                  <label>Archivo Excel (.xlsx) *</label>
                  <input type="file" accept=".xlsx" required
                    onChange={e => { setImportFile(e.target.files[0]); setImportResult(null); }} />
                </div>

                {importResult && (
                  <div style={{ marginTop: 12 }}>
                    {importResult.error ? (
                      <div className="alert alert-error">{importResult.error}</div>
                    ) : (
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, fontSize: 13 }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>
                          Resultado: {importResult.creadas} creadas · {importResult.omitidas} omitidas · {importResult.errores} errores
                        </div>
                        {importResult.detalles?.filter(d => d.resultado !== 'creada').map((d, i) => (
                          <div key={i} style={{ fontSize: 12, color: d.resultado === 'error' ? '#dc2626' : '#64748b' }}>
                            Fila {d.fila} ({d.numero}): {d.razon}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => { setModalImport(false); setImportResult(null); }}>Cerrar</button>
                <button type="submit" className="btn btn-primary" disabled={importing || !importFile}>
                  {importing ? 'Importando…' : 'Importar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
