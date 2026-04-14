if (!auth.isLoggedIn()) window.location.href = 'login.html';

const user = auth.getUser();

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
  event.target.closest('.sidebar-link')?.classList.add('active');

  if (seccion === 'mis-propiedades') cargarMisPropiedades();
  if (seccion === 'favoritos') cargarFavoritos();
  if (seccion === 'mensajes') cargarMensajes();
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
        <button class="btn btn-outline" style="padding:6px 14px;font-size:13px" onclick="editarPropiedad('${p._id}')">Editar</button>
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
  grid.innerHTML = data.favoritos.map(f => crearCardPropiedad(f.propiedad)).join('');
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
        <span class="mensaje-de">
          ${m.remitente._id === user._id ? 'Tú → ' + m.destinatario.nombre : m.remitente.nombre}
        </span>
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
      <div class="form-grupo">
        <label>Nombre completo</label>
        <input type="text" class="form-input" value="${user.nombre}" disabled>
      </div>
      <div class="form-grupo">
        <label>Correo electrónico</label>
        <input type="text" class="form-input" value="${user.email}" disabled>
      </div>
      <div class="form-grupo">
        <label>Teléfono</label>
        <input type="text" class="form-input" value="${user.telefono || 'No registrado'}" disabled>
      </div>
      <div class="form-grupo">
        <label>Plan actual</label>
        <input type="text" class="form-input" value="${user.plan}" disabled>
      </div>
    </div>

    <div style="background:var(--bg-secondary);border-radius:16px;padding:24px;border:1px solid var(--border);margin-bottom:24px">
      <h3 style="font-size:16px;margin-bottom:16px;font-family:'Bricolage Grotesque',sans-serif">🔔 Preferencias de notificaciones</h3>
      <div style="display:flex;flex-direction:column;gap:14px">
        <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer">
          <div>
            <div style="font-size:14px;font-weight:500">Mensajes de interés</div>
            <div style="font-size:12px;color:var(--text-light)">Cuando alguien envía mensaje sobre tu propiedad</div>
          </div>
          <input type="checkbox" id="notif-mensajes" ${user.notificaciones?.mensajes !== false ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary);cursor:pointer">
        </label>
        <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer">
          <div>
            <div style="font-size:14px;font-weight:500">Propiedad aprobada</div>
            <div style="font-size:12px;color:var(--text-light)">Cuando el admin aprueba tu publicación</div>
          </div>
          <input type="checkbox" id="notif-aprobada" ${user.notificaciones?.propiedadAprobada !== false ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary);cursor:pointer">
        </label>
        <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer">
          <div>
            <div style="font-size:14px;font-weight:500">Propiedad rechazada</div>
            <div style="font-size:12px;color:var(--text-light)">Cuando el admin rechaza tu publicación</div>
          </div>
          <input type="checkbox" id="notif-rechazada" ${user.notificaciones?.propiedadRechazada !== false ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary);cursor:pointer">
        </label>
        <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer">
          <div>
            <div style="font-size:14px;font-weight:500">Novedades y promociones</div>
            <div style="font-size:12px;color:var(--text-light)">Nuevas propiedades y ofertas especiales</div>
          </div>
          <input type="checkbox" id="notif-novedades" ${user.notificaciones?.novedades ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary);cursor:pointer">
        </label>
      </div>
      <button class="btn btn-primary" style="margin-top:20px;padding:10px 24px;font-size:14px" onclick="guardarNotificaciones()">
        Guardar preferencias
      </button>
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
  } else {
    msgEl.innerHTML = '<div class="alert alert-error">Error al guardar</div>';
    msgEl.style.display = 'block';
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

  if (!titulo || !precio || !operacion || !tipo || !descripcion || !estado || !ciudad) {
    errorEl.textContent = 'Por favor llena todos los campos obligatorios (*)';
    errorEl.style.display = 'block';
    return;
  }

  const body = {
    titulo, precio: Number(precio), operacion, tipo, descripcion,
    ubicacion: { estado, ciudad, colonia, direccion },
    caracteristicas: {
      recamaras: Number(recamaras) || 0,
      banos: Number(banos) || 0,
      estacionamientos: Number(estacionamientos) || 0,
      m2: Number(m2) || 0
    }
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

const editarPropiedad = (id) => {
  window.location.href = `propiedad.html?id=${id}&edit=true`;
};