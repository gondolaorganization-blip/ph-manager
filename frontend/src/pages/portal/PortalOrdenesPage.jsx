import { useEffect, useState } from 'react';
import { usePortalAuth } from '../../context/PortalAuthContext';
import api from '../../api/client';

const ESTADOS = ['PENDIENTE', 'APROBADA', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA'];

const ESTADO_CFG = {
  PENDIENTE:  { label: 'Pendiente',   color: '#f59e0b', bg: '#fffbeb', dot: '#f59e0b' },
  APROBADA:   { label: 'Aprobada',    color: '#3b82f6', bg: '#eff6ff', dot: '#3b82f6' },
  EN_PROCESO: { label: 'En Proceso',  color: '#8b5cf6', bg: '#f5f3ff', dot: '#8b5cf6' },
  COMPLETADA: { label: 'Completada',  color: '#16a34a', bg: '#f0fdf4', dot: '#16a34a' },
  CANCELADA:  { label: 'Cancelada',   color: '#6b7280', bg: '#f9fafb', dot: '#9ca3af' },
};

const PRIORIDAD_CFG = {
  URGENTE: { label: 'Urgente', color: '#dc2626', bg: '#fef2f2' },
  NORMAL:  { label: 'Normal',  color: '#6b7280', bg: '#f9fafb' },
  BAJA:    { label: 'Baja',    color: '#94a3b8', bg: '#f8fafc' },
};

const SERVICIO_LABEL = {
  ELECTRICIDAD: 'Electricidad', PLOMERIA: 'Plomería', JARDINERIA: 'Jardinería',
  LIMPIEZA: 'Limpieza', PINTURA: 'Pintura', ASCENSOR: 'Ascensor',
  SEGURIDAD: 'Seguridad', OTROS: 'Otros',
};

function fmtFecha(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDatetime(d) {
  return new Date(d).toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PortalOrdenesPage() {
  const { propietario } = usePortalAuth();
  const edificioId = propietario?.unidad?.edificioId;

  const [ordenes, setOrdenes]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filtro, setFiltro]       = useState('');
  const [expandida, setExpandida] = useState(null);

  useEffect(() => {
    if (!edificioId) return;
    cargar();
  }, [edificioId, filtro]);

  async function cargar() {
    setLoading(true);
    try {
      const params = filtro ? `?estado=${filtro}` : '';
      const { data } = await api.get(`/portal/${edificioId}/ordenes${params}`);
      setOrdenes(data);
    } finally { setLoading(false); }
  }

  // Conteo por estado para los chips del filtro
  const conteos = ESTADOS.reduce((acc, e) => {
    acc[e] = ordenes.filter(o => o.estado === e).length;
    return acc;
  }, {});
  const totalActivas = (conteos.PENDIENTE || 0) + (conteos.APROBADA || 0) + (conteos.EN_PROCESO || 0);

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e3a5f', margin: 0 }}>
          Mantenimiento del Edificio
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
          Seguimiento de órdenes de trabajo en tu edificio
        </p>
      </div>

      {/* Resumen rápido */}
      {!loading && totalActivas > 0 && (
        <div style={{
          background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
          padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 16, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 500 }}>
            🔧 {totalActivas} orden{totalActivas !== 1 ? 'es' : ''} activa{totalActivas !== 1 ? 's' : ''}
          </span>
          {conteos.URGENTE > 0 && (
            <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
              ⚠ {conteos.URGENTE} urgente{conteos.URGENTE !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Filtro por estado */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        <FiltroChip
          label={`Todos (${ordenes.length})`}
          activo={filtro === ''}
          onClick={() => setFiltro('')}
        />
        {ESTADOS.map(e => {
          const cfg = ESTADO_CFG[e];
          return (
            <FiltroChip
              key={e}
              label={`${cfg.label} (${conteos[e] || 0})`}
              activo={filtro === e}
              onClick={() => setFiltro(filtro === e ? '' : e)}
              color={cfg.color}
            />
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Cargando…</div>
      ) : ordenes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔧</div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>
            {filtro ? `No hay órdenes en estado "${ESTADO_CFG[filtro]?.label}"` : 'No hay órdenes de trabajo registradas'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ordenes.map(orden => (
            <OrdenCard
              key={orden.id}
              orden={orden}
              expandida={expandida === orden.id}
              onToggle={() => setExpandida(expandida === orden.id ? null : orden.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FiltroChip({ label, activo, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
        fontSize: 12, fontWeight: activo ? 600 : 400,
        background: activo ? (color || '#1e3a5f') : '#f1f5f9',
        color: activo ? '#fff' : '#64748b',
        transition: 'all .15s',
      }}
    >
      {label}
    </button>
  );
}

function OrdenCard({ orden, expandida, onToggle }) {
  const estadoCfg    = ESTADO_CFG[orden.estado]    || ESTADO_CFG.PENDIENTE;
  const prioridadCfg = PRIORIDAD_CFG[orden.prioridad] || PRIORIDAD_CFG.NORMAL;

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
      overflow: 'hidden', transition: 'box-shadow .15s',
    }}>
      {/* Card header */}
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            {/* Badges */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                color: estadoCfg.color, background: estadoCfg.bg,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: estadoCfg.dot, flexShrink: 0 }} />
                {estadoCfg.label}
              </span>
              {orden.prioridad !== 'NORMAL' && (
                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  color: prioridadCfg.color, background: prioridadCfg.bg,
                }}>
                  {prioridadCfg.label}
                </span>
              )}
              <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 11, color: '#94a3b8', background: '#f8fafc' }}>
                #{orden.id}
              </span>
            </div>

            {/* Descripción */}
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#1e293b', lineHeight: 1.4 }}>
              {orden.descripcion}
            </p>

            {/* Proveedor */}
            {orden.proveedor && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#64748b' }}>
                🔧 {orden.proveedor.nombre}
                {orden.proveedor.servicio && (
                  <span style={{ marginLeft: 4, color: '#94a3b8' }}>
                    · {SERVICIO_LABEL[orden.proveedor.servicio] || orden.proveedor.servicio}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Fechas */}
          <div style={{ textAlign: 'right', fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>
            <div>Registrado</div>
            <div style={{ color: '#64748b', fontWeight: 500 }}>{fmtFecha(orden.fecha)}</div>
            {orden.fechaEstimada && (
              <>
                <div style={{ marginTop: 6 }}>Estimado</div>
                <div style={{ color: '#64748b', fontWeight: 500 }}>{fmtFecha(orden.fechaEstimada)}</div>
              </>
            )}
            {orden.fechaCierre && (
              <>
                <div style={{ marginTop: 6 }}>Cerrado</div>
                <div style={{ color: orden.estado === 'COMPLETADA' ? '#16a34a' : '#6b7280', fontWeight: 500 }}>
                  {fmtFecha(orden.fechaCierre)}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Toggle historial */}
        {orden.logs?.length > 0 && (
          <button
            onClick={onToggle}
            style={{
              marginTop: 12, padding: '4px 0', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 12, color: '#3b82f6', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {expandida ? '▲' : '▼'} Historial ({orden.logs.length} cambio{orden.logs.length !== 1 ? 's' : ''})
          </button>
        )}
      </div>

      {/* Historial de estados (expandible) */}
      {expandida && orden.logs?.length > 0 && (
        <div style={{ padding: '0 20px 16px', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {orden.logs.map((log, idx) => {
              const cfg = ESTADO_CFG[log.estado] || ESTADO_CFG.PENDIENTE;
              const isLast = idx === orden.logs.length - 1;
              return (
                <div key={idx} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {/* Línea de tiempo */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: cfg.dot, flexShrink: 0, marginTop: 3,
                    }} />
                    {!isLast && (
                      <div style={{ width: 2, flex: 1, minHeight: 20, background: '#e2e8f0', margin: '2px 0' }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: isLast ? 0 : 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>{fmtDatetime(log.creadoEn)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
