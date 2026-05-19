import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';

const SERVICIOS = ['ELECTRICIDAD', 'PLOMERIA', 'JARDINERIA', 'LIMPIEZA', 'PINTURA', 'SEGURIDAD', 'ASCENSORES', 'PISCINA', 'AIRES_AC', 'OTRO'];
const EMPTY = { nombre: '', servicio: 'ELECTRICIDAD', ruc: '', contacto: '', email: '' };

export default function ProveedoresPage() {
  const { edificioId } = useParams();
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [modal, setModal]             = useState(false);
  const [editando, setEditando]       = useState(null);
  const [form, setForm]               = useState(EMPTY);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => { cargar(); }, [edificioId]);

  async function cargar() {
    setLoading(true);
    try { const { data } = await api.get(`/edificios/${edificioId}/proveedores`); setProveedores(data); }
    finally { setLoading(false); }
  }

  function abrirNuevo() {
    setEditando(null); setForm(EMPTY); setError(''); setModal(true);
  }

  function abrirEditar(p) {
    setEditando(p);
    setForm({ nombre: p.nombre, servicio: p.servicio, ruc: p.ruc || '', contacto: p.contacto || '', email: p.email || '' });
    setError(''); setModal(true);
  }

  async function guardar(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      if (editando) {
        await api.put(`/edificios/${edificioId}/proveedores/${editando.id}`, form);
      } else {
        await api.post(`/edificios/${edificioId}/proveedores`, form);
      }
      setModal(false); cargar();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  async function toggleActivo(p) {
    try { await api.put(`/edificios/${edificioId}/proveedores/${p.id}`, { activo: !p.activo }); cargar(); }
    catch (err) { alert(err.response?.data?.error || 'Error'); }
  }

  async function eliminar(p) {
    if (!confirm(`¿Eliminar a ${p.nombre}?`)) return;
    try { await api.delete(`/edificios/${edificioId}/proveedores/${p.id}`); cargar(); }
    catch (err) { alert(err.response?.data?.error || 'Error'); }
  }

  const activos   = proveedores.filter(p => p.activo);
  const inactivos = proveedores.filter(p => !p.activo);

  if (loading) return <div className="loading">Cargando…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Proveedores</h1>
        <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo proveedor</button>
      </div>

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-label">Total</div><div className="stat-value">{proveedores.length}</div></div>
        <div className="stat-card"><div className="stat-label">Activos</div><div className="stat-value stat-green">{activos.length}</div></div>
        <div className="stat-card"><div className="stat-label">Inactivos</div><div className="stat-value stat-amber">{inactivos.length}</div></div>
      </div>

      {proveedores.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 40 }}>🔧</div>
          <p>No hay proveedores registrados aún.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Servicio</th><th>Contacto</th><th>Email</th><th>RUC</th><th>Órdenes</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {proveedores.map(p => (
                  <tr key={p.id} style={{ opacity: p.activo ? 1 : 0.55 }}>
                    <td><strong>{p.nombre}</strong></td>
                    <td><span className="badge badge-blue">{p.servicio.replace('_', ' ')}</span></td>
                    <td style={{ fontSize: 12 }}>{p.contacto || '—'}</td>
                    <td style={{ fontSize: 12 }}>{p.email || '—'}</td>
                    <td style={{ fontSize: 12 }}>{p.ruc || '—'}</td>
                    <td><span className="badge badge-slate">{p._count.ordenes}</span></td>
                    <td>
                      <span className={`badge ${p.activo ? 'badge-green' : 'badge-slate'}`}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="gap-8">
                        <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(p)}>Editar</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleActivo(p)}>
                          {p.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        {p._count.ordenes === 0 && (
                          <button className="btn btn-danger btn-sm" onClick={() => eliminar(p)}>✕</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editando ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={guardar}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group"><label>Nombre *</label><input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Servicio *</label>
                    <select value={form.servicio} onChange={e => setForm(f => ({ ...f, servicio: e.target.value }))}>
                      {SERVICIOS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>RUC</label><input value={form.ruc} onChange={e => setForm(f => ({ ...f, ruc: e.target.value }))} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Contacto</label><input value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} placeholder="Nombre o teléfono" /></div>
                  <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
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
    </div>
  );
}
