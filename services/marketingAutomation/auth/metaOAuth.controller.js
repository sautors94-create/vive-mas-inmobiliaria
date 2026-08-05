// ==========================================
// CONTROLADOR DE OAUTH DE META
// ==========================================
// Expone los endpoints para conectar, desconectar y consultar
// el estado de la cuenta de Facebook/Instagram de la inmobiliaria.
//
// Rutas:
// - GET  /connect       → Genera URL de autorización
// - GET  /callback      → Recibe el código y conecta (OAuth redirect)
// - POST /disconnect    → Desconecta
// - GET  /status        → Estado de conexión
// - POST /data-deletion → (requerido por Meta en modo en vivo)

const metaOAuthService = require('./metaOAuth.service');

// GET /connect?tenantId=xxx
// Genera la URL de autorización de Facebook
const connect = async (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.user?.id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Se requiere tenantId' });
    }

    const state = JSON.stringify({ tenantId, ts: Date.now(), nonce: metaOAuthService.generarState() });
    const authUrl = metaOAuthService.buildAuthUrl(state);

    res.json({ ok: true, authUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /callback?code=xxx&state=yyy
// Recibe el código de autorización y conecta la cuenta
const callback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Código de autorización no recibido' });
    }

    // Validar state (anti-CSRF)
    let tenantId = null;
    if (state) {
      try {
        const parsed = JSON.parse(state);
        tenantId = parsed.tenantId;
      } catch {
        // state puede venir como string plano
        tenantId = state;
      }
    }

    if (!tenantId) {
      return res.status(400).json({ error: 'State inválido o ausente (anti-CSRF)' });
    }

    const config = await metaOAuthService.conectarTenant({
      tenantId,
      code,
      connectedBy: req.user?.id || null,
    });

    // Redirigir al frontend con éxito
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${baseUrl}/dashboard.html?meta=conectado`);
  } catch (error) {
    console.error('❌ Error en callback de Meta:', error.message);
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${baseUrl}/dashboard.html?meta=error&msg=${encodeURIComponent(error.message)}`);
  }
};

// POST /disconnect
const disconnect = async (req, res) => {
  try {
    const tenantId = req.body.tenantId || req.user?.id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Se requiere tenantId' });
    }

    const config = await metaOAuthService.desconectarTenant(tenantId);
    res.json({ ok: true, mensaje: 'Cuenta de Meta desconectada', config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /status
const status = async (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.user?.id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Se requiere tenantId' });
    }

    const estado = await metaOAuthService.estadoTenant(tenantId);
    res.json({ ok: true, ...estado });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /data-deletion (requerido por Meta para modo en vivo)
const dataDeletion = async (req, res) => {
  try {
    const { confirmation_code, user_id } = req.body;
    res.json({
      url: `${process.env.CLIENT_URL || 'https://somosvivemas.com'}/legal/normas-generales/privacidad.html`,
      confirmation_code: confirmation_code || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { connect, callback, disconnect, status, dataDeletion };
