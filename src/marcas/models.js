'use strict';

/**
 * src/marcas/models.js — SHIM DE COMPATIBILIDAD (v4, 2026-10-18)
 * ---------------------------------------------------------------------------
 * ⚠️ ESTE ARCHIVO ES EL ARREGLO PRINCIPAL DEL ERROR:
 *      [marcas][autenticarMarca] Brand validation failed:
 *      accountId: Path `accountId` is required.
 *
 * POR QUÉ PASABA:
 *   Node resuelve `require('./models')` ASÍ: primero busca el ARCHIVO
 *   `models.js`, y solo si no existe usa la CARPETA `models/`. Este repositorio
 *   tenía un monolito antiguo `src/marcas/models.js` (con el esquema viejo:
 *   Brand.accountId required, BrandAccount sin `password`, y el modelo
 *   `BrandOTP`). Al integrar el módulo nuevo (carpeta `src/marcas/models/`),
 *   el archivo viejo SEGUÍA GANANDO por orden de resolución de Node:
 *
 *     require('./models')  →  models.js (VIEJO)  ✗  gana
 *                             models/index.js (NUEVO)  ✗  nunca se carga
 *
 *   Resultado: todos los controllers nuevos (que crean la marca con `cuenta`)
 *   chocan contra el esquema viejo (que exige `accountId`) → ValidationError
 *   en cada login/acceso al panel.
 *
 * LA SOLUCIÓN: este shim REEMPLAZA al monolito viejo y re-exporta la carpeta
 * nueva. Así, exista o no la carpeta, el `require('./models')` de SIEMPRE
 * carga los modelos correctos. Ya no hay forma de mezclar versiones.
 *
 * ⚠️ SUBIR ESTE ARCHIVO A: src/marcas/models.js  (sobrescribe el monolito).
 *    (No hace falta borrar nada más; si quieres, puedes eliminar también el
 *     contenido viejo que tenías — este archivo lo pisa por completo.)
 */

const modelosNuevos = require('./models/index');

module.exports = {
  ...modelosNuevos,
  // Compatibilidad con código antiguo que aún pida el nombre en mayúsculas:
  // el monolito viejo exportaba `BrandOTP`; el módulo nuevo usa `BrandOtp`.
  BrandOTP: modelosNuevos.BrandOtp,
};
