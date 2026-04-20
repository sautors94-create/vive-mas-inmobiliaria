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
  if (seccion === 'temas') {}
  if (seccion === 'destacadas') cargarDestacadas();
};

const cargarDashboard = async () => {
  const grid = document.getElementById('stats-grid');
  const data = await api.get('/admin/dashboard');
  if (!data.ok) return;
  const s = data.stats;
  grid.innerHTML = `
    <div class="stat-card azul" onclick="irA('usuarios')" style="cursor:pointer">
      <div class="stat-numero">${s.totalUsuarios}</div>
      <div class="stat-label">Usuarios registrados</div>
      <div style="font-size:11px;color:var(--color-text-tertiary);margin-top:8px">Ver todos →</div>
    </div>
    <div class="stat-card verde" onclick="irA('propiedades')" style="cursor:pointer">
      <div class="stat-numero">${s.totalPropiedades}</div>
      <div class="stat-label">Total propiedades</div>
      <div style="font-size:11px;color:var(--color-text-tertiary);margin-top:8px">Ver todas →</div>
    </div>
    <div class="stat-card naranja" onclick="irAFiltrado('propiedades', 'revision')" style="cursor:pointer">
      <div class="stat-numero">${s.enRevision}</div>
      <div class="stat-label">En revisión</div>
      <div style="font-size:11px;color:var(--color-text-tertiary);margin-top:8px">Revisar ahora →</div>
    </div>
    <div class="stat-card verde" onclick="irAFiltrado('propiedades', 'aprobada')" style="cursor:pointer">
      <div class="stat-numero">${s.aprobadas}</div>
      <div class="stat-label">Aprobadas</div>
      <div style="font-size:11px;color:var(--color-text-tertiary);margin-top:8px">Ver aprobadas →</div>
    </div>
    <div class="stat-card rojo" onclick="irAFiltrado('propiedades', 'rechazada')" style="cursor:pointer">
      <div class="stat-numero">${s.rechazadas}</div>
      <div class="stat-label">Rechazadas</div>
      <div style="font-size:11px;color:var(--color-text-tertiary);margin-top:8px">Ver rechazadas →</div>
    </div>
    <div class="stat-card morado" onclick="irAFiltrado('propiedades', 'bloqueada')" style="cursor:pointer">
      <div class="stat-numero">${s.bloqueadas || 0}</div>
      <div class="stat-label">Bloqueadas</div>
      <div style="font-size:11px;color:var(--color-text-tertiary);margin-top:8px">Ver bloqueadas →</div>
    </div>
    <div class="stat-card azul" onclick="irAFiltradoUsuarios('basico')" style="cursor:pointer">
      <div class="stat-numero">${s.usuariosBasico || 0}</div>
      <div class="stat-label">Plan Básico</div>
      <div style="font-size:11px;color:var(--color-text-tertiary);margin-top:8px">Ver usuarios →</div>
    </div>
    <div class="stat-card naranja" onclick="irAFiltradoUsuarios('premium')" style="cursor:pointer">
      <div class="stat-numero">${s.usuariosPremium || 0}</div>
      <div class="stat-label">Plan Premium</div>
      <div style="font-size:11px;color:var(--color-text-tertiary);margin-top:8px">Ver usuarios →</div>
    </div>`;
};

