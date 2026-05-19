export default function TrialBanner({ edificio }) {
  if (!edificio || edificio.suscripcionActiva) return null;

  const dias = edificio.trialVence
    ? Math.ceil((new Date(edificio.trialVence) - Date.now()) / 86400000)
    : null;

  if (dias === null) return null;

  if (dias <= 0) {
    return (
      <div style={{
        background: '#dc2626', color: '#fff', padding: '10px 24px',
        textAlign: 'center', fontSize: 13, fontWeight: 600,
      }}>
        El período de prueba ha vencido. Contacte al administrador para activar su suscripción.
      </div>
    );
  }

  const bg    = dias <= 3 ? '#ea580c' : dias <= 7 ? '#d97706' : '#1d4ed8';
  const texto = dias === 1 ? '1 día restante' : `${dias} días restantes`;

  return (
    <div style={{
      background: bg, color: '#fff', padding: '8px 24px',
      textAlign: 'center', fontSize: 13,
    }}>
      Período de prueba gratuito — <strong>{texto}</strong>. Contacte al administrador para continuar.
    </div>
  );
}
