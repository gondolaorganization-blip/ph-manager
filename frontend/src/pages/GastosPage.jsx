import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import Pagination from '../components/Pagination';

const CATEGORIAS = ['MANTENIMIENTO', 'SERVICIOS', 'PERSONAL', 'ADMINISTRACION', 'FONDO_RESERVA', 'OTROS'];
const CAT_COLOR  = {
  MANTENIMIENTO: 'badge-blue',  SERVICIOS: 'badge-slate',
  PERSONAL:      'badge-amber', ADMINISTRACION: 'badge-slate',
  FONDO_RESERVA: 'badge-red',   OTROS: 'badge-slate',
};
const EMPTY = { categoria: 'MANTENIMIENTO', descripcion: '', monto: '', fecha: new Date().toISOString().slice(0, 10), proveedor: '', notas: '' };

const ANIO_ACTUAL = new Date().getFullYear();
const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function fmt(n) { return `$${Number(n).toLocaleString('es-PA', { minimumFractionDigits: 2 })}`; }

export default function GastosPage() {
  const { edificioId } = useParams();
  const [gastos, setGastos]       = useState({ data: [], total: 0, page: 1, pages: 1, limit: 20 });
  const [resumen, setResumen]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [anio, setAnio]           = useState(ANIO_ACTUAL);
  const [filtroCat, setFiltroCat] = useState('');
  const [page, setPage]           = useState(1);
  const [modal, setModal]       = useState(false);
  const [modalFondo, setModalFondo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm]         = useState(EMPTY);
  const [formFondo, setFormFondo] = useState({ operacion: 'INCREMENTAR', monto: '', notas: '' });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => { setPage(1); }, [edificioId, anio, filtroCat]);
  useEffect(() => { cargar(); }, [edificioId, anio, filtroCat, page]);

  async function cargar() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ anio, page, limit: 20 });
      if (filtroCat) params.set('categoria', filtroCat);
      const [g, r] = await Promise.all([
        api.get(`/edificios/${edificioId}/gastos?${params}`),
        api.get(`/edificios/${edificioId}/gastos/resumen?anio=${anio}`),
      ]);
      setGastos(g.data); setResumen(r.data);
    } finally { setLoading(false); }
  }

  function abrirNuevo() {
    setEditando(null); setForm(EMPTY); setError(''); setModal(true);
  }

  function abrirEditar(g) {
    setEditando(g);
    setForm({
      categoria:   g.categoria,
      descripcion: g.descripcion,
      monto:       Number(g.monto),
      fecha:       g.fecha.slice(0, 10),
      proveedor:   g.proveedor || '',
      notas:       g.notas || '',
    });
    setError(''); setModal(true);
  }

  async function guardar(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      if (editando) {
        await api.put(`/edificios/${edificioId}/gastos/${editando.id}`, form);
      } else {
        await api.post(`/edificios/${edificioId}/gastos`, form);
      }
      setModal(false); cargar();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  async function eliminar(g) {
    if (!confirm(`¿Eliminar gasto "${g.descripcion}"?`)) return;
    try { await api.delete(`/edificios/${edificioId}/gastos/${g.id}`); cargar(); }
    catch (err) { alert(err.response?.data?.error || 'Error'); }
  }

  async function guardarFondo(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.put(`/edificios/${edificioId}/fondo-reserva`, formFondo);
      setModalFondo(false); cargar();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  if (loading && !resumen) return <div className="loading">Cargando…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Gastos</h1>
        <div className="gap-8">
          <button className="btn btn-ghost" onClick={() => { setError(''); setModalFondo(true); }}>
            💰 Fondo de reserva
          </button>
          <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo gasto</button>
        </div>
      </div>

      {/* Fondo de reserva + totales */}
      {resumen && (
        <>
          <div className="stats-grid">
            <div className="stat-card" style={{ borderLeft: '3px solid var(--blue-600)' }}>
              <div className="stat-label">Fondo de reserva</div>
              <div className="stat-value stat-blue">{fmt(resumen.fondoReserva)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Gastos {anio}</div>
              <div className="stat-value stat-red">{fmt(resumen.totalAnio)}</div>
              <div className="stat-sub">{gastos.total} registros</div>
            </div>
            {resumen.porCategoria.filter(c => c.total > 0).slice(0, 4).map(c => (
              <div key={c.categoria} className="stat-card">
                <div className="stat-label">{c.categoria.replace('_', ' ')}</div>
                <div className="stat-value" style={{ fontSize: 16 }}>{fmt(c.total)}</div>
                <div className="stat-sub">{c.count} registros</div>
              </div>
            ))}
          </div>

          {/* Barras mensuales */}
          {resumen.porMes.some(m => m.total > 0) && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                Distribución mensual {anio}
                <div className="gap-8">
                  <button className="btn btn-ghost btn-sm" onClick={() => setAnio(a => a - 1)}>← {anio - 1}</button>
                  {anio < ANIO_ACTUAL && <button className="btn btn-ghost btn-sm" onClick={() => setAnio(a => a + 1)}>{anio + 1} →</button>}
                </div>
              </div>
              <div className="card-body">
                <div className="month-bar-wrap">
                  {resumen.porMes.map(m => {
                    const max = Math.max(...resumen.porMes.map(x => x.total), 1);
                    return (
                      <div key={m.mes} className="month-bar">
                        <span className="month-bar-label">{MESES[m.mes]}</span>
                        <div className="month-bar-track">
                          <div className="month-bar-fill" style={{ width: `${(m.total / max) * 100}%`, background: 'var(--red-600)' }} />
                        </div>
                        <span style={{ width: 80, textAlign: 'right', fontSize: 12, color: m.total > 0 ? 'var(--slate-700)' : 'var(--slate-400)' }}>
                          {m.total > 0 ? fmt(m.total) : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Filtros por categoría */}
      <div className="gap-8" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={`btn btn-sm ${!filtroCat ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFiltroCat('')}>Todos</button>
        {CATEGORIAS.map(c => (
          <button key={c} className={`btn btn-sm ${filtroCat === c ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFiltroCat(filtroCat === c ? '' : c)}>
            {c.replace('_', ' ')}
          </button>
        ))}
      </div>

      {gastos.data.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 40 }}>📊</div>
          <p>No hay gastos registrados{filtroCat ? ` en ${filtroCat}` : ''} para {anio}.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Proveedor</th><th>Monto</th><th></th></tr>
              </thead>
              <tbody>
                {gastos.data.map(g => (
                  <tr key={g.id}>
                    <td style={{ fontSize: 12, color: 'var(--slate-500)', whiteSpace: 'nowrap' }}>
                      {new Date(g.fecha).toLocaleDateString('es-PA')}
                    </td>
                    <td><span className={`badge ${CAT_COLOR[g.categoria]}`}>{g.categoria.replace('_', ' ')}</span></td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{g.descripcion}</div>
                      {g.notas && <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>{g.notas}</div>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>{g.proveedor || '—'}</td>
                    <td style={{ fontWeight: 700 }}>{fmt(g.monto)}</td>
                    <td>
                      <div className="gap-8">
                        <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(g)}>Editar</button>
                        <button className="btn btn-danger btn-sm" onClick={() => eliminar(g)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--slate-100)', fontWeight: 700 }}>
                  <td colSpan={4} style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: 'var(--slate-500)' }}>TOTAL PÁGINA</td>
                  <td style={{ padding: '10px 12px', color: 'var(--red-600)' }}>
                    {fmt(gastos.data.reduce((s, g) => s + Number(g.monto), 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <Pagination
            page={gastos.page} pages={gastos.pages}
            total={gastos.total} limit={gastos.limit}
            onChange={p => setPage(p)}
          />
        </div>
      )}

      {/* Modal gasto */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editando ? 'Editar gasto' : 'Nuevo gasto'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={guardar}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-row">
                  <div className="form-group">
                    <label>Categoría *</label>
                    <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                      {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Fecha *</label>
                    <input type="date" required value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Descripción *</label>
                  <input required value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Monto ($) *</label>
                    <input type="number" step="0.01" min="0.01" required value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Proveedor / Beneficiario</label>
                    <input value={form.proveedor} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Notas</label>
                  <input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal fondo de reserva */}
      {modalFondo && (
        <div className="modal-backdrop" onClick={() => setModalFondo(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Ajustar fondo de reserva</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalFondo(false)}>✕</button>
            </div>
            <form onSubmit={guardarFondo}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                {resumen && (
                  <div style={{ background: 'var(--blue-50)', border: '1px solid var(--blue-100)', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
                    Saldo actual: <strong style={{ color: 'var(--blue-700)' }}>{fmt(resumen.fondoReserva)}</strong>
                  </div>
                )}
                <div className="form-group">
                  <label>Operación *</label>
                  <select value={formFondo.operacion} onChange={e => setFormFondo(f => ({ ...f, operacion: e.target.value }))}>
                    <option value="INCREMENTAR">Incrementar (depósito)</option>
                    <option value="DECREMENTAR">Decrementar (retiro)</option>
                    <option value="FIJAR">Fijar valor exacto</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Monto ($) *</label>
                  <input type="number" step="0.01" min="0.01" required value={formFondo.monto} onChange={e => setFormFondo(f => ({ ...f, monto: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Notas</label>
                  <input value={formFondo.notas} onChange={e => setFormFondo(f => ({ ...f, notas: e.target.value }))} placeholder="Ej: Depósito cuota extraordinaria mayo" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalFondo(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Aplicar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
