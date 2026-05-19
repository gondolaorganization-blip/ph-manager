import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const EMPTY_FORM = { email: '', nombre: '', password: '', rol: 'OPERADOR' };

const ROL_COLOR = {
  ADMIN:    { background: 'var(--blue-100)', color: 'var(--blue-700)' },
  OPERADOR: { background: 'var(--slate-100)', color: 'var(--slate-600)' },
  AUDITOR:  { background: 'var(--amber-100)', color: 'var(--amber-700)' },
};

export default function UsuariosEdificioPage() {
  const { edificioId }    = useParams();
  const { user: authUser } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => { cargar(); }, [edificioId]);

  async function cargar() {
    setLoading(true);
    try {
      const { data } = await api.get(`/edificios/${edificioId}/usuarios`);
      setUsuarios(data);
    } catch (err) {
      if (err.response?.status === 403) setError('Solo los administradores pueden gestionar usuarios.');
      else setError('Error al cargar usuarios.');
    } finally { setLoading(false); }
  }

  async function handleAgregar(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.post(`/edificios/${edificioId}/usuarios`, form);
      setModal(false); setForm(EMPTY_FORM); cargar();
    } catch (err) { setError(err.response?.data?.error || 'Error al agregar usuario'); }
    finally { setSaving(false); }
  }

  async function handleRemover(usuarioId) {
    try {
      await api.delete(`/edificios/${edificioId}/usuarios/${usuarioId}`);
      setConfirmDel(null); cargar();
    } catch (err) { alert(err.response?.data?.error || 'Error al remover usuario'); }
  }

  function cerrar() { setModal(false); setForm(EMPTY_FORM); setError(''); }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Usuarios del edificio</h1>
        <button className="btn btn-primary" onClick={() => { setError(''); setModal(true); }}>
          + Agregar usuario
        </button>
      </div>

      {error && !modal && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div className="loading">Cargando…</div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol sistema</th>
                <th>Rol edificio</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--slate-400)' }}>Sin usuarios</td></tr>
              ) : usuarios.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.nombre}</strong></td>
                  <td style={{ color: 'var(--slate-500)' }}>{u.email}</td>
                  <td><span className="badge" style={{ background: 'var(--slate-100)', color: 'var(--slate-600)' }}>{u.rol}</span></td>
                  <td>
                    <span className="badge" style={ROL_COLOR[u.rolEdificio] || ROL_COLOR.OPERADOR}>
                      {u.rolEdificio}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {u.id !== authUser?.id && (
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-600)' }}
                        onClick={() => setConfirmDel(u)}>
                        Remover
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={cerrar}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Agregar usuario</h2>
              <button className="btn btn-ghost btn-sm" onClick={cerrar}>✕</button>
            </div>
            <form onSubmit={handleAgregar}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem', marginTop: 0 }}>
                  Si el email ya existe en el sistema, se agrega directamente. Si es nuevo, completa nombre y contraseña.
                </p>
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" required value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Nombre (usuario nuevo)</label>
                    <input value={form.nombre}
                      onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Contraseña (usuario nuevo)</label>
                    <input type="password" value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Rol en el edificio</label>
                  <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
                    <option value="ADMIN">ADMIN — acceso total</option>
                    <option value="OPERADOR">OPERADOR — registro y pagos</option>
                    <option value="AUDITOR">AUDITOR — solo lectura</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={cerrar}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Agregando…' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDel && (
        <div className="modal-backdrop" onClick={() => setConfirmDel(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirmar</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>¿Remover a <strong>{confirmDel.nombre}</strong> del edificio?</p>
              <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>
                El usuario seguirá existiendo en el sistema, solo perderá acceso a este edificio.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ background: 'var(--red-600)' }}
                onClick={() => handleRemover(confirmDel.id)}>
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
