// Cliente de la API de Marcas y Profesionales Aliados.
// Usa su PROPIA sesión (vm_brand_token): es independiente de la sesión de usuarios/admin.
// Requiere api.js (API_URL) cargado antes.
const MarcasAPI = (() => {
  const KEY = 'vm_brand_token';
  const base = () => `${API_URL}/api/marcas`;

  const token = () => { try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
  const guardar = (t) => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch (e) { /* sin storage */ } };

  let renovando = null;
  const renovar = () => {
    if (!renovando) {
      renovando = fetch(`${base()}/auth/refresh`, { method: 'POST', credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d && d.accessToken) { guardar(d.accessToken); return true; } guardar(''); return false; })
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
    async restaurarSesion() { return token() ? true : renovar(); },
    async salir() { try { await fetch(`${base()}/auth/logout`, { method: 'POST', credentials: 'include' }); } catch (e) { /* noop */ } guardar(''); },
  };
})();

// Escape HTML para todo texto que escribe un proveedor y se pinta en pantalla.
const mbEsc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Solo imágenes por https (evita javascript:/data: en atributos src).
const mbImg = (u) => (typeof u === 'string' && /^https:\/\//i.test(u) ? u : '');
// Solo enlaces http(s).
const mbUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : '');