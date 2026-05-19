const { calcularMoraEdificio } = require('../services/mora.service');

// POST /api/edificios/:edificioId/mora/calcular
async function calcular(req, res) {
  try {
    const result = await calcularMoraEdificio(req.edificioId);
    res.json({
      message:      `Mora calculada: ${result.actualizados} pago(s) actualizado(s) de ${result.procesados} vencido(s)`,
      procesados:   result.procesados,
      actualizados: result.actualizados,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular mora' });
  }
}

module.exports = { calcular };
