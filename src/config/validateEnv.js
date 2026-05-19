const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'];
const DEV_SECRET = 'ph_manager_dev_secret_change_in_production';

function validateEnv() {
  const missing = REQUIRED.filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`[config] Variables de entorno requeridas no configuradas: ${missing.join(', ')}`);
    process.exit(1);
  }

  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (secret === DEV_SECRET) {
      console.error('[config] FATAL: JWT_SECRET tiene el valor por defecto de desarrollo. Cámbialo antes de producción.');
      process.exit(1);
    }
    if (secret.length < 32) {
      console.error('[config] FATAL: JWT_SECRET debe tener al menos 32 caracteres en producción.');
      process.exit(1);
    }
  }

  if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
    console.warn('[config] ADVERTENCIA: FRONTEND_URL no está definido. CORS puede bloquear el frontend.');
  }
}

module.exports = validateEnv;