const irA = (seccion) => {
  document.querySelectorAll('.dash-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`sec-${seccion}`).style.display = 'block';
  const link = document.querySelector(`.sidebar-link[onclick*="${seccion}"]`);
  if (link) link.classList.add('active');
  if (seccion === 'usuarios') cargarUsuarios();
  if (seccion === 'propiedades') cargarTodasPropiedades();
};

const irAFiltrado = (seccion, status) => {
  irA(seccion);
  setTimeout(() => {
    const filtro = document.getElementById('filtro-status');
    if (filtro) { filtro.value = status; cargarTodasPropiedades(); }
  }, 100);
};

const irAFiltradoUsuarios = (plan) => {
  irA('usuarios');
  setTimeout(() => {
    const filtro = document.getElementById('filtro-plan');
    if (filtro) { filtro.value = plan; cargarUsuarios(); }
  }, 100);
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
  const search = document.getElementById('search-props')?.value || '';
  const url = `/admin/propiedades?${status ? 'status=' + status : ''}${search ? '&search=' + search : ''}`;
  const data = await api.get(url);
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
        ${p.propietario ? ` · ${p.propietario.nombre}` : ''}
      </div>
      ${p.motivo_rechazo ? `<div style="font-size:12px;color:#c62828;margin-top:4px">Motivo: ${p.motivo_rechazo}</div>` : ''}
    </div>
    <div class="prop-admin-actions">
      <span class="status-badge status-${p.status}">${p.status}</span>
      ${p.status === 'revision' ? `
        <button class="btn btn-primary" style="padding:5px 12px;font-size:12px" onclick="aprobarPropiedad('${p._id}')">Aprobar</button>
        <button class="btn btn-outline" style="padding:5px 12px;font-size:12px;border-color:#e65100;color:#e65100" onclick="abrirModalRechazo('${p._id}')">Rechazar</button>
      ` : ''}
      <button class="btn btn-outline" style="padding:5px 12px;font-size:12px;border-color:${p.status === 'bloqueada' ? '#2e7d32' : '#6a1b9a'};color:${p.status === 'bloqueada' ? '#2e7d32' : '#6a1b9a'}" onclick="bloquearPropiedad('${p._id}')">
        ${p.status === 'bloqueada' ? 'Desbloquear' : 'Bloquear'}
      </button>
      <button class="btn btn-outline" style="padding:5px 12px;font-size:12px;border-color:#c62828;color:#c62828" onclick="eliminarPropAdmin('${p._id}', '${p.titulo}')">Eliminar</button>
    </div>
  </div>`;

const aprobarPropiedad = async (id) => {
  const data = await api.patch(`/admin/propiedades/${id}/aprobar`);
  if (data.ok) { cargarRevision(); cargarDashboard(); }
};

const abrirModalRechazo = (id) => {
  propiedadArechazar = id;
  document.getElementById('motivo-rechazo').value = '';
  document.getElementById('modal-rechazo').style.display = 'flex';
};

const cerrarModal = () => {
  document.getElementById('modal-rechazo').style.display = 'none';
  propiedadArechazar = null;
};

const confirmarRechazo = async () => {
  const motivo = document.getElementById('motivo-rechazo').value.trim();
  if (!motivo) { alert('Por favor escribe el motivo del rechazo'); return; }
  const data = await api.patch(`/admin/propiedades/${propiedadArechazar}/rechazar`, { motivo });
  if (data.ok) { cerrarModal(); cargarRevision(); cargarDashboard(); }
};

const bloquearPropiedad = async (id) => {
  const data = await api.patch(`/admin/propiedades/${id}/bloquear`);
  if (data.ok) { cargarTodasPropiedades(); cargarDashboard(); }
};

const eliminarPropAdmin = async (id, titulo) => {
  if (!confirm(`¿Eliminar permanentemente "${titulo}"? Esta acción no se puede deshacer.`)) return;
  const data = await api.delete(`/admin/propiedades/${id}`);
  if (data.ok) { cargarTodasPropiedades(); cargarDashboard(); }
};

const cargarUsuarios = async () => {
  const lista = document.getElementById('usuarios-lista');
  const plan = document.getElementById('filtro-plan')?.value || '';
  const search = document.getElementById('search-usuarios')?.value || '';
  const url = `/admin/usuarios?${plan ? 'plan=' + plan : ''}${search ? '&search=' + search : ''}`;
  const data = await api.get(url);
  if (!data.usuarios || data.usuarios.length === 0) {
    lista.innerHTML = '<div class="loading">No hay usuarios.</div>';
    return;
  }
  lista.innerHTML = data.usuarios.map(u => `
    <div class="usuario-card">
      <div class="usuario-avatar">${u.nombre.charAt(0).toUpperCase()}</div>
      <div class="usuario-info">
        <div class="usuario-nombre">${u.nombre}</div>
        <div class="usuario-meta">${u.email} · ${u.telefono || 'Sin teléfono'} · ${new Date(u.createdAt).toLocaleDateString('es-MX')}</div>
      </div>
      <div class="usuario-actions">
        <span class="plan-badge plan-${u.plan}">${u.plan}</span>
        <span class="status-badge status-${u.status}">${u.status}</span>
        <button class="btn btn-outline" style="padding:5px 10px;font-size:12px" onclick="cambiarPlan('${u._id}', '${u.plan}')">Plan</button>
        <button class="btn btn-outline" style="padding:5px 10px;font-size:12px;border-color:${u.status === 'activo' ? '#e65100' : '#2e7d32'};color:${u.status === 'activo' ? '#e65100' : '#2e7d32'}" onclick="suspenderUsuario('${u._id}')">
          ${u.status === 'activo' ? 'Suspender' : 'Activar'}
        </button>
        <button class="btn btn-outline" style="padding:5px 10px;font-size:12px;border-color:#c62828;color:#c62828" onclick="eliminarUsuario('${u._id}', '${u.nombre}')">Eliminar</button>
      </div>
    </div>`).join('');
};

const cambiarPlan = async (id, planActual) => {
  const planes = ['gratuito', 'basico', 'premium'];
  const nuevo = prompt(`Plan actual: ${planActual}\nEscribe el nuevo plan:\ngratuito / basico / premium`);
  if (!nuevo || !planes.includes(nuevo.trim())) return;
  const data = await api.patch(`/admin/usuarios/${id}/plan`, { plan: nuevo.trim() });
  if (data.ok) cargarUsuarios();
};

const suspenderUsuario = async (id) => {
  const data = await api.patch(`/admin/usuarios/${id}/suspender`);
  if (data.ok) cargarUsuarios();
};

const eliminarUsuario = async (id, nombre) => {
  if (!confirm(`¿Eliminar al usuario "${nombre}"? Sus propiedades serán desactivadas.`)) return;
  const data = await api.delete(`/admin/usuarios/${id}`);
  if (data.ok) { cargarUsuarios(); cargarDashboard(); }
};

const temas = {
  default: { nombre: 'Verde bosque', primary: '#1a472a', primaryLight: '#2d6a4f', accent: '#f4a261', accentDark: '#e76f51', bgDark: '#0f1923' },
  azul: { nombre: 'Azul océano', primary: '#1a3a6e', primaryLight: '#2a5298', accent: '#64b5f6', accentDark: '#1976d2', bgDark: '#0a1628' },
  dorado: { nombre: 'Dorado luxury', primary: '#8B6914', primaryLight: '#b8860b', accent: '#ffd700', accentDark: '#daa520', bgDark: '#1a1200' },
  rojo: { nombre: 'Rojo pasión', primary: '#8B1414', primaryLight: '#b71c1c', accent: '#ff8a65', accentDark: '#e64a19', bgDark: '#1a0000' },
  navidad: { nombre: 'Navidad', primary: '#1b5e20', primaryLight: '#2e7d32', accent: '#ef9a9a', accentDark: '#c62828', bgDark: '#0d1f0d' },
  morado: { nombre: 'Morado real', primary: '#3d1a6e', primaryLight: '#6a1b9a', accent: '#ce93d8', accentDark: '#8e24aa', bgDark: '#0f0a1a' }
};

const aplicarTema = async (nombreTema) => {
  const tema = temas[nombreTema];
  if (!tema) return;
  const msgEl = document.getElementById('tema-msg');
  const data = await api.patch('/site/tema', { tema: { nombre: nombreTema, ...tema } });
  if (data.ok) {
    document.querySelectorAll('.tema-card').forEach(c => c.classList.remove('activo'));
    document.getElementById(`tema-${nombreTema}`)?.classList.add('activo');
    msgEl.innerHTML = `<div class="alert alert-success">✓ Tema "${tema.nombre}" aplicado al sitio</div>`;
    msgEl.style.display = 'block';
    setTimeout(() => msgEl.style.display = 'none', 3000);
  } else {
    msgEl.innerHTML = '<div class="alert alert-error">Error al aplicar el tema</div>';
    msgEl.style.display = 'block';
  }
};

const cargarDestacadas = async () => {
  const lista = document.getElementById('destacadas-lista');
  const dataProps = await api.get('/admin/propiedades?status=aprobada');
  const dataConf = await api.get('/site/destacadas');
  const destacadasIds = (dataConf.destacadas || []).map(d => d._id);
  if (!dataProps.propiedades || dataProps.propiedades.length === 0) {
    lista.innerHTML = '<div class="loading">No hay propiedades aprobadas.</div>';
    return;
  }
  lista.innerHTML = dataProps.propiedades.map(p => {
    const esDestacada = destacadasIds.includes(p._id);
    return `
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
          <span class="status-badge ${esDestacada ? 'status-aprobada' : 'status-revision'}">${esDestacada ? '⭐ Destacada' : 'Normal'}</span>
          <button class="btn ${esDestacada ? 'btn-outline' : 'btn-primary'}" style="padding:6px 14px;font-size:13px" onclick="toggleDestacada('${p._id}', ${esDestacada})">
            ${esDestacada ? 'Quitar' : '⭐ Destacar'}
          </button>
        </div>
      </div>`;
  }).join('');
};

const toggleDestacada = async (id, esDestacada) => {
  const accion = esDestacada ? 'quitar' : 'agregar';
  const data = await api.patch('/site/destacadas', { propiedadId: id, accion });
  if (data.ok) cargarDestacadas();
};