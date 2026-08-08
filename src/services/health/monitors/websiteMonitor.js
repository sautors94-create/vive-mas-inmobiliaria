const http = require('http');
const https = require('https');

// Monitor del sitio web público.
// Hace una petición interna a la propia app (localhost en el puerto del server)
// para verificar online/offline, HTTP status y tiempo de respuesta.
const websiteMonitor = {
  async recolectar() {
    const resultado = {
      online: false,
      httpStatus: null,
      tiempoRespuestaMs: 0,
      erroresAcumulados: 0,
    };

    const puerto = process.env.PORT || 5000;
    const host = process.env.SELF_URL || 'localhost';
    const protocolo = host.startsWith('https') ? https : http;
    const hostSolo = host.replace(/^https?:\/\//, '');

    const inicio = Date.now();
    try {
      await new Promise((resolve, reject) => {
        const req = protocolo.get(
          {
            host: hostSolo,
            port: host.startsWith('https') ? undefined : puerto,
            path: '/api/admin/health/public',
            timeout: 5000,
          },
          (res) => {
            res.resume(); // consumir respuesta
            resultado.httpStatus = res.statusCode;
            resultado.online = res.statusCode >= 200 && res.statusCode < 500;
            resolve();
          }
        );
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.on('error', reject);
      });
    } catch (e) {
      resultado.online = false;
      resultado.httpStatus = null;
      resultado.erroresAcumulados = 1;
    }

    resultado.tiempoRespuestaMs = Date.now() - inicio;

    return resultado;
  },
};

module.exports = websiteMonitor;
