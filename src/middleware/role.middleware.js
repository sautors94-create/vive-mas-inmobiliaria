'use strict';

/**
 * src/middleware/role.middleware.js — Guard de roles por petición
 * ---------------------------------------------------------------------------
 * Uso en montajes (src/app.js):
 *   app.use('/api/admin/marcas', authMiddleware, requireRole('admin'), adminMarcasRouter);
 *
 * Correcciones aplicadas sobre la versión original:
 *  1. Fail-fast en el montaje: requireRole() sin roles lanzaba un TypeError
 *     inmediato (config error), en vez de un 403 silencioso en cada petición
 *     que nadie sabría interpretar.
 *  2. Acepta ambas formas sin romper nada: requireRole('admin') y
 *     requireRole(['admin', 'superadmin']) (se aplana con .flat()).
 *  3. Contrato documentado: req.user y req.user.role los fija
 *     auth.middleware.js, y el role viene SIEMPRE de la BD (v2 del auth
 *     middleware). Si algún día este guard se usa sin authMiddleware delante,
 *     req.user no existirá → 401, nunca un bypass.
 *
 * Mensajes y códigos preservados para el frontend:
 *   401 'No autenticado' | 403 'Acceso denegado - permisos insuficientes'
 */

const requireRole = (...roles) => {
  // Acepta strings sueltos y/o arreglos: requireRole('a', ['b', 'c'])
  const rolesPermitidos = roles.flat(Infinity).filter(Boolean);

  if (rolesPermitidos.length === 0) {
    // Error de configuración del montaje: debe explotar al arrancar, no en producción petición a petición.
    throw new TypeError('requireRole exige al menos un rol: requireRole("admin")');
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!rolesPermitidos.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acceso denegado - permisos insuficientes' });
    }
    next();
  };
};

module.exports = requireRole;