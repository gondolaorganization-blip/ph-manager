import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const EMPTY_FORM = { nombre: '', cedula: '', email: '', telefono: '' };
const FILTROS = ['Todos', 'Con propietario', 'Sin propietario'];

function hoy()  { return new Date().toISOString().slice(0, 10); }
function primerDiaAnio() { return `${new Date().getFullYear()}-01-01`; }

export default function PropietariosPage() {
  const { edificioId }     = useParams();
  const { user }           = useAuth();
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filtro, setFiltro]     = useState('Todos');
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal]       = useState(null); // unidad seleccionada
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [confirmDel, setConfirmDel] = useState(null);

  // rolUsuario comes from Layout via the edificio fetch — here we read it from the first unidad response
  // We determine edit rights from the building response stored in Layout, but we can also just
  // check user.rol; for simplicity: show edit buttons always, server enforces soloAdminEdificio
  const [rolEdificio, setRolEdificio] = useState(null);

  // Estado de cuenta
  const [desde, setDesde]             = useState(primerDiaAnio());
  const [hasta, setHasta]             = useState(hoy());
  const [modalEnvio, setModalEnvio]   = useState(false);
  const [excluidos, setExcluidos]     = useState(new Set());
  const [enviando, setEnviando]       = useState(false);
  const [resultEnvio, setResultEnvio] = useState(null);

  // Portal
  const [modalPortal, setModalPortal]     = useState(null); // unidad seleccionada
  const [portalPwd,   setPortalPwd]       = useState('');
  const [portalActivo, setPortalActivo]   = useState(false);
  const [portalSaving, setPortalSaving]   = useState(false);
  const [portalError,  setPortalError]    = useState('');

  // Garita config
  const [modalGarita, setModalGarita]     = useState(false);
  const [garitaPin,   setGaritaPin]       = useState('');
  const [garitaActivo, setGaritaActivo]   = useState(true);
  const [garitaSaving, setGaritaSaving]   = useState(false);
  const [garitaError,  setGaritaError]    = useState('');

  useEffect(() => { cargar(); }, [edificioId]);

  async function cargar() {
    setLoading(true);
    try {
      const [unRes, edRes] = await Promise.all([
        api.get(`/edificios/${edificioId}/unidades`),
        api.get(`/edificios/${edificioId}`),
      ]);
      setUnidades(unRes.data);
      setRolEdificio(edRes.data.rolUsuario);
    } finally { setLoading(false); }
  }

  const esAdmin = rolEdificio === 'ADMIN' || user?.rol === 'SUPER_ADMIN';

  async function descargarEstado(unidad) {
    try {
      const { data } = await api.get(
        `/edificios/${edificioId}/estado-cuenta/${unidad.id}?desde=${desde}&hasta=${hasta}`,
        { responseType: 'blob' },
      );
      const url  = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `EstadoCuenta_${unidad.numero}_${desde}_${hasta}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch { alert('Error al generar el estado de cuenta'); }
  }

  function abrirEnvioMasivo() {
    setExcluidos(new Set());
    setResultEnvio(null);
    setModalEnvio(true);
  }

  function toggleExcluir(id) {
    setExcluidos(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  async function enviarMasivo() {
    setEnviando(true); setResultEnvio(null);
    try {
      const conEmail = unidades.filter(u => u.propietario?.email);
      const excluir  = [...excluidos];
      const incluir  = conEmail.filter(u => !excluidos.has(u.id)).map(u => u.id);
      const { data } = await api.post(`/edificios/${edificioId}/estado-cuenta/enviar`, {
        unidadIds: incluir, desde, hasta,
      });
      setResultEnvio({ ok: true, ...data });
    } catch (err) {
      setResultEnvio({ ok: false, mensaje: err.response?.data?.error || 'Error al enviar' });
    } finally { setEnviando(false); }
  }

  function abrirModal(u) {
    setError('');
    setForm(u.propietario
      ? { nombre: u.propietario.nombre, cedula: u.propietario.cedula || '', email: u.propietario.email || '', telefono: u.propietario.telefono || '' }
      : EMPTY_FORM,
    );
    setModal(u);
  }

  async function guardar(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.put(`/edificios/${edificioId}/unidades/${modal.id}/propietario`, form);
      setModal(null); setForm(EMPTY_FORM); cargar();
    } catch (err) { setError(err.response?.data?.error || 'Error al guardar'); }
    finally { setSaving(false); }
  }

  async function abrirPortal(u) {
    setPortalPwd('');
    setPortalActivo(u.propietario?.portalActivo ?? false);
    setPortalError('');
    setModalPortal(u);
  }

  async function guardarPortal() {
    setPortalError(''); setPortalSaving(true);
    try {
      const body = { activo: portalActivo };
      if (portalPwd) body.password = portalPwd;
      await api.put(`/edificios/${edificioId}/unidades/${modalPortal.id}/propietario/portal`, body);
      setModalPortal(null);
      cargar();
    } catch (err) {
      setPortalError(err.response?.data?.error || 'Error al guardar');
    } finally { setPortalSaving(false); }
  }

  async function abrirGarita() {
    setGaritaError('');
    try {
      const { data } = await api.get(`/edificios/${edificioId}/garita-config`);
      setGaritaPin(data.pin ?? '');
      setGaritaActivo(data.activo ?? true);
    } catch { setGaritaPin(''); setGaritaActivo(true); }
    setModalGarita(true);
  }

  async function guardarGarita() {
    setGaritaError(''); setGaritaSaving(true);
    try {
      await api.put(`/edificios/${edificioId}/garita-config`, { pin: garitaPin, activo: garitaActivo });
      setModalGarita(false);
    } catch (err) {
      setGaritaError(err.response?.data?.error || 'Error al guardar');
    } finally { setGaritaSaving(false); }
  }

  async function desvincular(unidadId) {
    try {
      await api.delete(`/edificios/${edificioId}/unidades/${unidadId}/propietario`);
      setConfirmDel(null); cargar();
    } catch (err) { alert(err.response?.data?.error || 'Error al desvincular'); }
  }

  const filtradas = unidades.filter(u => {
    if (filtro === 'Con propietario' && !u.propietario) return false;
    if (filtro === 'Sin propietario' &&  u.propietario) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return (
        u.numero.toLowerCase().includes(q) ||
        u.propietario?.nombre.toLowerCase().includes(q) ||
        u.propietario?.cedula?.toLowerCase().includes(q) ||
        u.propietario?.email?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const total          = unidades.length;
  const conPropietario = unidades.filter(u => u.propietario).length;

  if (loading) return <div className="loading">Cargando…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Propietarios</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: 'var(--slate-500)' }}>Período:</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--slate-300)' }} />
          <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>—</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--slate-300)' }} />
          <a href={`/api/edificios/${edificioId}/propietarios.xlsx`}
            className="btn btn-ghost btn-sm" download>⬇ Excel</a>
          {esAdmin && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={abrirEnvioMasivo} title="Enviar estado de cuenta a todos por correo">
                📧 Enviar a todos
              </button>
              <button className="btn btn-ghost btn-sm" onClick={abrirGarita} title="Configurar garita de seguridad">
                🔐 Garita
              </button>
            </>
          )}
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Total unidades</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Con propietario</div>
          <div className="stat-value stat-green">{conPropietario}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Sin propietario</div>
          <div className="stat-value stat-amber">{total - conPropietario}</div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {FILTROS.map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filtro === f ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFiltro(f)}
          >
            {f}
          </button>
        ))}
        <input
          placeholder="Buscar por unidad, nombre, cédula…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ marginLeft: 'auto', width: 260, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--slate-200)', fontSize: 13 }}
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Unidad</th>
                <th>Nombre</th>
                <th>Cédula</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Estado</th>
                {esAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr><td colSpan={esAdmin ? 7 : 6} style={{ textAlign: 'center', color: 'var(--slate-400)', padding: 24 }}>Sin resultados</td></tr>
              ) : filtradas.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.numero}</strong>{u.piso != null && <span style={{ color: 'var(--slate-400)', fontSize: 12, marginLeft: 4 }}>Piso {u.piso}</span>}</td>
                  <td>
                    {u.propietario
                      ? <strong>{u.propietario.nombre}</strong>
                      : <span style={{ color: 'var(--slate-400)', fontStyle: 'italic' }}>Sin propietario</span>}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--slate-600)' }}>{u.propietario?.cedula || '—'}</td>
                  <td style={{ fontSize: 13, color: 'var(--slate-600)' }}>{u.propietario?.telefono || '—'}</td>
                  <td style={{ fontSize: 13, color: 'var(--slate-600)' }}>{u.propietario?.email || '—'}</td>
                  <td>
                    {u.morosa
                      ? <span className="badge badge-red">Morosa</span>
                      : u.saldoPendiente > 0
                        ? <span className="badge badge-amber">Pendiente</span>
                        : u.propietario
                          ? <span className="badge badge-green">Al día</span>
                          : <span className="badge badge-slate">—</span>}
                  </td>
                  {esAdmin && (
                    <td>
                      <div className="gap-8">
                        {u.propietario && (
                          <button className="btn btn-ghost btn-sm" onClick={() => descargarEstado(u)}
                            title={`Estado de cuenta ${desde} – ${hasta}`}>
                            📄 EC
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => abrirModal(u)}>
                          {u.propietario ? 'Editar' : '+ Asignar'}
                        </button>
                        {u.propietario && (
                          <button className="btn btn-ghost btn-sm" onClick={() => abrirPortal(u)}
                            title="Configurar acceso al portal web">
                            {u.propietario?.portalActivo ? '🟢 Portal' : '⚪ Portal'}
                          </button>
                        )}
                        {u.propietario && (
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-600)' }}
                            onClick={() => setConfirmDel(u)}>
                            Desvincular
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal editar/asignar */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal.propietario ? 'Editar propietario' : 'Asignar propietario'} — Unidad {modal.numero}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <form onSubmit={guardar}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label>Nombre completo *</label>
                  <input required autoFocus value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Cédula / Pasaporte</label>
                    <input value={form.cedula}
                      onChange={e => setForm(f => ({ ...f, cedula: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Teléfono</label>
                    <input value={form.telefono}
                      onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal envío masivo de estados de cuenta */}
      {modalEnvio && (() => {
        const conEmail = unidades.filter(u => u.propietario?.email);
        const seleccionados = conEmail.filter(u => !excluidos.has(u.id));
        return (
          <div className="modal-backdrop" onClick={() => setModalEnvio(false)}>
            <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Enviar estados de cuenta por correo</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setModalEnvio(false)}>✕</button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: 'var(--slate-50)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--slate-200)', fontSize: 13 }}>
                  Período: <strong>{desde}</strong> al <strong>{hasta}</strong>
                </div>

                {resultEnvio && (
                  <div className={`alert ${resultEnvio.ok ? 'alert-success' : 'alert-error'}`}>
                    {resultEnvio.ok ? `✓ ${resultEnvio.message}` : resultEnvio.mensaje}
                    {resultEnvio.errores?.length > 0 && (
                      <div style={{ marginTop: 6, fontSize: 12 }}>
                        {resultEnvio.errores.map((e, i) => <div key={i}>✗ {e.nombre}: {e.error}</div>)}
                      </div>
                    )}
                  </div>
                )}

                {conEmail.length === 0 ? (
                  <div className="alert alert-error">No hay propietarios con email registrado.</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>
                        {seleccionados.length} de {conEmail.length} propietarios seleccionados
                      </span>
                      <div className="gap-8">
                        <button className="btn btn-ghost btn-sm" onClick={() => setExcluidos(new Set())}>Todos</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setExcluidos(new Set(conEmail.map(u => u.id)))}>Ninguno</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto' }}>
                      {conEmail.map(u => {
                        const checked = !excluidos.has(u.id);
                        return (
                          <label key={u.id} style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
                            borderRadius: 6, cursor: 'pointer',
                            background: checked ? '#f0fdf4' : 'var(--slate-50)',
                            border: `1px solid ${checked ? '#bbf7d0' : 'var(--slate-200)'}`,
                          }}>
                            <input type="checkbox" checked={checked} onChange={() => toggleExcluir(u.id)} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{u.propietario.nombre}</div>
                              <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>
                                Unidad {u.numero} · {u.propietario.email}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setModalEnvio(false)}>Cerrar</button>
                <button className="btn btn-primary"
                  disabled={enviando || seleccionados.length === 0 || !!resultEnvio?.ok}
                  onClick={enviarMasivo}>
                  {enviando ? 'Enviando…' : `Enviar a ${seleccionados.length} propietario(s)`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal configurar portal */}
      {modalPortal && (
        <div className="modal-backdrop" onClick={() => setModalPortal(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Portal web — {modalPortal.propietario?.nombre}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalPortal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {portalError && <div className="alert alert-error">{portalError}</div>}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={portalActivo} onChange={e => setPortalActivo(e.target.checked)} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Portal activo</span>
              </label>
              <div className="form-group">
                <label>Contraseña de acceso</label>
                <input type="password" value={portalPwd} onChange={e => setPortalPwd(e.target.value)}
                  placeholder="Dejar vacío para no cambiar" />
                <small style={{ color: 'var(--slate-400)', fontSize: 11 }}>Mínimo 6 caracteres</small>
              </div>
              {modalPortal.propietario?.email && (
                <div style={{ background: 'var(--slate-50)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--slate-600)', border: '1px solid var(--slate-200)' }}>
                  El propietario accede con: <strong>{modalPortal.propietario.email}</strong>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalPortal(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={portalSaving} onClick={guardarPortal}>
                {portalSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal garita config */}
      {modalGarita && (
        <div className="modal-backdrop" onClick={() => setModalGarita(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Configurar Garita de Seguridad</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalGarita(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {garitaError && <div className="alert alert-error">{garitaError}</div>}
              <div className="form-group">
                <label>PIN de acceso (4–8 dígitos)</label>
                <input type="password" inputMode="numeric" pattern="\d*"
                  value={garitaPin} onChange={e => setGaritaPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="1234" maxLength={8} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={garitaActivo} onChange={e => setGaritaActivo(e.target.checked)} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Garita activa</span>
              </label>
              {garitaPin.length >= 4 && (
                <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 14px', fontSize: 13, border: '1px solid #bbf7d0' }}>
                  URL de acceso: <strong>/garita/{edificioId}</strong>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalGarita(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={garitaSaving} onClick={guardarGarita}>
                {garitaSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar desvincular */}
      {confirmDel && (
        <div className="modal-backdrop" onClick={() => setConfirmDel(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirmar</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>¿Desvincular a <strong>{confirmDel.propietario?.nombre}</strong> de la unidad <strong>{confirmDel.numero}</strong>?</p>
              <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>
                El registro de pagos no se verá afectado.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ background: 'var(--red-600)' }}
                onClick={() => desvincular(confirmDel.id)}>
                Desvincular
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
