const API_URL = 'http://localhost:3000/api';

const api = {
  get: async (endpoint) => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_URL}${endpoint}`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' }
    });
    return res.json();
  },

  post: async (endpoint, body) => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_URL}${endpoint}`, {
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
    const res = await fetch(`${API_URL}${endpoint}`, {
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
    const res = await fetch(`${API_URL}${endpoint}`, {
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
            ${p.caracteristicas.banos ? `🚿 ${p.caracteristicas.banos}` : ''}
            ${p.caracteristicas.m2 ? `📐 ${p.caracteristicas.m2}m²` : ''}
          </div>
        </div>
      </div>
    </div>`;
}; 
