// Monitor de Hostinger.
// IMPORTANTE (regla nº22): NO inventar métricas.
// La API de Hostinger requiere una clave (HOSTINGER_API_KEY) y acceso de
// servidor/plan. Mientras no exista dicha clave en el entorno, este modulo
// reporta "Informacion no disponible mediante API" y documenta que se
// necesitaria para obtener cada metrica.
const hostingerMonitor = {
  async recolectar() {
    const apiKey = process.env.HOSTINGER_API_KEY;

    if (!apiKey) {
      return {
        disponible: false,
        error: 'Informacion no disponible mediante API, falta HOSTINGER_API_KEY.',
        documentacion: 'Para habilitar: agregar HOSTINGER_API_KEY en el entorno y usar la API oficial de Hostinger (hpanel/api). Se requiere plan de hosting con acceso API y permisos de solo lectura.',
        metricaRequerida: [
          'almacenamiento usado/disponible/total (API Hostinger -> usage/disk)',
          'inodes (API Hostinger o shell SSH: df -i)',
          'ancho de banda (API Hostinger o panel)',
          'CPU / RAM del servidor (API Hostinger o shell SSH)',
          'procesos / uptime (shell SSH o API)',
          'dominios/subdominios (API Hostinger DNS)',
          'errores del servidor (logs de acceso, solo si hay acceso SSH)',
        ],
      };
    }

    try {
      // En este punto HOSTINGER_API_KEY existe. Como no disponemos de un
      // SDK/endpoint especifico verificado, no inventamos cifras.
      return {
        disponible: false,
        apiKeyConfigurada: true,
        error: 'Informacion no disponible mediante API, el endpoint oficial de Hostinger aun no esta integrado.',
        documentacion: 'Implementar llamada a la API de Hostinger hpanel con la clave configurada y mapear las respuestas a este esquema.',
      };
    } catch (error) {
      return {
        disponible: false,
        error: error.message || 'Informacion no disponible mediante API',
      };
    }
  },
};

module.exports = hostingerMonitor;
