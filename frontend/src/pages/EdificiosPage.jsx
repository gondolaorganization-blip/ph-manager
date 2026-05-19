import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

const EMPTY = { nombre: '', direccion: '', ruc: '', totalUnidades: '', fondoReserva: '', admin: '',
                diaCorte: '5', tipoMora: 'PORCENTAJE', tasaMora: '2', montoMoraFijo: '0',
                codigoUbicacion: '', folioReal: '' };

export default function EdificiosPage() {
  const navigate = useNavigate();
  const [edificios, setEdificios] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(false);
  const [editando, setEditando]   = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    try { const { data } = await api.get('/edificios'); setEdificios(data); }
    finally { setLoading(false); }
  }

  function abrirEditar(e) {
    setEditando(e);
    setForm({
      nombre:        e.nombre        || '',
      direccion:     e.direccion     || '',
      ruc:           e.ruc           || '',
      totalUnidades: e.totalUnidades || '',
      fondoReserva:  e.fondoReserva  || '',
      admin:         e.admin         || '',
      diaCorte:        e.diaCorte        || '5',
      tipoMora:        e.tipoMora        || 'PORCENTAJE',
      tasaMora:        e.tasaMora != null ? (Number(e.tasaMora) * 100).toFixed(2) : '2',
      montoMoraFijo:   e.montoMoraFijo != null ? Number(e.montoMoraFijo).toFixed(2) : '0',
      codigoUbicacion: e.codigoUbicacion || '',
      folioReal:       e.folioReal       || '',
    });
    setError('');
  }

  function buildPayload() {
    const esPorcentaje = form.tipoMora === 'PORCENTAJE';
    return {
      nombre:        form.nombre,
      ruc:           form.ruc,
      direccion:     form.direccion,
      totalUnidades: parseInt(form.totalUnidades) || 0,
      fondoReserva:  parseFloat(form.fondoReserva) || 0,
      admin:         form.admin,
      diaCorte:      parseInt(form.diaCorte) || 5,
      tipoMora:      form.tipoMora,
      tasaMora:        esPorcentaje ? (parseFloat(form.tasaMora) || 2) / 100 : 0,
      montoMoraFijo:   esPorcentaje ? 0 : parseFloat(form.montoMoraFijo) || 0,
      codigoUbicacion: form.codigoUbicacion || null,
      folioReal:       form.folioReal       || null,
    };
  }

  async function handleSubmit(ev) {
    ev.preventDefault(); setError(''); setSaving(true);
    try {
      await api.post('/edificios', buildPayload());
      setModal(false); setForm(EMPTY); cargar();
    } catch (err) { setError(err.response?.data?.error || 'Error al crear edificio'); }
    finally { setSaving(false); }
  }

  async function handleEditar(ev) {
    ev.preventDefault(); setError(''); setSaving(true);
    try {
      await api.put(`/edificios/${editando.id}`, buildPayload());
      setEditando(null); setForm(EMPTY); cargar();
    } catch (err) { setError(err.response?.data?.error || 'Error al actualizar edificio'); }
    finally { setSaving(false); }
  }

  function cerrarModal() { setModal(false); setEditando(null); setForm(EMPTY); setError(''); }

  function fmt(n) { return `$${Number(n).toLocaleString('es-PA', { minimumFractionDigits: 2 })}`; }

  const FormEdificio = ({ onSubmit, titulo, btnLabel }) => (
    <div className="modal-backdrop" onClick={cerrarModal}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{titulo}</h2>
          <button className="btn btn-ghost btn-sm" onClick={cerrarModal}>✕</button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group">
              <label>Nombre *</label>
              <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Dirección</label>
              <input value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>RUC</label>
                <input value={form.ruc} onChange={e => setForm(f => ({ ...f, ruc: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Total unidades *</label>
                <input type="number" min="1" required value={form.totalUnidades}
                  onChange={e => setForm(f => ({ ...f, totalUnidades: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Fondo de reserva ($)</label>
                <input type="number" min="0" step="0.01" value={form.fondoReserva}
                  onChange={e => setForm(f => ({ ...f, fondoReserva: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Administrador</label>
                <input value={form.admin} onChange={e => setForm(f => ({ ...f, admin: e.target.value }))} />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--slate-100)', paddingTop: 14, marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--slate-400)', marginBottom: 12 }}>
                Registro Público
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Código de Ubicación</label>
                  <input value={form.codigoUbicacion} placeholder="Ej: 8-25489"
                    onChange={e => setForm(f => ({ ...f, codigoUbicacion: e.target.value }))} />
                  <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>Registro Público de Panamá</span>
                </div>
                <div className="form-group">
                  <label>Folio Real</label>
                  <input value={form.folioReal} placeholder="Ej: 400-12345"
                    onChange={e => setForm(f => ({ ...f, folioReal: e.target.value }))} />
                  <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>Número de finca inscrita</span>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--slate-100)', paddingTop: 14, marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--slate-400)', marginBottom: 12 }}>
                Configuración de mora
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Día límite de pago (1–28)</label>
                  <input type="number" min="1" max="28" value={form.diaCorte}
                    onChange={e => setForm(f => ({ ...f, diaCorte: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Tipo de recargo</label>
                  <select value={form.tipoMora} onChange={e => setForm(f => ({ ...f, tipoMora: e.target.value }))}>
                    <option value="PORCENTAJE">Porcentaje del monto</option>
                    <option value="FIJO">Monto fijo en $</option>
                  </select>
                </div>
              </div>
              {form.tipoMora === 'PORCENTAJE' ? (
                <div className="form-group">
                  <label>Recargo por mora (%)</label>
                  <input type="number" min="0" max="100" step="0.01" value={form.tasaMora}
                    onChange={e => setForm(f => ({ ...f, tasaMora: e.target.value }))}
                    placeholder="2" />
                  <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>
                    Se aplicará una vez sobre el monto de la cuota al vencerse
                  </span>
                </div>
              ) : (
                <div className="form-group">
                  <label>Recargo fijo ($)</label>
                  <input type="number" min="0" step="0.01" value={form.montoMoraFijo}
                    onChange={e => setForm(f => ({ ...f, montoMoraFijo: e.target.value }))}
                    placeholder="5.00" />
                  <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>
                    Monto fijo que se añade al vencerse, independiente de la cuota
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={cerrarModal}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : btnLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>Edificios</h1>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setError(''); setModal(true); }}>
          + Nuevo edificio
        </button>
      </div>

      {loading ? (
        <div className="loading">Cargando…</div>
      ) : edificios.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 40 }}>🏢</div>
          <p>No tienes edificios registrados aún.</p>
        </div>
      ) : (
        <div className="edificio-grid">
          {edificios.map(e => {
            const diasTrial = e.trialVence
              ? Math.ceil((new Date(e.trialVence) - Date.now()) / 86400000)
              : null;
            return (
            <div key={e.id} className="edificio-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ margin: 0 }}>{e.nombre}</h3>
                {!e.suscripcionActiva && diasTrial !== null && (
                  diasTrial > 0
                    ? <span style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', borderRadius: 4, padding: '2px 7px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        Prueba: {diasTrial}d
                      </span>
                    : <span style={{ fontSize: 11, background: '#fee2e2', color: '#dc2626', borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>
                        VENCIDO
                      </span>
                )}
                {e.suscripcionActiva && (
                  <span style={{ fontSize: 11, background: '#dcfce7', color: '#16a34a', borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>
                    {e.plan}
                  </span>
                )}
              </div>
              <p>{e.direccion}</p>
              <div className="edificio-meta">
                <span>🏠 {e.totalUnidades} unidades</span>
                <span>💰 {fmt(e.fondoReserva)}</span>
                <span style={{ color: e.rolUsuario === 'ADMIN' ? 'var(--blue-700)' : 'var(--slate-500)' }}>
                  {e.rolUsuario}
                </span>
              </div>
              <div className="gap-8" style={{ flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={() => navigate(`/edificios/${e.id}/dashboard`)}>
                  Dashboard
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/edificios/${e.id}/cuotas`)}>
                  Cuotas
                </button>
                {e.rolUsuario === 'ADMIN' && (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(e)}>
                      ✏️ Editar
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/edificios/${e.id}/usuarios`)}>
                      👥 Usuarios
                    </button>
                  </>
                )}
              </div>
            </div>
          );
          })}
        </div>
      )}

      {modal    && <FormEdificio onSubmit={handleSubmit} titulo="Nuevo edificio"    btnLabel="Crear edificio" />}
      {editando && <FormEdificio onSubmit={handleEditar} titulo="Editar edificio"   btnLabel="Guardar cambios" />}
    </div>
  );
}
