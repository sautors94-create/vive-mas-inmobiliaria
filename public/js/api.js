(() => {
  try {
    const tema = localStorage.getItem('vm_tema');
    if (tema) {
      const t = JSON.parse(tema);
      if (t.nombre !== 'default') {
        const style = document.createElement('style');
        style.textContent = `:root {
          --primary: ${t.primary} !important;
          --primary-light: ${t.primaryLight} !important;
          --accent: ${t.accent} !important;
          --accent-dark: ${t.accentDark} !important;
          --bg-dark: ${t.bgDark} !important;
        }`;
        document.head.insertBefore(style, document.head.firstChild);
      }
    }
  } catch(e) {}
})();

// Detecta el origen de la API según el entorno:
// - Desarrollo con Live Server u otro puerto distinto al backend -> apunta a localhost:3000
// - Mismo origen (backend sirviendo el frontend, o producción) -> ruta relativa
const API_URL = (() => {
  const { hostname, port } = window.location;
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && port && port !== '3000') {
    return 'http://localhost:3000';
  }
  return '';
})();

const buildUrl = (endpoint) => {
  const clean = typeof endpoint === 'string' ? endpoint.trim() : '';
  if (!clean) return '/api';
  if (clean.startsWith('/api')) return clean;
  return clean.startsWith('/') ? `/api${clean}` : `/api/${clean}`;
};

let renovacionEnCurso = null;

// Intenta renovar el accessToken usando el refreshToken (cookie httpOnly).
// Devuelve { ok: true } si se renovó correctamente, { ok: false } si no.
const renewTokenAndRetry = async () => {
  if (renovacionEnCurso) return renovacionEnCurso;

  renovacionEnCurso = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (data.ok && data.accessToken) {
        localStorage.setItem('accessToken', data.accessToken);
        return { ok: true };
      }
      return { ok: false };
    } catch (error) {
      return { ok: false };
    }
  })();

  const resultado = await renovacionEnCurso;
  renovacionEnCurso = null;
  return resultado;
};

const showSessionExpiredModal = () => {
  if (document.getElementById('session-expired-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'session-expired-modal';
  modal.innerHTML = `
    <div class="session-expired-content">
      <div class="session-expired-header">
        <span class="session-icon">🔒</span>
        <h3>Sesión expirada</h3>
      </div>
      <p>Tu sesión ha expirado. Por favor inicia sesión nuevamente.</p>
      <div class="session-expired-buttons">
        <button id="btn-session-login" class="btn-session-expired">Iniciar sesión</button>
      </div>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #session-expired-modal {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.8); display: flex; justify-content: center;
      align-items: center; z-index: 10001;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    .session-expired-content {
      background: white; padding: 30px; border-radius: 15px; text-align: center;
      max-width: 400px; width: 90%; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    }
    .session-expired-header { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 20px; }
    .session-icon { font-size: 40px; }
    .session-expired-header h3 { margin: 0; color: #dc2626; font-size: 24px; }
    .session-expired-content p { color: #6b7280; margin: 15px 0; }
    .session-expired-buttons { display: flex; gap: 10px; justify-content: center; margin-top: 20px; }
    .btn-session-expired {
      padding: 12px 24px; background: #3b82f6; color: white; border: none;
      border-radius: 8px; font-size: 16px; cursor: pointer;
    }
    .btn-session-expired:hover { background: #2563eb; }
  `;
  document.head.appendChild(style);
  document.body.appendChild(modal);

  document.getElementById('btn-session-login').addEventListener('click', () => {
    modal.remove();
    handleAuthFail();
  });
};

const handleAuthFail = () => {
  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
  } catch (e) {}
  try {
    localStorage.setItem('vm_session_expired', '1');
  } catch (e) {}
  const inPages = window.location.pathname.includes('/pages/');
  window.location.href = inPages ? 'login.html' : 'pages/login.html';
};

// Función central: maneja headers, errores de red, JSON inválido,
// y renueva el token automáticamente si expiró (una sola vez por petición).
const peticion = async (endpoint, options = {}, _esReintento = false) => {
  const token = localStorage.getItem('accessToken');
  const headers = {
    Authorization: token ? `Bearer ${token}` : '',
    ...(options.headers || {})
  };
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let res;
  try {
    res = await fetch(`${API_URL}${buildUrl(endpoint)}`, {
      ...options,
      headers,
      credentials: 'include'
    });
  } catch (error) {
    return { ok: false, error: 'No se pudo conectar con el servidor. Verifica tu conexión a internet.' };
  }

  const esRutaPublicaAuth = endpoint.includes('/auth/login') || endpoint.includes('/auth/refresh') || endpoint.includes('/auth/registro');

  if (res.status === 401 && !_esReintento && token && !esRutaPublicaAuth) {
    const resultado = await renewTokenAndRetry();
    if (resultado.ok) {
      return peticion(endpoint, options, true);
    }
    showSessionExpiredModal();
    return { ok: false, sessionExpired: true };
  }

  try {
    return await res.json();
  } catch (error) {
    return { ok: false, error: `Error del servidor (código ${res.status})` };
  }
};

const api = {
  get: (endpoint) => peticion(endpoint, { method: 'GET' }),

  post: (endpoint, body) => peticion(endpoint, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body)
  }),

  patch: (endpoint, body) => peticion(endpoint, {
    method: 'PATCH',
    body: body instanceof FormData ? body : JSON.stringify(body)
  }),

  delete: (endpoint, body) => peticion(endpoint, {
    method: 'DELETE',
    ...(body ? { body: JSON.stringify(body) } : {})
  }),

  postForm: (endpoint, formData) => peticion(endpoint, {
    method: 'POST',
    body: formData
  })
};

