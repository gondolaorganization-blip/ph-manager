import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import Pagination from '../components/Pagination';

const CATEGORIAS = ['MULTA', 'ALQUILER', 'INTERESES', 'CUOTA_EXTRAORDINARIA', 'OTROS'];
const CAT_LABEL  = {
  MULTA: 'Multa', ALQUILER: 'Alquiler', INTERESES: 'Intereses',
  CUOTA_EXTRAORDINARIA: 'Cuota Extraordinaria', OTROS: 'Otros',
};
const CAT_COLOR  = {
  MULTA: 'badge-red', ALQUILER: 'badge-blue', INTERESES: 'badge-green',
  CUOTA_EXTRAORDINARIA: 'badge-amber', OTROS: 'badge-slate',
};

const ANIO_ACTUAL = new Date().getFullYear();
const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const EMPTY = {
  categoria: 'OTROS', descripcion: '', monto: '',
  fecha: new Date().toISOString().slice(0, 10), referencia: '', notas: '',
};

function fmt(n) { return `$${Number(n || 0).toLocaleString('es-PA', { minimumFractionDigits: 2 })}`; }
function fmtFecha(d) { return d ? new Date(d).toLocaleDateString('es-PA') : '—'; }

export default function IngresosPage() {
  const { edificioId } = useParams();
  const [anio, setAnio]           = useState(ANIO_ACTUAL);
  const [filtroCat, setFiltroCat] = useState('');
  const [page, setPage]           = useState(1);
  const [data, setData]           = useState({ data: [], total: 0, page: 1, pages: 1 });
  const [resumen, setResumen]     = useState([]);
  const [totalAnio, setTotalAnio] = useState(0);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(false);
  const [editando, setEditando]   = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => { setPage(1); }, [edificioId, anio, filtroCat]);
  useEffect(() => { cargar(); }, [edificioId, anio, filtroCat, page]);

  async function cargar() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ anio, page, limit: 20 });
      if (filtroCat) params.set('categoria', filtroCat);
      const { data: r } = await api.get(`/edificios/${edificioId}/ingresos?${params}`);
      setData({ data: r.data, total: r.total, page: r.page, pages: r.pages });
      setResumen(r.resumen || []);
      setTotalAnio(r.totalAnio || 0);
    } finally { setLoading(false); }
  }

  function abrirNuevo() { setEditando(null); setForm(EMPTY); setError(''); setModal(true); }
  function abrirEditar(i) {
    setEditando(i);
    setForm({
      categoria:   i.categoria,
      descripcion: i.descripcion,
      monto:       Number(i.monto),
      fecha:       i.fecha?.slice(0, 10) || '',
      referencia:  i.referencia || '',
      notas:       i.notas      || '',
    });
    setError(''); setModal(true);
  }

  async function guardar(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, monto: parseFloat(form.monto) };
      if (editando) await api.put(`/edificios/${edificioId}/ingresos/${editando.id}`, payload);
      else          await api.post(`/edificios/${edificioId}/ingresos`, payload);
      setModal(false); cargar();
    } catch (err) { setError(err.response?.data?.error || 'Error al guardar'); }
    finally { setSaving(false); }
  }

  async function eliminar(i) {
    if (!confirm(`¿Eliminar ingreso "${i.descripcion}"?`)) return;
    try {
      await api.delete(`/edificios/${edificioId}/ingresos/${i.id}`);
      cargar();
    } catch (err) { alert(err.response?.data?.error || 'Error al eliminar'); }
  }

  const anios = [];
  for (let y = ANIO_ACTUAL + 1; y >= 2023; y--) anios.push(y);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Ingresos Varios</h1>
          <p className="page-subtitle">Multas, alquileres, intereses y otros ingresos del edificio</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="form-control" style={{ width: 90 }} value={anio}
            onChange={e => setAnio(parseInt(e.target.value))}>
            {anios.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="form-control" style={{ width: 180 }} value={filtroCat}
            onChange={e => setFiltroCat(e.target.value)}>
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
          </select>
          <a
            href={`/api/edificios/${edificioId}/ingresos.xlsx?anio=${anio}${filtroCat ? `&categoria=${filtroCat}` : ''}`}
            className="btn btn-ghost btn-sm" download>
            ⬇ Excel
          </a>
          <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo ingreso</button>
        </div>
      </div>

      {/* Resumen por categoría */}
      {resumen.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          <div className="stat-card" style={{ minWidth: 140 }}>
            <div className="stat-label">Total {anio}</div>
            <div className="stat-value stat-green">{fmt(totalAnio)}</div>
          </div>
          {resumen.map(r => (
            <div key={r.categoria} className="stat-card" style={{ minWidth: 140 }}>
              <div className="stat-label">{CAT_LABEL[r.categoria]}</div>
              <div className="stat-value" style={{ fontSize: 18 }}>{fmt(r._sum.monto)}</div>
              <div className="stat-sub">{r._count._all} registro(s)</div>
            </div>
          ))}
        </div>
      )}

      {loading ? <div className="loading">Cargando…</div> : (
        <>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th>Referencia</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.data.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--slate-400)', padding: 32 }}>
                    Sin ingresos registrados para este período
                  </td></tr>
                ) : data.data.map(i => (
                  <tr key={i.id}>
                    <td style={{ fontSize: 13 }}>{fmtFecha(i.fecha)}</td>
                    <td><span className={`badge ${CAT_COLOR[i.categoria]}`}>{CAT_LABEL[i.categoria]}</span></td>
                    <td>
                      <div>{i.descripcion}</div>
                      {i.notas && <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>{i.notas}</div>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>{i.referencia || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green-600)' }}>{fmt(i.monto)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(i)}>Editar</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-500)' }} onClick={() => eliminar(i)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editando ? 'Editar ingreso' : 'Nuevo ingreso'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={guardar}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Categoría *</label>
                    <select className="form-control" required value={form.categoria}
                      onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                      {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Fecha *</label>
                    <input type="date" className="form-control" required value={form.fecha}
                      onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Descripción *</label>
                  <input className="form-control" required value={form.descripcion}
                    onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Monto *</label>
                    <input type="number" min="0.01" step="0.01" className="form-control" required
                      value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Referencia</label>
                    <input className="form-control" value={form.referencia}
                      onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Notas</label>
                  <textarea className="form-control" rows={2} value={form.notas}
                    onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar ingreso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
