if (!auth.isLoggedIn()) window.location.href = 'login.html';

const user = auth.getUser();
let mapaPublicar = null;
let markerPublicar = null;

document.addEventListener('DOMContentLoaded', () => {
  if (user) {
    document.getElementById('user-nombre').textContent = user.nombre;
    document.getElementById('sidebar-nombre').textContent = user.nombre;
    document.getElementById('sidebar-plan').textContent = `Plan ${user.plan}`;
    document.getElementById('user-avatar').textContent = user.nombre.charAt(0).toUpperCase();
    cargarMisPropiedades();
    cargarCuenta();
  }
});

const mostrarSeccion = (seccion) => {
  document.querySelectorAll('.dash-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`sec-${seccion}`).style.display = 'block';
  const link = document.querySelector(`.sidebar-link[onclick*="${seccion}"]`);
  if (link) link.classList.add('active');
  if (seccion === 'mis-propiedades') cargarMisPropiedades();
  if (seccion === 'favoritos') cargarFavoritos();
  if (seccion === 'mensajes') cargarMensajes();
  if (seccion === 'nueva-propiedad') iniciarMapaPublicar();
};

const iniciarMapaPublicar = () => {
  if (mapaPublicar) { mapaPublicar.invalidateSize(); return; }
  setTimeout(() => {
    const centro = [19.4326, -99.1332];
    mapaPublicar = L.map('mapa-publicar').setView(centro, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(mapaPublicar);
    mapaPublicar.on('click', (e) => {
      const { lat, lng } = e.latlng;
      colocarMarker(lat, lng);
      geocodificarCoordenadas(lat, lng);
    });
  }, 300);
};

const colocarMarker = (lat, lng) => {
  if (markerPublicar) mapaPublicar.removeLayer(markerPublicar);
  markerPublicar = L.marker([lat, lng], {
    icon: L.divIcon({
      className: '',
      html: '<div style="background:#1a472a;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    })
  }).addTo(mapaPublicar);
  document.getElementById('p-lat').value = lat.toFixed(6);
  document.getElementById('p-lng').value = lng.toFixed(6);
  document.getElementById('coord-lat').textContent = lat.toFixed(6);
  document.getElementById('coord-lng').textContent = lng.toFixed(6);
};

const geocodificarCoordenadas = async (lat, lng) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`);
    const data = await res.json();
    if (data.address) {
      const estado = data.address.state || '';
      const ciudad = data.address.city || data.address.town || data.address.municipality || '';
      const colonia = data.address.suburb || data.address.neighbourhood || '';
      const calle = data.address.road || '';
      const numero = data.address.house_number || '';
      if (estado) {
        const estadoSelect = document.getElementById('p-estado');
        const opciones = [...estadoSelect.options];
        const match = opciones.find(o => estado.toLowerCase().includes(o.value.toLowerCase()) || o.value.toLowerCase().includes(estado.toLowerCase().split(' ')[0]));
        if (match) estadoSelect.value = match.value;
      }
      if (ciudad) document.getElementById('p-ciudad').value = ciudad;
      if (colonia) document.getElementById('p-colonia').value = colonia;
      if (calle) document.getElementById('p-direccion').value = `${calle}${numero ? ' ' + numero : ''}`;
      document.getElementById('coord-estado-label').textContent = `📍 ${colonia ? colonia + ', ' : ''}${ciudad}`;
    }
  } catch (e) {}
};

const buscarDireccion = async () => {
  const direccion = document.getElementById('p-direccion').value.trim();
  const estado = document.getElementById('p-estado').value;
  const ciudad = document.getElementById('p-ciudad').value.trim();
  if (!direccion && !ciudad) { alert('Escribe una dirección o ciudad para buscar'); return; }
  const query = `${direccion} ${ciudad} ${estado} México`.trim();
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=es`);
    const data = await res.json();
    if (data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      mapaPublicar.setView([lat, lng], 16);
      colocarMarker(lat, lng);
      geocodificarCoordenadas(lat, lng);
    } else {
      alert('No se encontró la dirección. Haz clic en el mapa.');
    }
  } catch (e) {
    alert('Error al buscar. Haz clic directamente en el mapa.');
  }
};

const previsualizarFotos = (input) => {
  const preview = document.getElementById('fotos-preview');
  preview.innerHTML = '';
  const files = Array.from(input.files).slice(0, 15);
  files.forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const div = document.createElement('div');
      div.style.cssText = 'position:relative;width:100px;height:100px;border-radius:8px;overflow:hidden;border:1px solid var(--border)';
      div.innerHTML = `
        <img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">
        <button onclick="eliminarFotoPreview(${i})" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center">✕</button>`;
      div.id = `preview-foto-${i}`;
      preview.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
};

const eliminarFotoPreview = (idx) => {
  const div = document.getElementById(`preview-foto-${idx}`);
  if (div) div.remove();
};

const cargarMisPropiedades = async () => {
  const grid = document.getElementById('mis-props-grid');
  const data = await api.get('/propiedades/mis-propiedades');
  if (!data.propiedades || data.propiedades.length === 0) {
    grid.innerHTML = `
      <div style="text-align:center;padding:60px;color:var(--text-light)">
        <div style="font-size:48px;margin-bottom:16px">🏠</div>
        <p style="font-size:16px;margin-bottom:16px">Aún no tienes propiedades publicadas</p>
        <button class="btn btn-primary" onclick="mostrarSeccion('nueva-propiedad')">Publicar mi primera propiedad</button>
      </div>`;
    return;
  }
  grid.innerHTML = data.propiedades.map(p => `
    <div class="prop-admin-card">
      <div class="prop-admin-img">
        ${p.fotos && p.fotos.length > 0
          ? `<img src="${p.fotos[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`
          : 'Sin foto'}
      </div>
      <div class="prop-admin-info">
        <div class="prop-admin-titulo">${p.titulo}</div>
        <div class="prop-admin-meta">${p.ubicacion.ciudad}, ${p.ubicacion.estado} · ${formatPrecio(p.precio)}</div>
      </div>
      <div class="prop-admin-actions">
        <span class="status-badge status-${p.status}">${p.status}</span>
        <button class="btn btn-outline" style="padding:6px 14px;font-size:13px" onclick="window.location='propiedad.html?id=${p._id}'">Ver</button>
      </div>
    </div>`).join('');
};

const cargarFavoritos = async () => {
  const grid = document.getElementById('favoritos-grid');
  const data = await api.get('/favoritos');
  if (!data.favoritos || data.favoritos.length === 0) {
    grid.innerHTML = '<div class="loading">No tienes propiedades favoritas aún.</div>';
    return;
  }
  grid.innerHTML = data.favoritos.map(f => `
    <div class="prop-admin-card" id="fav-${f.propiedad._id}">
      <div class="prop-admin-img">
        ${f.propiedad.fotos && f.propiedad.fotos.length > 0
          ? `<img src="${f.propiedad.fotos[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`
          : 'Sin foto'}
      </div>
      <div class="prop-admin-info">
        <div class="prop-admin-titulo">${f.propiedad.titulo}</div>
        <div class="prop-admin-meta">${f.propiedad.ubicacion.ciudad}, ${f.propiedad.ubicacion.estado} · ${formatPrecio(f.propiedad.precio)}</div>
        <div class="prop-admin-meta" style="margin-top:4px">
          <span class="tag tag-${f.propiedad.operacion}">${f.propiedad.operacion}</span>
          <span class="tag tag-${f.propiedad.tipo}">${f.propiedad.tipo}</span>
        </div>
      </div>
      <div class="prop-admin-actions">
        <button class="btn btn-primary" style="padding:6px 14px;font-size:13px" onclick="window.location='propiedad.html?id=${f.propiedad._id}'">Ver</button>
        <button class="btn btn-outline" style="padding:6px 14px;font-size:13px;border-color:#e24b4a;color:#e24b4a" onclick="eliminarFavorito('${f.propiedad._id}')">❤️ Quitar</button>
      </div>
    </div>`).join('');
};

const eliminarFavorito = async (propiedadId) => {
  if (!confirm('¿Quitar esta propiedad de tus favoritos?')) return;
  const data = await api.delete(`/favoritos/${propiedadId}`);
  if (data.ok) {
    document.getElementById(`fav-${propiedadId}`).remove();
    const grid = document.getElementById('favoritos-grid');
    if (!grid.children.length) grid.innerHTML = '<div class="loading">No tienes propiedades favoritas aún.</div>';
  }
};

const cargarMensajes = async () => {
  const lista = document.getElementById('mensajes-lista');
  const data = await api.get('/mensajes');
  if (!data.mensajes || data.mensajes.length === 0) {
    lista.innerHTML = '<div class="loading">No tienes mensajes aún.</div>';
    return;
  }
  lista.innerHTML = data.mensajes.map(m => `
    <div class="mensaje-card">
      <div class="mensaje-header">
        <span class="mensaje-de">${m.remitente._id === user._id ? 'Tú → ' + m.destinatario.nombre : m.remitente.nombre}</span>
        <span class="mensaje-fecha">${new Date(m.createdAt).toLocaleDateString('es-MX')}</span>
      </div>
      <div class="mensaje-texto">${m.mensaje}</div>
      ${m.propiedad ? `<div class="mensaje-propiedad">📍 ${m.propiedad.titulo || 'Propiedad'}</div>` : ''}
    </div>`).join('');
};

const cargarCuenta = () => {
  const info = document.getElementById('cuenta-info');
  if (!user) return;
  info.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-bottom:32px">
      <div class="form-grupo"><label>Nombre completo</label><input type="text" class="form-input" value="${user.nombre}" disabled></div>
      <div class="form-grupo"><label>Correo electrónico</label><input type="text" class="form-input" value="${user.email}" disabled></div>
      <div class="form-grupo"><label>Teléfono</label><input type="text" class="form-input" value="${user.telefono || 'No registrado'}" disabled></div>
      <div class="form-grupo"><label>Plan actual</label><input type="text" class="form-input" value="${user.plan}" disabled></div>
    </div>
    <div style="background:var(--bg-secondary);border-radius:16px;padding:24px;border:1px solid var(--border);margin-bottom:24px">
      <h3 style="font-size:16px;margin-bottom:16px;font-family:'Bricolage Grotesque',sans-serif">🔔 Preferencias de notificaciones</h3>
      <div style="display:flex;flex-direction:column;gap:14px">
        <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer">
          <div><div style="font-size:14px;font-weight:500">Mensajes de interés</div><div style="font-size:12px;color:var(--text-light)">Cuando alguien envía mensaje sobre tu propiedad</div></div>
          <input type="checkbox" id="notif-mensajes" ${user.notificaciones?.mensajes !== false ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary);cursor:pointer">
        </label>
        <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer">
          <div><div style="font-size:14px;font-weight:500">Propiedad aprobada</div><div style="font-size:12px;color:var(--text-light)">Cuando el admin aprueba tu publicación</div></div>
          <input type="checkbox" id="notif-aprobada" ${user.notificaciones?.propiedadAprobada !== false ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary);cursor:pointer">
        </label>
        <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer">
          <div><div style="font-size:14px;font-weight:500">Propiedad rechazada</div><div style="font-size:12px;color:var(--text-light)">Cuando el admin rechaza tu publicación</div></div>
          <input type="checkbox" id="notif-rechazada" ${user.notificaciones?.propiedadRechazada !== false ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary);cursor:pointer">
        </label>
        <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer">
          <div><div style="font-size:14px;font-weight:500">Novedades y promociones</div><div style="font-size:12px;color:var(--text-light)">Nuevas propiedades y ofertas especiales</div></div>
          <input type="checkbox" id="notif-novedades" ${user.notificaciones?.novedades ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary);cursor:pointer">
        </label>
      </div>
      <button class="btn btn-primary" style="margin-top:20px;padding:10px 24px;font-size:14px" onclick="guardarNotificaciones()">Guardar preferencias</button>
      <div id="notif-msg" style="display:none;margin-top:12px"></div>
    </div>
    <button class="btn btn-outline" onclick="auth.logout()">Cerrar sesión</button>`;
};

const guardarNotificaciones = async () => {
  const notificaciones = {
    mensajes: document.getElementById('notif-mensajes').checked,
    propiedadAprobada: document.getElementById('notif-aprobada').checked,
    propiedadRechazada: document.getElementById('notif-rechazada').checked,
    novedades: document.getElementById('notif-novedades').checked,
  };
  const msgEl = document.getElementById('notif-msg');
  const data = await api.patch('/auth/notificaciones', { notificaciones });
  if (data.ok) {
    msgEl.innerHTML = '<div class="alert alert-success">✓ Preferencias guardadas</div>';
    msgEl.style.display = 'block';
    const userActual = auth.getUser();
    userActual.notificaciones = notificaciones;
    localStorage.setItem('user', JSON.stringify(userActual));
    setTimeout(() => msgEl.style.display = 'none', 3000);
  }
};

const publicarPropiedad = async () => {
  const errorEl = document.getElementById('form-error');
  const successEl = document.getElementById('form-success');
  errorEl.style.display = 'none';
  successEl.style.display = 'none';

  const titulo = document.getElementById('p-titulo').value.trim();
  const precio = document.getElementById('p-precio').value;
  const operacion = document.getElementById('p-operacion').value;
  const tipo = document.getElementById('p-tipo').value;
  const descripcion = document.getElementById('p-descripcion').value.trim();
  const estado = document.getElementById('p-estado').value;
  const ciudad = document.getElementById('p-ciudad').value.trim();
  const colonia = document.getElementById('p-colonia').value.trim();
  const direccion = document.getElementById('p-direccion').value.trim();
  const recamaras = document.getElementById('p-recamaras').value;
  const banos = document.getElementById('p-banos').value;
  const estacionamientos = document.getElementById('p-estacionamientos').value;
  const m2 = document.getElementById('p-m2').value;
  const lat = document.getElementById('p-lat').value;
  const lng = document.getElementById('p-lng').value;

  if (!titulo || !precio || !operacion || !tipo || !descripcion || !estado || !ciudad) {
    errorEl.textContent = 'Por favor llena todos los campos obligatorios (*)';
    errorEl.style.display = 'block';
    return;
  }

  const body = {
    titulo, precio: Number(precio), operacion, tipo, descripcion,
    ubicacion: { estado, ciudad, colonia, direccion, lat: lat ? parseFloat(lat) : null, lng: lng ? parseFloat(lng) : null },
    caracteristicas: { recamaras: Number(recamaras)||0, banos: Number(banos)||0, estacionamientos: Number(estacionamientos)||0, m2: Number(m2)||0 }
  };

  const btn = document.querySelector('#sec-nueva-propiedad .btn-primary');
  btn.textContent = 'Enviando...';
  btn.disabled = true;

  const data = await api.post('/propiedades', body);

  if (data.ok) {
    const fotosInput = document.getElementById('p-fotos');
    if (fotosInput.files.length > 0) {
      const formData = new FormData();
      Array.from(fotosInput.files).forEach(f => formData.append('fotos', f));
      const token = auth.getToken();
      await fetch(`http://localhost:3000/api/propiedades/${data.propiedad._id}/fotos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
    }
    successEl.textContent = '¡Propiedad enviada a revisión exitosamente!';
    successEl.style.display = 'block';
    btn.textContent = 'Enviar a revisión';
    btn.disabled = false;
    setTimeout(() => mostrarSeccion('mis-propiedades'), 2000);
  } else {
    errorEl.textContent = data.error || 'Error al publicar la propiedad';
    errorEl.style.display = 'block';
    btn.textContent = 'Enviar a revisión';
    btn.disabled = false;
  }
};