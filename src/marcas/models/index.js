'use strict';

/**
 * src/marcas/models/index.js — Barrel de modelos del módulo Marcas.
 * ---------------------------------------------------------------------------
 * `require('./models')` desde controllers/routes resuelve a ESTE archivo SIEMPRE
 * que no exista src/marcas/models.js (models.js gana por orden de resolución de
 * Node). El monolito antiguo models.js quedó obsoleto: RENOMBRAR/ELIMINAR al
 * integrar (aquí quedó guardado como models.js.bak para consulta).
 *
 * Los modelos se registran en mongoose con nombres estables:
 *   Brand, BrandAccount, BrandOtp, BrandCategory, BrandCity, BrandAuditLog
 * El test de integración importa los archivos individuales; por el registro
 * compartido de mongoose ambas rutas obtienen el MISMO modelo.
 */

module.exports = {
  Brand: require('./Brand'),
  BrandAccount: require('./BrandAccount'),
  BrandOtp: require('./BrandOtp'),
  BrandCategory: require('./BrandCategory'),
  BrandCity: require('./BrandCity'),
  BrandAuditLog: require('./BrandAuditLog'),
};