const formatPrecio = (precio) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0
  }).format(precio);
};

const crearCardPropiedad = (p) => {
  const foto = p.fotos && p.fotos.length > 0
    ? `<img src="${p.fotos[0]}" alt="${p.titulo}">`
    : `<div style="height:200px;background:#f0f4f0;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:13px;">Sin fotografías</div>`;

  const enComparador = typeof comparadorTieneId === 'function' && comparadorTieneId(p._id);

  return `
    <div class="property-card" onclick="window.location=window.location.pathname.includes('/pages/') ? 'propiedad.html?id=${p._id}' : 'pages/propiedad.html?id=${p._id}'">
      <div class="property-img">
        ${foto}
        ${typeof comparadorToggle === 'function' ? `
          <label data-comparador-id="${p._id}" class="comparador-check${enComparador ? ' activo' : ''}" onclick="event.stopPropagation()" style="position:absolute;top:10px;left:10px;background:rgba(255,255,255,0.95);padding:5px 10px;border-radius:8px;font-size:11px;font-weight:600;display:flex;align-items:center;gap:5px;cursor:pointer;z-index:2">
            <input type="checkbox" ${enComparador ? 'checked' : ''} onchange="comparadorToggle('${p._id}', event)" style="cursor:pointer">
            Comparar
          </label>
        ` : ''}
      </div>
      <div class="property-body">
        <div class="property-tags">
          <span class="tag tag-${p.operacion}">${p.operacion}</span>
          <span class="tag tag-${p.tipo}">${p.tipo}</span>
        </div>
        <div class="property-title">${p.titulo}</div>
        <div class="property-location">📍 ${p.ubicacion.colonia ? p.ubicacion.colonia + ', ' : ''}${p.ubicacion.ciudad}, ${p.ubicacion.estado}</div>
        <div class="property-footer">
          <div class="property-price">${formatPrecio(p.precio)}</div>
          <div class="property-details">
            ${p.caracteristicas.recamaras ? `🛏 ${p.caracteristicas.recamaras}` : ''}
            ${p.caracteristicas.banos ? `🚿 ${p.caracteristicas.banos} baños` : ''}
            ${p.caracteristicas.mediosBanos ? ` 🚽 ${p.caracteristicas.mediosBanos}½` : ''}
            ${p.caracteristicas.m2 ? `📐 ${p.caracteristicas.m2}m²` : ''}
          </div>
        </div>
      </div>
    </div>`;
};

const aplicarVariablesCSS = (t) => {
  const root = document.documentElement;
  root.style.setProperty('--primary', t.primary);
  root.style.setProperty('--primary-light', t.primaryLight);
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--accent-dark', t.accentDark);
  root.style.setProperty('--bg-dark', t.bgDark);
  localStorage.setItem('vm_tema', JSON.stringify(t));
};

const cargarTemaDelSitio = async () => {
  try {
    const data = await api.get('/site/config');
    if (!data.ok || !data.config) return;
    const t = data.config.tema;
    if (!t || t.nombre === 'default') return;
    aplicarVariablesCSS(t);
  } catch (e) {}
};

document.addEventListener('DOMContentLoaded', cargarTemaDelSitio);

// ==========================================
// AVISO DE COOKIES
// ==========================================
const COOKIES_CONSENT_KEY = 'vm_cookies_consentimiento';

