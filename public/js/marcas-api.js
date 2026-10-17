// Cliente de la API de Marcas y Profesionales Aliados.
// Usa su PROPIA sesión (vm_brand_token): es independiente de la sesión de usuarios/admin.
// Requiere api.js (API_URL) cargado antes.
//
// CONTRATO BACKEND v2 (OTP-only):
//   - Refresh: POST /api/marcas/auth/refrescar (¡con Z!) — usa la cookie
//     httpOnly vm_brand_refresh (path /api/marcas/auth) que el backend puso
//     al verificar el código. No lleva Authorization.
//   - NO existe /auth/logout (ni /auth/login): salir = borrar el token local.
//     La cookie de refresco expira sola (httpOnly, no se puede borrar desde JS).
const MarcasAPI = (() => {
  const KEY = 'vm_brand_token';
  const base = () => `${API_URL}/api/marcas`;

  const token = () => { try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
  const guardar = (t) => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch (e) { /* sin storage */ } };

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
          if (d && d.accessToken) { guardar(d.accessToken); return true; }
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
    try { res = await hacer(); } catch (e) { return { ok: false, status: 0, error: 'Sin conexión. Revisa tu internet e intenta de nuevo.' }; }
    if (res.status === 401 && opciones.sesion !== false && (await renovar())) {
      try { res = await hacer(); } catch (e) { return { ok: false, status: 0, error: 'Sin conexión. Revisa tu internet e intenta de nuevo.' }; }
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
    haySesion: () => !!token(),
    async restaurarSesion() {
      // Si hay token asumimos sesión activa; si expiró, la primera llamada al
      // panel devolverá 401 y este cliente intentará renovar con la cookie.
      // Si la cookie también murió, el panel expulsa al acceso. Para forzar
      // una verificación temprana (p. ej. al abrir el panel) llama a renovar().
      return !!(token() || await renovar());
    },
    async salir() { guardar(''); },
  };
})();

// Escape HTML para todo texto que escribe un proveedor y se pinta en pantalla.
const mbEsc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Solo imágenes por https (evita javascript:/data: en atributos src).
const mbImg = (u) => (typeof u === 'string' && /^https:\/\//i.test(u) ? u : '');
// Solo enlaces http(s).
const mbUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : '');