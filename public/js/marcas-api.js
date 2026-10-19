// Cliente de la API de Marcas y Profesionales Aliados.
// Usa su PROPIA sesión (vm_brand_token): es independiente de la sesión de usuarios/admin.
// Requiere api.js (API_URL) cargado antes.
//
// v2.3 — ACCESO A PRUEBA DE CONFIGURACIÓN DE ORIGEN:
//   Toda URL se NORMALIZA al origen del navegador cuando la API vive en la
//   misma web. Esto mata de raíz el bucle "No pudimos cargar tu panel /
//   Sin conexión" causado por:
//     (a) página servida con www y API_URL sin www (o viceversa) → CORS
//         rechazaba la petición y el fetch moría con status 0;
//     (b) API_URL en http:// mientras la página está en https:// (mixed
//         content bloqueado por el navegador);
//     (c) API_URL apuntando a http://localhost:5000 (residuo de desarrollo)
//         en producción.
//   Si API_URL apunta a OTRO host real (staging, etc.), NO se toca.
//
// CONTRATO BACKEND v2:
//   - Refresh: POST /api/marcas/auth/refrescar (¡con Z!) — usa la cookie
//     httpOnly vm_brand_refresh (path /api/marcas/auth) que el backend puso
//     al verificar el código o al iniciar sesión con contraseña. No lleva
//     Authorization.
//   - Login diario de marca: POST /auth/login { email, contrasena }.
//   - NO existe /auth/logout: salir = borrar el token local.
//     La cookie de refresco expira sola (httpOnly, no se puede borrar desde JS).
const MarcasAPI = (() => {
  const KEY = 'vm_brand_token';
  // Marca en localStorage de que el dispositivo YA tuvo sesión de marca.
  // Evita llamar a /auth/refrescar en cada visita de un desconocido (que
  // pintaba un 401 inútil en la consola del navegador).
  const SESION_FLAG = 'vm_brand_had_session';

  console.log('[marcas-api] v2.3 (acceso mismo-origen automático)');

  // ── normalización de origen ─────────────────────────────────────────────
  const ES_DEV = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/;
  const normalizarOrigen = () => {
    const crudo = String(typeof API_URL === 'undefined' ? '' : API_URL || '').trim();
    // Vacío o relativo ('' o '/algo') → la API vive en el MISMO origen: no hay
    // nada que normalizar y no debemos arrastrar el path de la página actual.
    if (!crudo || crudo.startsWith('/')) return location.origin;
    let a;
    try { a = new URL(crudo, location.href); } catch (e) { return crudo.replace(/\/+$/, ''); }
    const hostPagina = String(location.hostname || '').replace(/^www\./, '');
    const hostApi = a.hostname.replace(/^www\./, '');
    // Misma web (www vs dominio desnudo) o API en localhost con la página ya
    // publicada → reescribimos al origen EXACTO desde el que se carga la página.
    if (hostApi === hostPagina || (ES_DEV.test(a.hostname) && !ES_DEV.test(location.hostname))) {
      a.protocol = location.protocol;
      a.hostname = location.hostname; // conserva www si la página la usa
      a.port = location.port;
    }
    return (a.origin + a.pathname).replace(/\/+$/, '');
  };

  const base = () => `${normalizarOrigen()}/api/marcas`;

  const token = () => { try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
  const guardar = (t) => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch (e) { /* sin storage */ } };
  const marcarSesion = () => { try { localStorage.setItem(SESION_FLAG, '1'); } catch (e) { /* sin storage */ } };

  let renovando = null;
  const renovar = () => {
    // Sin cookie de refresco (p. ej. otra pestaña nueva) el backend responde
    // 401 y devolvemos false: el panel mandará al usuario al acceso.
    if (!renovando) {
      renovando = fetch(`${base()}/auth/refrescar`, {
        method: 'POST',
        credentials: 'include' // envía la cookie httpOnly vm_brand_refresh
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d && d.accessToken) { guardar(d.accessToken); marcarSesion(); return true; }
          guardar('');
          return false;
        })
        .catch(() => false)
        .finally(() => { renovando = null; });
    }
    return renovando;
  };

  const llamar = async (metodo, ruta, cuerpo, opciones = {}) => {
    const hacer = () => {
      const headers = {};
      const t = token();
      if (t) headers.Authorization = `Bearer ${t}`;
      const init = { method: metodo, headers, credentials: 'include' };
      if (cuerpo instanceof FormData) init.body = cuerpo;
      else if (cuerpo !== undefined) { headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(cuerpo); }
      return fetch(`${base()}${ruta}`, init);
    };
    let res;
    try { res = await hacer(); } catch (e) { return { ok: false, status: 0, error: `Sin conexión con el servidor. Revisa tu internet e intenta de nuevo. (detalle: ${e && e.message ? e.message : 'red'})` }; }
    if (res.status === 401 && opciones.sesion !== false && (await renovar())) {
      try { res = await hacer(); } catch (e) { return { ok: false, status: 0, error: `Sin conexión con el servidor. Revisa tu internet e intenta de nuevo. (detalle: ${e && e.message ? e.message : 'red'})` }; }
    }
    let data = {};
    try { data = await res.json(); } catch (e) { /* respuesta sin cuerpo */ }
    return { ...data, ok: res.ok && data.ok !== false, status: res.status, error: res.ok ? undefined : (data.error || 'Ocurrió un error. Intenta de nuevo.') };
  };

  return {
    token, guardar,
    get: (r, o) => llamar('GET', r, undefined, o),
    post: (r, b, o) => llamar('POST', r, b === undefined ? {} : b, o),
    put: (r, b, o) => llamar('PUT', r, b, o),
    del: (r, b, o) => llamar('DELETE', r, b, o),
    subir: (r, formData) => llamar('POST', r, formData),
    // URL absoluta normalizada (para fetches sueltos fuera de este cliente,
    // p. ej. continuarSesion() del panel): MarcasAPI.urlPara('/api/marcas/auth/refrescar')
    urlPara: (ruta = '') => `${normalizarOrigen()}${ruta}`,
    haySesion: () => !!token(),
    async restaurarSesion() {
      // Con token asumimos sesión activa; si expiró, la primera llamada al
      // panel devolverá 401 y este cliente intentará renovar con la cookie.
      // SIN token sólo intentamos refrescar si este dispositivo YA tuvo una
      // sesión (bandera en localStorage): un visitante nuevo no genera el
      // 401 de /auth/refrescar en la consola.
      if (token()) return true;
      let huboSesion = false;
      try { huboSesion = localStorage.getItem(SESION_FLAG) === '1'; } catch (e) { huboSesion = false; }
      if (!huboSesion) return false;
      return renovar();
    },
    async salir() {
      guardar('');
      try { localStorage.removeItem(SESION_FLAG); } catch (e) { /* sin storage */ }
    },
    marcarSesion,
  };
})();

// Escape HTML para todo texto que escribe un proveedor y se pinta en pantalla.
const mbEsc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Solo imágenes por https (evita javascript:/data: en atributos src).
const mbImg = (u) => (typeof u === 'string' && /^https:\/\//i.test(u) ? u : '');
// Solo enlaces http(s).
const mbUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : '');
