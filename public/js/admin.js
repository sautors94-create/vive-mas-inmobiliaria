if (!auth.isLoggedIn() || !auth.isAdmin()) {
  window.location.href = 'login.html';
}

let propiedadArechazar = null;

document.addEventListener('DOMContentLoaded', () => {
  cargarDashboard();
});

const mostrarSeccion = (seccion) => {
  document.querySelectorAll('.dash-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`sec-${seccion}`).style.display = 'block';
  event.target.closest('.sidebar-link')?.classList.add('active');

  if (seccion === 'dashboard') cargarDashboard();
  if (seccion === 'revision') cargarRevision();
  if (seccion === 'propiedades') cargarTodasPropiedades();
  if (seccion === 'usuarios') cargarUsuarios();
};

const cargarDashboard = async () => {
  const grid = document.getElementById('stats-grid');
  const data = await api.get('/admin/dashboard');
  if (!data.ok) return;
  const s = data.stats;
  grid.innerHTML = `
    <div class="stat-card azul">
      <div class="stat-numero">${s.totalUsuarios}</div>
      <div class="stat-label">Usuarios registrados</div>
    </div>
    <div class="stat-card verde">
      <div class="stat-numero">${s.totalPropiedades}</div>
      <div class="stat-label">Total propiedades</div>
    </div>
    <div class="stat-card naranja">
      <div class="stat-numero">${s.enRevision}</div>
      <div class="stat-label">En revisión</div>
    </div>
    <div class="stat-card verde">
      <div class="stat-numero">${s.aprobadas}</div>
      <div class="stat-label">Aprobadas</div>
    </div>
    <div class="stat-card rojo">
      <div class="stat-numero">${s.rechazadas}</div>
      <div class="stat-label">Rechazadas</div>
    </div>
  `;
};

const cargarRevision = async () => {
  const lista = document.getElementById('revision-lista');
  const data = await api.get('/admin/propiedades?status=revision');
  if (!data.propiedades || data.propiedades.length === 0) {
    lista.innerHTML = '<div class="loading">No hay propiedades en revisión.</div>';
    return;
  }
  lista.innerHTML = data.propiedades.map(p => crearCardAdmin(p)).join('');
};

const cargarTodasPropiedades = async () => {
  const lista = document.getElementById('todas-props-lista');
  const status = document.getElementById('filtro-status')?.value || '';
  const data = await api.get(`/admin/propiedades${status ? '?status=' + status : ''}`);
  if (!data.propiedades || data.propiedades.length === 0) {
    lista.innerHTML = '<div class="loading">No hay propiedades.</div>';
    return;
  }
  lista.innerHTML = data.propiedades.map(p => crearCardAdmin(p)).join('');
};

const crearCardAdmin = (p) => `
  <div class="prop-admin-card">
    <div class="prop-admin-img">
      ${p.fotos && p.fotos.length > 0
        ? `<img src="${p.fotos[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`
        : 'Sin foto'}
    </div>
    <div class="prop-admin-info">
      <div class="prop-admin-titulo">${p.titulo}</div>
      <div class="prop-admin-meta">
        ${p.ubicacion.ciudad}, ${p.ubicacion.estado} · ${formatPrecio(p.precio)}
        ${p.propietario ? ` · Propietario: ${p.propietario.nombre}` : ''}
      </div>
      ${p.motivo_rechazo ? `<div style="font-size:12px;color:#c62828;margin-top:4px">Motivo: ${p.motivo_rechazo}</div>` : ''}
    </div>
    <div class="prop-admin-actions">
      <span class="status-badge status-${p.status}">${p.status}</span>
      ${p.status === 'revision' ? `
        <button class="btn btn-primary" style="padding:6px 14px;font-size:13px" onclick="aprobarPropiedad('${p._id}')">Aprobar</button>
        <button class="btn btn-outline" style="padding:6px 14px;font-size:13px;border-color:#c62828;color:#c62828" onclick="abrirModalRechazo('${p._id}')">Rechazar</button>
      ` : ''}
    </div>
  </div>`;

const aprobarPropiedad = async (id) => {
  const data = await api.patch(`/admin/propiedades/${id}/aprobar`);
  if (data.ok) {
    cargarRevision();
    cargarDashboard();
  }
};

const abrirModalRechazo = (id) => {
  propiedadArechazar = id;
  document.getElementById('motivo-rechazo').value = '';
  const modal = document.getElementById('modal-rechazo');
  modal.style.display = 'flex';
};

const cerrarModal = () => {
  document.getElementById('modal-rechazo').style.display = 'none';
  propiedadArechazar = null;
};

const confirmarRechazo = async () => {
  const motivo = document.getElementById('motivo-rechazo').value.trim();
  if (!motivo) {
    alert('Por favor escribe el motivo del rechazo');
    return;
  }
  const data = await api.patch(`/admin/propiedades/${propiedadArechazar}/rechazar`, { motivo });
  if (data.ok) {
    cerrarModal();
    cargarRevision();
    cargarDashboard();
  }
};

const cargarUsuarios = async () => {
  const lista = document.getElementById('usuarios-lista');
  const plan = document.getElementById('filtro-plan')?.value || '';
  const data = await api.get(`/admin/usuarios${plan ? '?plan=' + plan : ''}`);
  if (!data.usuarios || data.usuarios.length === 0) {
    lista.innerHTML = '<div class="loading">No hay usuarios.</div>';
    return;
  }
  lista.innerHTML = data.usuarios.map(u => `
    <div class="usuario-card">
      <div class="usuario-avatar">${u.nombre.charAt(0).toUpperCase()}</div>
      <div class="usuario-info">
        <div class="usuario-nombre">${u.nombre}</div>
        <div class="usuario-meta">${u.email} · ${u.telefono || 'Sin teléfono'} · Registro: ${new Date(u.createdAt).toLocaleDateString('es-MX')}</div>
      </div>
      <div class="usuario-actions">
        <span class="plan-badge plan-${u.plan}">${u.plan}</span>
        <span class="status-badge status-${u.status}">${u.status}</span>
        <button class="btn btn-outline" style="padding:6px 14px;font-size:12px" onclick="cambiarPlan('${u._id}', '${u.plan}')">Cambiar plan</button>
        <button class="btn btn-outline" style="padding:6px 14px;font-size:12px;border-color:#c62828;color:#c62828" onclick="suspenderUsuario('${u._id}')">
          ${u.status === 'activo' ? 'Suspender' : 'Activar'}
        </button>
      </div>
    </div>`).join('');
};

const cambiarPlan = async (id, planActual) => {
  const planes = ['gratuito', 'basico', 'premium'];
  const nuevo = prompt(`Plan actual: ${planActual}\nEscribe el nuevo plan: gratuito, basico o premium`);
  if (!nuevo || !planes.includes(nuevo)) return;
  const data = await api.patch(`/admin/usuarios/${id}/plan`, { plan: nuevo });
  if (data.ok) cargarUsuarios();
};

const suspenderUsuario = async (id) => {
  if (!confirm('¿Estás seguro?')) return;
  const data = await api.patch(`/admin/usuarios/${id}/suspender`);
  if (data.ok) cargarUsuarios();
};