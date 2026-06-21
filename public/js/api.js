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
const API_URL = '';

const buildUrl = (endpoint) => {
  const clean = typeof endpoint === 'string' ? endpoint.trim() : '';
  if (!clean) return '/api';
  if (clean.startsWith('/api')) return clean;
  return clean.startsWith('/') ? `/api${clean}` : `/api/${clean}`;
};

const handleAuthResponse = (res) => {
  // Cuando el token expira, intentamos renewal automático
  return renewTokenAndRetry();
};

let isRetrying = false;

const renewTokenAndRetry = async () => {
  if (isRetrying) return handleAuthFail();
  
  isRetrying = true;
  try {
    // Intentar refresh token
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });
    const data = await res.json();
    
    if (data.ok && data.accessToken) {
      // Refresh exitoso, actualizar token local
      localStorage.setItem('accessToken', data.accessToken);
      isRetrying = false;
      return { ok: true }; // Indicar que puede reintentar la petición original
    } else {
      // Refresh falló, mostrar modal de sesión
      isRetrying = false;
      showSessionExpiredModal();
      return { ok: false, sessionExpired: true };
    }
  } catch (error) {
    isRetrying = false;
    handleAuthFail();
    return { ok: false };
  }
};

const showSessionExpiredModal = () => {
  // Si ya hay un modal, no crear otro
  if (document.getElementById('session-expired-modal')) return;
  
  const modal = document.createElement('div');
  modal.id = 'session-expired-modal';
  modal.innerHTML = `
    <div class="session-expired-content">
      <div class="session-expired-header">
        <span class="session-icon">🔒</span>
        <h3>Sesión expirada</h3>
      </div>
      <p>Tu sesión ha expirado. ¿Deseas iniciar sesión nuevamente?</p>
      <div class="session-expired-buttons">
        <button id="btn-session-login" class="btn-session-expired">Iniciar sesión</button>
        <button id="btn-session-logout" class="btn-session-logout">Cerrar</button>
      </div>
    </div>
  `;
  
  // Estilos inline
  const style = document.createElement('style');
  style.textContent = `
    #session-expired-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10001;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    .session-expired-content {
      background: white;
      padding: 30px;
      border-radius: 15px;
      text-align: center;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    }
    .session-expired-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 20px;
    }
    .session-icon {
      font-size: 40px;
    }
    .session-expired-header h3 {
      margin: 0;
      color: #dc2626;
      font-size: 24px;
    }
    .session-expired-content p {
      color: #6b7280;
      margin: 15px 0;
    }
    .session-expired-buttons {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-top: 20px;
    }
    .btn-session-expired {
      padding: 12px 24px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
    }
    .btn-session-expired:hover {
      background: #2563eb;
    }
    .btn-session-logout {
      padding: 12px 24px;
      background: #6b7280;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
    }
    .btn-session-logout:hover {
      background: #4b5563;
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(modal);
  
  document.getElementById('btn-session-login').addEventListener('click', () => {
    modal.remove();
    handleAuthFail();
  });
  
  document.getElementById('btn-session-logout').addEventListener('click', () => {
    modal.remove();
    handleAuthFail();
  });
};

const handleAuthFail = () => {
  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
  } catch (e) {}

  // Mensaje persistente para mostrar luego en login
  try {
    localStorage.setItem('vm_session_expired', '1');
  } catch (e) {}

  const inPages = window.location.pathname.includes('/pages/');
  window.location.href = inPages ? 'login.html' : 'pages/login.html';
};

const api = {
  get: async (endpoint) => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_URL}${buildUrl(endpoint)}`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' }
    });

    if (res.status === 401) return handleAuthFail();
    return res.json();
  },

  post: async (endpoint, body) => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_URL}${buildUrl(endpoint)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
      },
      credentials: 'include',
      body: JSON.stringify(body)
    });
    return res.json();
  },

  patch: async (endpoint, body) => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_URL}${buildUrl(endpoint)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
      },
      credentials: 'include',
      body: JSON.stringify(body)
    });
    return res.json();
  },

  delete: async (endpoint) => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_URL}${buildUrl(endpoint)}`, {
      method: 'DELETE',
      headers: { Authorization: token ? `Bearer ${token}` : '' },
      credentials: 'include'
    });
    return res.json();
  }
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

  return `
    <div class="property-card" onclick="window.location=window.location.pathname.includes('/pages/') ? 'propiedad.html?id=${p._id}' : 'pages/propiedad.html?id=${p._id}'">
      <div class="property-img">${foto}</div>
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