const mostrarBannerCookies = () => {
  if (localStorage.getItem(COOKIES_CONSENT_KEY)) return;
  if (document.getElementById('vm-cookies-banner')) return;

  const enSubcarpeta = window.location.pathname.includes('/pages/');
  const urlCookies = enSubcarpeta ? '../legal/normas-generales/cookies.html' : 'legal/normas-generales/cookies.html';
  const urlPrivacidad = enSubcarpeta ? '../legal/normas-generales/privacidad.html' : 'legal/normas-generales/privacidad.html';

  const banner = document.createElement('div');
  banner.id = 'vm-cookies-banner';
  banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#1a1a2e;color:white;padding:18px 24px;z-index:99999;box-shadow:0 -4px 20px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;font-family:inherit';
  banner.innerHTML = `
    <span style="font-size:13.5px;line-height:1.5;max-width:640px">
      🍪 Usamos cookies propias y de terceros para mejorar tu experiencia, analizar el uso del sitio y mostrarte contenido relevante.
      Consulta nuestra <a href="${urlCookies}" target="_blank" style="color:#f4a261;text-decoration:underline">Política de Cookies</a>
      y <a href="${urlPrivacidad}" target="_blank" style="color:#f4a261;text-decoration:underline">Aviso de Privacidad</a>.
    </span>
    <span style="display:flex;gap:10px;flex-shrink:0">
      <button id="vm-cookies-rechazar" style="background:none;border:1px solid rgba(255,255,255,0.4);color:white;padding:9px 18px;border-radius:20px;font-size:13px;cursor:pointer">Rechazar</button>
      <button id="vm-cookies-aceptar" style="background:#1a472a;border:none;color:white;padding:9px 20px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer">Aceptar todas</button>
    </span>
  `;
  document.body.appendChild(banner);

  const cerrarBanner = (valor) => {
    localStorage.setItem(COOKIES_CONSENT_KEY, JSON.stringify({ valor, fecha: new Date().toISOString() }));
    banner.remove();
  };
  document.getElementById('vm-cookies-aceptar').onclick = () => cerrarBanner('aceptado');
  document.getElementById('vm-cookies-rechazar').onclick = () => cerrarBanner('rechazado');
};

document.addEventListener('DOMContentLoaded', mostrarBannerCookies);

// ==========================================
// MODAL DE REPORTE (propiedades y chats)
// ==========================================
const MOTIVOS_REPORTE = [
  { valor: 'spam', etiqueta: 'Spam o publicidad no deseada' },
  { valor: 'fraude', etiqueta: 'Posible fraude o estafa' },
  { valor: 'contenido_inapropiado', etiqueta: 'Contenido inapropiado' },
  { valor: 'informacion_falsa', etiqueta: 'Información falsa o engañosa' },
  { valor: 'acoso', etiqueta: 'Acoso u hostigamiento' },
  { valor: 'otro', etiqueta: 'Otro motivo' },
];

window.mostrarModalReporte = ({ tipo, propiedadId = null, conversacionId = null }) => {
  let modal = document.getElementById('vm-reporte-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'vm-reporte-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100000;align-items:center;justify-content:center';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:28px;max-width:440px;width:90%">
      <h3 style="margin-bottom:6px">🚩 Reportar ${tipo === 'propiedad' ? 'publicación' : 'conversación'}</h3>
      <p style="font-size:13px;color:#6b7280;margin-bottom:16px">Ayúdanos a mantener la comunidad segura. Tu reporte es confidencial.</p>
      <div style="margin-bottom:12px">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px">Motivo</label>
        <select id="vm-reporte-motivo" class="form-input" style="width:100%">
          ${MOTIVOS_REPORTE.map(m => `<option value="${m.valor}">${m.etiqueta}</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:16px">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px">Detalles (opcional)</label>
        <textarea id="vm-reporte-detalle" class="form-input" rows="3" style="width:100%" placeholder="Cuéntanos más sobre lo que pasó..."></textarea>
      </div>
      <div id="vm-reporte-error" style="display:none;font-size:12px;color:#dc2626;margin-bottom:10px"></div>
      <div style="display:flex;gap:10px">
        <button id="vm-reporte-enviar" class="btn btn-primary" style="flex:1">Enviar reporte</button>
        <button class="btn btn-outline" style="flex:1" onclick="document.getElementById('vm-reporte-modal').style.display='none'">Cancelar</button>
      </div>
    </div>
  `;
  document.getElementById('vm-reporte-enviar').onclick = async () => {
    const motivo = document.getElementById('vm-reporte-motivo').value;
    const detalle = document.getElementById('vm-reporte-detalle').value.trim();
    const errorEl = document.getElementById('vm-reporte-error');
    const btn = document.getElementById('vm-reporte-enviar');
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    try {
      const data = await api.post('/reportes', { tipo, propiedadId, conversacionId, motivo, detalle: detalle || null });
      if (data.ok) {
        modal.style.display = 'none';
        if (window.dsToast) dsToast({ title: 'Reporte enviado', message: 'Gracias, nuestro equipo lo revisará pronto.', type: 'success' });
        else alert('Reporte enviado. Gracias.');
      } else {
        errorEl.textContent = data.error || 'No se pudo enviar el reporte.';
        errorEl.style.display = 'block';
      }
    } catch (e) {
      errorEl.textContent = 'No se pudo enviar el reporte. Intenta de nuevo.';
      errorEl.style.display = 'block';
    }
    btn.disabled = false;
    btn.textContent = 'Enviar reporte';
  };
  modal.style.display = 'flex';
};