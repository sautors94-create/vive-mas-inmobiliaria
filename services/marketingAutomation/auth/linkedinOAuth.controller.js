// ==========================================
// CONTROLADOR DE OAUTH DE LINKEDIN
// ==========================================
// Gestiona la conexión de la página de empresa
// de LinkedIn para Somos ViveMás.

const linkedinOAuthService = require('./linkedinOAuth.service');

// ==========================================
// GET /connect
// Genera la URL de autorización de LinkedIn
// ==========================================
const connect = async (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.user?.id;

    if (!tenantId) {
      return res.status(400).json({
        error: 'Se requiere tenantId',
      });
    }

    const state = JSON.stringify({
      tenantId,
      ts: Date.now(),
      nonce: linkedinOAuthService.generarState(),
    });

    const authUrl = linkedinOAuthService.buildAuthUrl(state);

    res.json({
      ok: true,
      authUrl,
    });

  } catch (error) {
    console.error('❌ Error generando conexión de LinkedIn:', error.message);

    res.status(500).json({
      error: error.message,
    });
  }
};


// ==========================================
// GET /callback
// Recibe el código de autorización de LinkedIn
// ==========================================
const callback = async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    // LinkedIn rechazó la autorización
    if (error) {
      console.error('❌ LinkedIn OAuth rechazado:', error_description || error);

      const baseUrl =
        process.env.CLIENT_URL || 'https://somosvivemas.com';

      return res.redirect(
        `${baseUrl}/dashboard.html?linkedin=error&msg=${encodeURIComponent(
          error_description || error
        )}`
      );
    }

    if (!code) {
      return res.status(400).json({
        error: 'Código de autorización de LinkedIn no recibido',
      });
    }

    // Validar state
    let tenantId = null;

    if (state) {
      try {
        const parsed = JSON.parse(state);
        tenantId = parsed.tenantId;
      } catch {
        tenantId = state;
      }
    }

    if (!tenantId) {
      return res.status(400).json({
        error: 'State inválido o ausente (anti-CSRF)',
      });
    }

    // Intercambiar código y guardar conexión
    await linkedinOAuthService.conectarTenant({
      tenantId,
      code,
      connectedBy: null,
    });

    // Redirigir al frontend
    const baseUrl =
      process.env.CLIENT_URL || 'https://somosvivemas.com';

    res.redirect(
      `${baseUrl}/dashboard.html?linkedin=conectado`
    );

  } catch (error) {
    console.error('❌ Error en callback de LinkedIn:', error.message);

    const baseUrl =
      process.env.CLIENT_URL || 'https://somosvivemas.com';

    res.redirect(
      `${baseUrl}/dashboard.html?linkedin=error&msg=${encodeURIComponent(
        error.message
      )}`
    );
  }
};


// ==========================================
// POST /disconnect
// ==========================================
const disconnect = async (req, res) => {
  try {
    const tenantId = req.body.tenantId || req.user?.id;

    if (!tenantId) {
      return res.status(400).json({
        error: 'Se requiere tenantId',
      });
    }

    const config =
      await linkedinOAuthService.desconectarTenant(tenantId);

    res.json({
      ok: true,
      mensaje: 'Cuenta de LinkedIn desconectada',
      config,
    });

  } catch (error) {
    console.error('❌ Error desconectando LinkedIn:', error.message);

    res.status(500).json({
      error: error.message,
    });
  }
};


// ==========================================
// GET /status
// ==========================================
const status = async (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.user?.id;

    if (!tenantId) {
      return res.status(400).json({
        error: 'Se requiere tenantId',
      });
    }

    const estado =
      await linkedinOAuthService.estadoTenant(tenantId);

    res.json({
      ok: true,
      ...estado,
    });

  } catch (error) {
    console.error('❌ Error consultando LinkedIn:', error.message);

    res.status(500).json({
      error: error.message,
    });
  }
};


module.exports = {
  connect,
  callback,
  disconnect,
  status,
};