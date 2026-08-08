const { cloudinary } = require('../../../config/cloudinary');

// Monitor de Cloudinary usando la API oficial de usage.
// https://cloudinary.com/documentation/admin_api#get_usage
// Si la llamada falla (sin key, sin acceso), reporta error sin inventar datos.
const cloudinaryMonitor = {
  async recolectar() {
    const resultado = {
      healthy: false,
      almacenamientoUsadoMB: 0,
      almacenamientoLímiteMB: 0,
      almacenamientoPorcentaje: 0,
      recursos: 0,
      anchoBandaUsadoMB: 0,
      anchoBandaLímiteMB: 0,
      transformaciones: 0,
      transformacionesLímite: 0,
      imagenes: 0,
      videos: 0,
      archivos: 0,
      error: null,
    };

    try {
      const usage = await cloudinary.api.usage();
      if (!usage) {
        resultado.error = 'No se pudo obtener el uso de Cloudinary';
        return resultado;
      }

      resultado.healthy = true;

      // Almacenamiento (bytes)
      const usadoBytes = usage.credits?.usage?.[0] ?? usage.plan?.storage?.usage ?? 0;
      const limiteBytes = usage.plan?.storage?.limit ?? usage.plan?.storage?.credits_limit ?? 0;

      resultado.almacenamientoUsadoMB = Math.round((usadoBytes || 0) / (1024 * 1024));
      resultado.almacenamientoLímiteMB = Math.round((limiteBytes || 0) / (1024 * 1024));
      if (limiteBytes > 0) {
        resultado.almacenamientoPorcentaje = Math.round(((usadoBytes || 0) / limiteBytes) * 100);
      }

      // Recursos
      if (usage.plan?.resources) {
        resultado.recursos = usage.plan.resources.usage || 0;
      }

      // Ancho de banda
      const bwUsado = usage.plan?.bandwidth?.usage ?? 0;
      const bwLimite = usage.plan?.bandwidth?.limit ?? 0;
      resultado.anchoBandaUsadoMB = Math.round((bwUsado || 0) / (1024 * 1024));
      resultado.anchoBandaLímiteMB = Math.round((bwLimite || 0) / (1024 * 1024));

      // Transformaciones
      if (usage.plan?.transformations) {
        resultado.transformaciones = usage.plan.transformations.usage || 0;
        resultado.transformacionesLímite = usage.plan.transformations.limit || 0;
      }

      // Recursos por tipo: imágenes, videos, archivos
      if (usage.plan?.resources?.breakdown) {
        const bd = usage.plan.resources.breakdown;
        resultado.imagenes = bd.image || 0;
        resultado.videos = bd.video || 0;
        resultado.archivos = bd.raw || 0;
      }
    } catch (error) {
      resultado.error = error.message || 'Error al consultar Cloudinary';
    }

    return resultado;
  },
};

module.exports = cloudinaryMonitor;
