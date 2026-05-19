import { useEffect, useState } from 'react';
import api from '../api/client';

const ROLES_USUARIO  = ['ADMIN', 'SUPER_ADMIN'];
const ROLES_EDIFICIO = ['ADMIN', 'OPERADOR', 'AUDITOR'];
const ROL_LABEL = { ADMIN: 'Admin', SUPER_ADMIN: 'Super Admin', OPERADOR: 'Operador', AUDITOR: 'Auditor' };

const EMPTY_FORM = { nombre: '', email: '', password: '', rol: 'ADMIN' };

function fmtFecha(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function UsuariosSuperAdminPage() {
  const [usuarios,     setUsuarios]     = useState([]);
  const [edificios,    setEdificios]    = useState([]);  // todos los edificios
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(null); // 'crear' | 'editar' | 'password' | 'edificios'
  const [seleccionado, setSeleccionado] = useState(null);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');

  // Para asignar edificio
  const [asignEdificioId, setAsignEdificioId] = useState('');
  const [asignRol,        setAsignRol]        = useState('ADMIN');
  const [asignando,       setAsignando]       = useState(false);

  // Para reset password
  const [nuevaPassword, setNuevaPassword] = useState('');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    try {
      const [uRes, eRes] = await Promise.all([
        api.get('/usuarios'),
        api.get('/edificios'),
      ]);
      setUsuarios(uRes.data);
      setEdificios(eRes.data);
    } finally { setLoading(false); }
  }

  function abrirCrear() {
    setForm(EMPTY_FORM); setError(''); setModal('crear');
  }

  function abrirEditar(u) {
    setSeleccionado(u);
    setForm({ nombre: u.nombre, email: u.email, password: '', rol: u.rol });
    setError(''); setModal('editar');
  }

  function abrirPassword(u) {
    setSeleccionado(u); setNuevaPassword(''); setError(''); setModal('password');
  }

  function abrirEdificios(u) {
    setSeleccionado(u);
    setAsignEdificioId(''); setAsignRol('ADMIN'); setError('');
    setModal('edificios');
  }

  async function guardar(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      if (modal === 'crear') {
        await api.post('/usuarios', form);
      } else {
        const { nombre, rol } = form;
        await api.put(`/usuarios/${seleccionado.id}`, { nombre, rol });
      }
      setModal(null); cargar();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  async function toggleActivo(u) {
    if (!confirm(`¿${u.activo ? 'Desactivar' : 'Activar'} a ${u.nombre}?`)) return;
    try {
      await api.put(`/usuarios/${u.id}`, { activo: !u.activo });
      cargar();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  }

  async function guardarPassword(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.put(`/usuarios/${seleccionado.id}/password`, { password: nuevaPassword });
      setModal(null);
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  async function asignar() {
    if (!asignEdificioId) return;
    setAsignando(true); setError('');
    try {
      await api.post(`/usuarios/${seleccionado.id}/edificios`, { edificioId: parseInt(asignEdificioId), rol: asignRol });
      // Refrescar usuario seleccionado
      const { data } = await api.get('/usuarios');
      setUsuarios(data);
      setSeleccionado(data.find(u => u.id === seleccionado.id));
      setAsignEdificioId(''); setAsignRol('ADMIN');
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setAsignando(false); }
  }

  async function quitar(edificioId) {
    if (!confirm('¿Quitar acceso a este edificio?')) return;
    try {
      await api.delete(`/usuarios/${seleccionado.id}/edificios/${edificioId}`);
      const { data } = await api.get('/usuarios');
      setUsuarios(data);
      setSeleccionado(data.find(u => u.id === seleccionado.id));
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  }

  const edificiosDisponibles = edificios.filter(e =>
    !seleccionado?.edificios?.some(a => a.edificioId === e.id)
  );

  if (loading) return <div className="loading">Cargando…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Gestión de Usuarios</h1>
        <button className="btn btn-primary" onClick={abrirCrear}>+ Nuevo usuario</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Edificios</th>
                <th>Último acceso</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} style={{ opacity: u.activo ? 1 : 0.5 }}>
                  <td><strong>{u.nombre}</strong></td>
                  <td style={{ fontSize: 13, color: 'var(--slate-500)' }}>{u.email}</td>
                  <td>
                    <span className={`badge ${u.rol === 'SUPER_ADMIN' ? 'badge-blue' : 'badge-slate'}`}>
                      {ROL_LABEL[u.rol]}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => abrirEdificios(u)}
                      style={{ fontSize: 12 }}
                    >
                      {u.edificios?.length ?? 0} edificio{u.edificios?.length !== 1 ? 's' : ''}
                    </button>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>{fmtFecha(u.ultimoAcceso)}</td>
                  <td>
                    {u.activo
                      ? <span className="badge badge-green">Activo</span>
                      : <span className="badge badge-slate">Inactivo</span>}
                  </td>
                  <td>
                    <div className="gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(u)}>Editar</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirPassword(u)}>🔑</button>
                      <button
                        className={`btn btn-sm ${u.activo ? 'btn-danger' : 'btn-ghost'}`}
                        onClick={() => toggleActivo(u)}
                      >
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear / editar */}
      {(modal === 'crear' || modal === 'editar') && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal === 'crear' ? 'Nuevo usuario' : `Editar — ${seleccionado?.nombre}`}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <form onSubmit={guardar}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label>Nombre *</label>
                  <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
                </div>
                {modal === 'crear' && (
                  <>
                    <div className="form-group">
                      <label>Email *</label>
                      <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>Contraseña * <span style={{ fontWeight: 400, color: 'var(--slate-400)' }}>(mín. 6 caracteres)</span></label>
                      <input required type="password" minLength={6} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                    </div>
                  </>
                )}
                <div className="form-group">
                  <label>Rol *</label>
                  <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
                    {ROLES_USUARIO.map(r => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal reset password */}
      {modal === 'password' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cambiar contraseña — {seleccionado?.nombre}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <form onSubmit={guardarPassword}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label>Nueva contraseña * <span style={{ fontWeight: 400, color: 'var(--slate-400)' }}>(mín. 6 caracteres)</span></label>
                  <input required type="password" minLength={6} autoFocus value={nuevaPassword}
                    onChange={e => setNuevaPassword(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Cambiar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal edificios */}
      {modal === 'edificios' && seleccionado && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Acceso a edificios — {seleccionado.nombre}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}

              {/* Edificios asignados */}
              {seleccionado.edificios?.length === 0 ? (
                <p style={{ color: 'var(--slate-400)', fontSize: 13, marginBottom: 16 }}>Sin edificios asignados</p>
              ) : (
                <div style={{ marginBottom: 20 }}>
                  {seleccionado.edificios.map(a => (
                    <div key={a.edificioId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--slate-100)' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{a.edificio?.nombre}</span>
                        <span className={`badge badge-slate`} style={{ marginLeft: 8, fontSize: 11 }}>{ROL_LABEL[a.rol]}</span>
                      </div>
                      <button className="btn btn-danger btn-sm" onClick={() => quitar(a.edificioId)}>Quitar</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Asignar nuevo edificio */}
              {edificiosDisponibles.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)', letterSpacing: '.05em', marginBottom: 10 }}>
                    Agregar acceso
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 2 }}>
                      <label>Edificio</label>
                      <select value={asignEdificioId} onChange={e => setAsignEdificioId(e.target.value)}>
                        <option value="">Seleccionar…</option>
                        {edificiosDisponibles.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Rol</label>
                      <select value={asignRol} onChange={e => setAsignRol(e.target.value)}>
                        {ROLES_EDIFICIO.map(r => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
                      </select>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={asignar}
                    disabled={!asignEdificioId || asignando}
                  >
                    {asignando ? 'Asignando…' : '+ Agregar'}
                  </button>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
