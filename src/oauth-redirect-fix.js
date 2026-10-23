/* ═══════════════════════════════════════════════════════════════════════
   oauth-redirect-fix.js — Vive Más Inmobiliaria · v1.0 (Task 46)
   ─────────────────────────────────────────────────────────────────────
   EL PROBLEMA
   Al pulsar "Conectar con Facebook" en el panel, el flujo de OAuth terminaba
   bien en Facebook, pero el callback del servidor mandaba el navegador a
   http://localhost:5500/dashboard.html?meta=conectado → ERR_CONNECTION_REFUSED
   ("localhost rechazó la conexión").
   localhost:5500 es el Live Server de VS Code: solo existe en la PC de
   desarrollo, NUNCA en producción (Hostinger). El callback de Meta
   (src/services/marketingAutomation/auth/metaOAuth.routes.js) tiene esa URL
   de retorno hardcodeada para desarrollo.

   LA SOLUCIÓN (sin tocar metaOAuth.routes.js)
   Un middleware que intercepta las respuestas ANTES de que salgan y reescribe
   cualquier cabecera Location que apunte a localhost / 127.0.0.1 / [::1]
   hacia el dominio público de producción. Cubre las 3 formas de redirigir:
     1) res.redirect(url) / res.redirect(301, url)     ← Express
     2) res.setHeader('Location', url) / res.set(...)  ← Express
     3) res.writeHead(302, { Location: url })          ← Node crudo
   El fragmento "#_=_" que Facebook añade al final es NORMAL (lo agrega
   siempre Facebook) e inofensivo: el dashboard lo ignora.

   REGLAS DE ORO
   - Solo actúa si la petición NO llega por localhost: en tu PC sigue siendo
     válido volver al Live Server. En pruebas puedes forzarlo con { forzar:true }.
   - Dominio destino: primera variable de entorno válida de la lista
     BASE_URL → SITE_URL → URL_PUBLICA → URL_BASE (se DESCARTAN las que
     apunten a localhost, p.ej. un .env de desarrollo copiado al servidor).
     Si no hay ninguna: https://somosvivemas.com
   - Idempotente: una URL ya corregida no se vuelve a tocar ni duplica log.
   - Jamás lanza: todo en try/catch; si algo fallara, la respuesta sigue su
     curso simplemente sin corrección.

   USO (app.js v7 ya lo hace):
     const { instalarCorreccionRedirecciones } = require('./oauth-redirect-fix');
     instalarCorreccionRedirecciones(app, { logger: console });
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

const RE_URL_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/i;
const ES_HOST_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i;
const DOMINIO_POR_DEFECTO = 'https://somosvivemas.com';

const limpiar = (t) => String(t == null ? '' : t).trim();

/* ── Dominio público de producción ─────────────────────────────────────── */
const determinarBasePublica = (env) => {
  const crudas = [env && env.BASE_URL, env && env.SITE_URL, env && env.URL_PUBLICA, env && env.URL_BASE];
  for (let c of crudas) {
    c = limpiar(c).replace(/\/+$/, '');
    if (!c) continue;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(c)) c = 'https://' + c; // admite "somosvivemas.com" sin esquema
    try {
      if (ES_HOST_LOCAL.test(new URL(c).hostname)) continue; // una BASE apuntando a localhost NO sirve en producción
    } catch (e) { continue; }
    return c;
  }
  return DOMINIO_POR_DEFECTO;
};

/* Reescritura pura: solo cambia el arranque local; el resto de la URL
   (ruta, query y el fragmento #_=_ que maneja el navegador) queda intacto. */
const reescribirUrl = (url, base) => {
  if (typeof url !== 'string' || !RE_URL_LOCAL.test(url)) return url;
  return url.replace(RE_URL_LOCAL, base);
};

const instalarCorreccionRedirecciones = (app, opciones = {}) => {
  const logger = opciones.logger || console;
  const forzar = opciones.forzar === true;

  app.use(function corregirRedireccionesLocales(req, res, next) {
    try {
      if (!forzar) {
        const host = limpiar(req.hostname || (req.headers && req.headers.host) || '')
          .toLowerCase().replace(/:\d+$/, '').replace(/^\[/, '').replace(/\]$/, '');
        // Desarrollo local: el backend se prueba desde localhost y ahí volver
        // al Live Server (localhost:5500) es legítimo → no tocamos nada.
        if (ES_HOST_LOCAL.test(host)) return next();
      }

      const base = determinarBasePublica(process.env);
      const avisar = (de, a) => {
        try {
          logger.warn && logger.warn('[oauth-fix] Retorno a localhost corregido en ' +
            (req.method || '?') + ' ' + (req.originalUrl || req.url || '?') + ': ' + de + ' → ' + a);
        } catch (e) { /* noop */ }
      };

      // 1) Express: res.redirect(url) / res.redirect(301, url)
      const redirectOriginal = res.redirect.bind(res);
      res.redirect = function (...args) {
        try {
          const i = args.findIndex((a) => typeof a === 'string');
          if (i >= 0) {
            const nuevo = reescribirUrl(args[i], base);
            if (nuevo !== args[i]) { avisar(args[i], nuevo); args[i] = nuevo; }
          }
        } catch (e) { /* noop */ }
        return redirectOriginal(...args);
      };

      // 2) Cabeceras sueltas: res.setHeader('Location', …) (res.set usa esto)
      const setHeaderOriginal = res.setHeader.bind(res);
      res.setHeader = function (nombre, valor) {
        try {
          if (typeof nombre === 'string' && typeof valor === 'string' && nombre.toLowerCase() === 'location') {
            const nuevo = reescribirUrl(valor, base);
            if (nuevo !== valor) { avisar(valor, nuevo); valor = nuevo; }
          }
        } catch (e) { /* noop */ }
        return setHeaderOriginal(nombre, valor);
      };

      // 3) Node crudo: res.writeHead(302, { Location: … })
      const writeHeadOriginal = res.writeHead.bind(res);
      res.writeHead = function (...args) {
        try {
          for (let i = 1; i < args.length; i++) {
            const h = args[i];
            if (Array.isArray(h)) {
              args[i] = h.map((par) =>
                (Array.isArray(par) && typeof par[0] === 'string' && par[0].toLowerCase() === 'location' && typeof par[1] === 'string')
                  ? [par[0], reescribirUrl(par[1], base)] : par);
            } else if (h && typeof h === 'object') {
              const copia = Object.assign({}, h);
              let cambio = false;
              for (const k of Object.keys(copia)) {
                if (k.toLowerCase() === 'location' && typeof copia[k] === 'string') {
                  const nuevo = reescribirUrl(copia[k], base);
                  if (nuevo !== copia[k]) { avisar(copia[k], nuevo); copia[k] = nuevo; cambio = true; }
                }
              }
              if (cambio) args[i] = copia;
            }
          }
        } catch (e) { /* noop */ }
        return writeHeadOriginal.apply(res, args);
      };
    } catch (e) { /* noop */ }
    next();
  });
};

module.exports = { instalarCorreccionRedirecciones, determinarBasePublica, reescribirUrl, DOMINIO_POR_DEFECTO };
