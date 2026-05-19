require('dotenv').config();
require('./config/validateEnv')();
const app  = require('./app');
const cron = require('node-cron');
const { calcularMoraTodos } = require('./services/mora.service');
const { enviarRecordatoriosAutomaticos } = require('./services/recordatorio.service');
const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`PH Manager API corriendo en puerto ${PORT} [${process.env.NODE_ENV}]`);
});

// Mora automática: diariamente a las 02:00 AM
cron.schedule('0 2 * * *', () => {
  console.log('[mora] Ejecutando cálculo automático...');
  calcularMoraTodos().catch(err => console.error('[mora] Error en cron:', err));
}, { timezone: 'America/Panama' });

// Recordatorios automáticos: diariamente a las 08:00 AM
cron.schedule('0 8 * * *', () => {
  console.log('[recordatorio] Ejecutando recordatorios automáticos...');
  enviarRecordatoriosAutomaticos().catch(err => console.error('[recordatorio] Error en cron:', err));
}, { timezone: 'America/Panama' });

// Ejecutar al arrancar para sincronizar desde el primer momento
calcularMoraTodos().catch(err => console.error('[mora] Error en arranque:', err));
