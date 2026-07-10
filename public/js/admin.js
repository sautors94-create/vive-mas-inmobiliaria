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
  if (seccion === 'leads') cargarLeads();
  if (seccion === 'pagos') cargarPagosAdmin();
  if (seccion === 'usuarios') cargarUsuarios();
  if (seccion === 'temas') cargarTemasPersonalizados();
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
    <div class="stat-card azul" onclick="irA('leads')" style="cursor:pointer">
      <div class="stat-numero">${s.totalLeads || 0}</div>
      <div class="stat-label">Leads capturados</div>
      <div style="font-size:11px;color:var(--color-text-tertiary);margin-top:8px">${s.leadsNuevos || 0} nuevos →</div>
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

  // --- Fase 5.3: Tendencias (backend provee datos) ---
  try {
    const trendsWrap = document.getElementById('admin-trends');
    if (trendsWrap && window.adminCharts?.renderBarTrend) {
      trendsWrap.style.display = 'block';

      const t = data?.trends || {};
      const labels = t.labels || ['P1','P2','P3','P4','P5','P6'];

      const rev = t.propiedadesPorStatus?.revision || [];
      const ap = t.propiedadesPorStatus?.aprobada || [];
      const re = t.propiedadesPorStatus?.rechazada || [];
      const bl = t.propiedadesPorStatus?.bloqueada || [];

      const len = Math.max(rev.length, ap.length, re.length, bl.length, labels.length, 1);
      const safe = (arr) => Array.from({ length: len }, (_, i) => Number(arr[i] || 0));
      const Vrev = safe(rev);
      const Vap = safe(ap);
      const Vre = safe(re);
      const Vbl = safe(bl);

      const values = Vrev.map((v, i) => v + Vap[i] + Vre[i] + Vbl[i]);

      window.adminCharts.renderBarTrend(document.getElementById('trend-prop-status'), {
        labels: labels.slice(0, len),
        series: [{ name: 'Propiedades por status', values: values.slice(0, len), color: '#1a472a' }]
      });

      const leadsValues = t.leadsCapturados || [];
      const Vleads = Array.from({ length: len }, (_, i) => Number(leadsValues[i] || 0));
      window.adminCharts.renderBarTrend(document.getElementById('trend-leads'), {
        labels: labels.slice(0, len),
        series: [{ name: 'Leads capturados', values: Vleads.slice(0, len), color: '#e76f51' }]
      });
    }
  } catch (e) {}
};

const irA = (seccion) => {
  document.querySelectorAll('.dash-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`sec-${seccion}`).style.display = 'block';
  const link = document.querySelector(`.sidebar-link[onclick*="${seccion}"]`);
  if (link) link.classList.add('active');
  if (seccion === 'usuarios') cargarUsuarios();
  if (seccion === 'propiedades') cargarTodasPropiedades();
  if (seccion === 'leads') cargarLeads();
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

  lista.innerHTML = `
    <div class="admin-table-wrap">
      <div class="admin-table">
        <div class="admin-table-head">
          <div class="th-avatar">Propiedad</div>
          <div class="th-location">Ubicación</div>
          <div class="th-price">Precio</div>
          <div class="th-owner">Propietario</div>
          <div class="th-status">Status</div>
          <div class="th-actions">Acciones</div>
        </div>
        <div class="admin-table-body">
          ${data.propiedades.map(p => {
            const foto = (p.fotos && p.fotos.length > 0) ? p.fotos[0] : null;
            const propietario = p.propietario?.nombre || '—';
            const ciudad = p.ubicacion?.ciudad || '—';
            const estado = p.ubicacion?.estado || '—';
            const motivo = p.motivo_rechazo ? `\n              <div class="admin-table-reason">Motivo: ${escapeHtml(p.motivo_rechazo)}</div>` : '';

            return `
              <div class="tr" role="row">
                <div class="td th-avatar" data-label="Propiedad">
                  <div class="prop-avatar">
                    ${foto ? `<img src="${foto}" alt="${escapeHtml(p.titulo)}" />` : `<div class="prop-avatar-placeholder">${escapeHtml((p.titulo || '?').charAt(0).toUpperCase())}</div>`}
                  </div>
                  <div class="prop-title">${escapeHtml(p.titulo || 'Sin título')}</div>
                  ${motivo}
                </div>

                <div class="td th-location" data-label="Ubicación">${escapeHtml(ciudad)}, ${escapeHtml(estado)}</div>
                <div class="td th-price" data-label="Precio">${formatPrecio(p.precio)}</div>
                <div class="td th-owner" data-label="Propietario">${escapeHtml(propietario)}</div>

                <div class="td th-status" data-label="Status">
                  <span class="status-badge status-${p.status}">${escapeHtml(p.status)}</span>
                </div>

                <div class="td th-actions" data-label="Acciones">
                  <div class="admin-actions-row">
                    <button class="btn btn-primary admin-mini-btn" onclick="aprobarPropiedad('${p._id}')">Aprobar</button>
                    <button class="btn btn-outline admin-mini-btn" onclick="abrirModalRechazo('${p._id}')">Rechazar</button>
                    <button class="btn btn-outline admin-mini-btn" onclick="bloquearPropiedad('${p._id}')">
                      Bloquear
                    </button>
                    <button class="btn btn-outline admin-mini-btn admin-danger" onclick="eliminarPropAdmin('${p._id}', '${escapeHtml(p.titulo || '')}')">Eliminar</button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
};

const escapeHtml = (str) => {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
.replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"')
    .replaceAll("'", '&#039;');
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


const cargarLeads = async () => {
  const lista = document.getElementById('leads-lista');
  const status = document.getElementById('filtro-leads-status')?.value || '';
  const tipo = document.getElementById('filtro-leads-tipo')?.value || '';
  const search = document.getElementById('search-leads')?.value || '';
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (tipo) params.append('tipo', tipo);
  if (search) params.append('search', search);

  const data = await api.get(`/admin/leads?${params.toString()}`);
  if (!data.leads || data.leads.length === 0) {
    lista.innerHTML = '<div class="loading">No hay leads con esos filtros.</div>';
    return;
  }

  lista.innerHTML = data.leads.map(lead => {
    const esSoporte = lead.tipo === 'soporte';
    const badgeTipo = esSoporte
      ? `<span class="status-badge" style="background:#eff6ff;color:#1d4ed8">🎧 Soporte</span>`
      : `<span class="status-badge" style="background:#f0fdf4;color:#166534">🏠 Servicio</span>`;
    return `
    <div class="lead-card">
      <div class="lead-main">
        <div class="lead-title">
          <span>${lead.nombre}</span>
          ${badgeTipo}
          <span class="status-badge status-${lead.status}">${lead.status}</span>
        </div>
        <div class="lead-meta">
          ${lead.folio || 'Sin folio'} · ${lead.telefono}${lead.email ? ' · ' + lead.email : ''}${lead.ciudad ? ' · ' + lead.ciudad : ''}
        </div>
        <div class="lead-meta">
          ${lead.servicio || 'Servicio no especificado'}${lead.usuarioRegistrado ? ' · Usuario: ' + lead.usuarioRegistrado.nombre : ''}
        </div>
      </div>
      <div class="lead-date">${new Date(lead.createdAt).toLocaleDateString('es-MX')}</div>
    </div>`;
  }).join('');
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
  if (data.ok) {
    dsToast({ title: 'Propiedad aprobada', message: 'Ya es visible en el catálogo público.', type: 'success' });
    cargarRevision(); cargarDashboard();
  } else if (data.esPropiaPropiedad) {
    dsToast({
      title: 'No permitido',
      message: 'No puedes aprobar tus propias propiedades. Otro administrador debe revisarla.',
      type: 'error'
    });
  } else {
    dsToast({ title: 'No se pudo aprobar', message: data.error || 'Intenta de nuevo.', type: 'error' });
  }
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
  if (!motivo) { dsToast({ title: 'Falta el motivo', message: 'Escribe el motivo del rechazo antes de continuar.', type: 'error' }); return; }
  const data = await api.patch(`/admin/propiedades/${propiedadArechazar}/rechazar`, { motivo });
  if (data.ok) {
    dsToast({ title: 'Propiedad rechazada', message: 'Se notificó el motivo al propietario.', type: 'info' });
    cerrarModal(); cargarRevision(); cargarDashboard();
  } else {
    dsToast({ title: 'No se pudo rechazar', message: data.error || 'Intenta de nuevo.', type: 'error' });
  }
};

const bloquearPropiedad = async (id) => {
  const data = await api.patch(`/admin/propiedades/${id}/bloquear`);
  if (data.ok) {
    dsToast({ title: 'Estado actualizado', message: 'El bloqueo de la propiedad se actualizó.', type: 'success' });
    cargarTodasPropiedades(); cargarDashboard();
  } else {
    dsToast({ title: 'No se pudo actualizar', message: data.error || 'Intenta de nuevo.', type: 'error' });
  }
};

const eliminarPropAdmin = async (id, titulo) => {
  const ok = await dsConfirm({
    title: '¿Eliminar propiedad?',
    message: `"${titulo}" se eliminará permanentemente. Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar',
    danger: true
  });
  if (!ok) return;
  const data = await api.delete(`/admin/propiedades/${id}`);
  if (data.ok) {
    dsToast({ title: 'Propiedad eliminada', message: `"${titulo}" fue eliminada.`, type: 'success' });
    cargarTodasPropiedades(); cargarDashboard();
  } else {
    dsToast({ title: 'No se pudo eliminar', message: data.error || 'Intenta de nuevo.', type: 'error' });
  }
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
        <button class="btn btn-outline" style="padding:5px 10px;font-size:12px" onclick="seleccionarPlan('${u._id}', '${u.plan}')">Plan</button>
        <button class="btn btn-outline" style="padding:5px 10px;font-size:12px;border-color:${u.status === 'activo' ? '#e65100' : '#2e7d32'};color:${u.status === 'activo' ? '#e65100' : '#2e7d32'}" onclick="suspenderUsuario('${u._id}')">
          ${u.status === 'activo' ? 'Suspender' : 'Activar'}
        </button>
        <button class="btn btn-outline" style="padding:5px 10px;font-size:12px;border-color:#c62828;color:#c62828" onclick="eliminarUsuario('${u._id}', '${u.nombre}')">Eliminar</button>
      </div>
    </div>`).join('');
};

let estilosPlanInyectados = false;
const inyectarEstilosPlan = () => {
  if (estilosPlanInyectados) return;
  estilosPlanInyectados = true;
  const style = document.createElement('style');
  style.textContent = `
    .ds-plan-overlay {
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(2px); display: flex; align-items: center;
      justify-content: center; z-index: 10500; opacity: 0;
      transition: opacity 160ms ease; font-family: 'Inter', 'Segoe UI', sans-serif;
    }
    .ds-plan-overlay.active { opacity: 1; }
    .ds-plan-box { background: white; border-radius: 16px; padding: 28px; max-width: 380px; width: 90%; box-shadow: 0 24px 60px rgba(0,0,0,0.28); }
    .ds-plan-title { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 16px; }
    .ds-plan-option {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; border-radius: 10px; border: 2px solid #e5e7eb;
      margin-bottom: 10px; cursor: pointer; transition: border-color 0.15s; font-size: 14px; font-weight: 600;
    }
    .ds-plan-option:hover { border-color: var(--primary, #1a472a); }
    .ds-plan-option.actual { border-color: var(--primary, #1a472a); background: #f0fdf4; }
    .ds-plan-cancel { width: 100%; margin-top: 6px; padding: 10px; border: none; border-radius: 10px; background: #f1f5f9; color: #475569; font-weight: 600; cursor: pointer; }
  `;
  document.head.appendChild(style);
};

const seleccionarPlan = (id, planActual) => {
  inyectarEstilosPlan();
  const planes = [
    { valor: 'gratuito', etiqueta: 'Gratuito' },
    { valor: 'basico', etiqueta: 'Básico' },
    { valor: 'premium', etiqueta: 'Premium' }
  ];

  const overlay = document.createElement('div');
  overlay.className = 'ds-plan-overlay';
  overlay.innerHTML = `
    <div class="ds-plan-box">
      <div class="ds-plan-title">Cambiar plan del usuario</div>
      ${planes.map(p => `<div class="ds-plan-option ${p.valor === planActual ? 'actual' : ''}" data-plan="${p.valor}">${p.etiqueta} ${p.valor === planActual ? '· Actual' : ''}</div>`).join('')}
      <button class="ds-plan-cancel">Cancelar</button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));

  const cerrar = () => {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 160);
  };

  overlay.querySelectorAll('.ds-plan-option').forEach(opt => {
    opt.addEventListener('click', async () => {
      const nuevoPlan = opt.dataset.plan;
      cerrar();
      if (nuevoPlan === planActual) return;
      const data = await api.patch(`/admin/usuarios/${id}/plan`, { plan: nuevoPlan });
      if (data.ok) {
        dsToast({ title: 'Plan actualizado', message: `El usuario ahora tiene el plan ${nuevoPlan}.`, type: 'success' });
        cargarUsuarios();
      } else {
        dsToast({ title: 'No se pudo cambiar el plan', message: data.error || 'Intenta de nuevo.', type: 'error' });
      }
    });
  });

  overlay.querySelector('.ds-plan-cancel').addEventListener('click', cerrar);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
};

const suspenderUsuario = async (id) => {
  const data = await api.patch(`/admin/usuarios/${id}/suspender`);
  if (data.ok) {
    dsToast({ title: 'Estado actualizado', message: 'El estado del usuario se actualizó.', type: 'success' });
    cargarUsuarios();
  } else {
    dsToast({ title: 'No se pudo actualizar', message: data.error || 'Intenta de nuevo.', type: 'error' });
  }
};

const eliminarUsuario = async (id, nombre) => {
  const ok = await dsConfirm({
    title: '¿Eliminar usuario?',
    message: `"${nombre}" será eliminado y sus propiedades se desactivarán.`,
    confirmText: 'Eliminar',
    danger: true
  });
  if (!ok) return;
  const data = await api.delete(`/admin/usuarios/${id}`);
  if (data.ok) {
    dsToast({ title: 'Usuario eliminado', message: `"${nombre}" fue eliminado.`, type: 'success' });
    cargarUsuarios(); cargarDashboard();
  } else {
    dsToast({ title: 'No se pudo eliminar', message: data.error || 'Intenta de nuevo.', type: 'error' });
  }
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
    aplicarVariablesCSS(tema);
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
const sincronizarColor = (campo, valor) => {
  const colorInput = document.getElementById(`cp-${campo}`);
  if (colorInput && valor.startsWith('#') && valor.length === 7) {
    colorInput.value = valor;
    previsualizarPaleta();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ['primary', 'primaryLight', 'accent', 'accentDark', 'bgDark'].forEach(campo => {
    const colorPicker = document.getElementById(`cp-${campo}`);
    if (colorPicker) {
      colorPicker.addEventListener('input', (e) => {
        const hexInput = document.getElementById(`cp-${campo}-hex`);
        if (hexInput) hexInput.value = e.target.value;
        previsualizarPaleta();
      });
    }
  });
});

const getPaletaPersonalizada = () => ({
  nombre: 'personalizado',
  primary: document.getElementById('cp-primary')?.value || '#1a472a',
  primaryLight: document.getElementById('cp-primaryLight')?.value || '#2d6a4f',
  accent: document.getElementById('cp-accent')?.value || '#f4a261',
  accentDark: document.getElementById('cp-accentDark')?.value || '#e76f51',
  bgDark: document.getElementById('cp-bgDark')?.value || '#0f1923',
});

const previsualizarPaleta = () => {
  const t = getPaletaPersonalizada();
  const hero = document.getElementById('prev-hero');
  const mas = document.getElementById('prev-mas');
  const btnPrimary = document.getElementById('prev-btn-primary');
  const btnAccent = document.getElementById('prev-btn-accent');
  const price = document.getElementById('prev-price');
  if (hero) hero.style.background = `linear-gradient(135deg,${t.bgDark},${t.primary})`;
  if (mas) mas.style.color = t.accent;
  if (btnPrimary) btnPrimary.style.background = t.primary;
  if (btnAccent) btnAccent.style.background = t.accentDark;
  if (price) price.style.color = t.primary;
};

const aplicarPaletaPersonalizada = async () => {
  const tema = getPaletaPersonalizada();
  const msgEl = document.getElementById('paleta-msg');
  const data = await api.patch('/site/tema', { tema });
  if (data.ok) {
    aplicarVariablesCSS(tema);
    document.querySelectorAll('.tema-card').forEach(c => c.classList.remove('activo'));
    msgEl.innerHTML = '<div class="alert alert-success">✓ Paleta personalizada aplicada al sitio</div>';
    msgEl.style.display = 'block';
    setTimeout(() => msgEl.style.display = 'none', 3000);
  } else {
    msgEl.innerHTML = '<div class="alert alert-error">Error al aplicar la paleta</div>';
    msgEl.style.display = 'block';
  }
};
const guardarTemaPersonalizado = async () => {
  const nombre = document.getElementById('cp-nombre')?.value.trim();
  const msgEl = document.getElementById('paleta-msg');
  if (!nombre) {
    msgEl.innerHTML = '<div class="alert alert-error">Por favor escribe un nombre para el tema</div>';
    msgEl.style.display = 'block';
    return;
  }
  const tema = getPaletaPersonalizada();
  tema.nombre = nombre;
  const data = await api.post('/site/temas-personalizados', tema);
  if (data.ok) {
    msgEl.innerHTML = `<div class="alert alert-success">✓ Tema "${nombre}" guardado correctamente</div>`;
    msgEl.style.display = 'block';
    setTimeout(() => msgEl.style.display = 'none', 3000);
    cargarTemasPersonalizados();
  } else {
    msgEl.innerHTML = '<div class="alert alert-error">Error al guardar el tema</div>';
    msgEl.style.display = 'block';
  }
};

const cargarTemasPersonalizados = async () => {
  const lista = document.getElementById('temas-personalizados-lista');
  if (!lista) return;
  const data = await api.get('/site/config');
  if (!data.ok || !data.config.temasPersonalizados?.length) {
    lista.innerHTML = '<div style="font-size:13px;color:var(--text-light)">No tienes temas guardados aún.</div>';
    return;
  }
  lista.innerHTML = data.config.temasPersonalizados.map(t => `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--bg-secondary);border-radius:12px;border:1px solid var(--border)">
      <div style="display:flex;gap:4px;flex-shrink:0">
        <div style="width:20px;height:20px;border-radius:4px;background:${t.bgDark}"></div>
        <div style="width:20px;height:20px;border-radius:4px;background:${t.primary}"></div>
        <div style="width:20px;height:20px;border-radius:4px;background:${t.accent}"></div>
        <div style="width:20px;height:20px;border-radius:4px;background:${t.accentDark}"></div>
      </div>
      <div style="flex:1;font-size:14px;font-weight:600;color:var(--text)">${t.nombre}</div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" style="padding:5px 12px;font-size:12px" onclick="aplicarTemaPersonalizado('${t._id}', ${JSON.stringify(t).replace(/"/g, "'")})">Aplicar</button>
        <button class="btn btn-outline" style="padding:5px 12px;font-size:12px" onclick="cargarEnPaleta('${t._id}')">Editar</button>
        <button class="btn btn-outline" style="padding:5px 12px;font-size:12px;border-color:#c62828;color:#c62828" onclick="eliminarTemaPersonalizado('${t._id}', '${t.nombre}')">Eliminar</button>
      </div>
    </div>`).join('');
};

const aplicarTemaPersonalizado = async (id, tema) => {
  const data = await api.patch('/site/tema', { tema });
  if (data.ok) {
    aplicarVariablesCSS(tema);
    document.getElementById('tema-msg').innerHTML = `<div class="alert alert-success">✓ Tema "${tema.nombre}" aplicado al sitio</div>`;
    document.getElementById('tema-msg').style.display = 'block';
    setTimeout(() => document.getElementById('tema-msg').style.display = 'none', 3000);
  }
};

const cargarEnPaleta = async (id) => {
  const data = await api.get('/site/config');
  if (!data.ok) return;
  const tema = data.config.temasPersonalizados.find(t => t._id === id);
  if (!tema) return;
  document.getElementById('cp-nombre').value = tema.nombre;
  document.getElementById('cp-primary').value = tema.primary;
  document.getElementById('cp-primary-hex').value = tema.primary;
  document.getElementById('cp-primaryLight').value = tema.primaryLight;
  document.getElementById('cp-primaryLight-hex').value = tema.primaryLight;
  document.getElementById('cp-accent').value = tema.accent;
  document.getElementById('cp-accent-hex').value = tema.accent;
  document.getElementById('cp-accentDark').value = tema.accentDark;
  document.getElementById('cp-accentDark-hex').value = tema.accentDark;
  document.getElementById('cp-bgDark').value = tema.bgDark;
  document.getElementById('cp-bgDark-hex').value = tema.bgDark;
  previsualizarPaleta();
};

const eliminarTemaPersonalizado = async (id, nombre) => {
  const ok = await dsConfirm({
    title: '¿Eliminar tema?',
    message: `El tema "${nombre}" se eliminará de tus temas guardados.`,
    confirmText: 'Eliminar',
    danger: true
  });
  if (!ok) return;
  const data = await api.delete(`/site/temas-personalizados/${id}`);
  if (data.ok) {
    dsToast({ title: 'Tema eliminado', message: `"${nombre}" fue eliminado.`, type: 'success' });
    cargarTemasPersonalizados();
  } else {
    dsToast({ title: 'No se pudo eliminar', message: data.error || 'Intenta de nuevo.', type: 'error' });
  }
};

// ========== IMPORTAR USUARIOS ==========
let archivoSeleccionado = null;

const mostrarModalImportar = () => {
  document.getElementById('modal-importar').style.display = 'flex';
  archivoSeleccionado = null;
  document.getElementById('archivo-seleccionado').textContent = '📁 Haz clic para seleccionar archivo';
  document.getElementById('importar-resultado').style.display = 'none';
  document.getElementById('btn-importar').disabled = true;
};

const cerrarModalImportar = () => {
  document.getElementById('modal-importar').style.display = 'none';
  archivoSeleccionado = null;
};

const seleccionarArchivo = (input) => {
  const file = input.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx', 'csv'].includes(ext)) {
    dsToast({ title: 'Formato no válido', message: 'Solo se aceptan archivos Excel (.xlsx) o CSV.', type: 'error' });
    return;
  }
  archivoSeleccionado = file;
  document.getElementById('archivo-seleccionado').textContent = `📄 ${file.name}`;
  document.getElementById('btn-importar').disabled = false;
};

const importarUsuarios = async () => {
  if (!archivoSeleccionado) {
    dsToast({ title: 'Falta el archivo', message: 'Selecciona un archivo primero.', type: 'error' });
    return;
  }
  
  const btn = document.getElementById('btn-importar');
  btn.disabled = true;
  btn.textContent = 'Importando...';
  
  const formData = new FormData();
  formData.append('archivo', archivoSeleccionado);
  
  try {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_URL}/api/admin/usuarios/masivo`, {
      method: 'POST',
      headers: { 'Authorization': token ? `Bearer ${token}` : '' },
      body: formData
    });
    
    const data = await res.json();
    const resultadoDiv = document.getElementById('importar-resultado');
    resultadoDiv.style.display = 'block';
    
    if (data.ok) {
      const r = data.resultado;
      resultadoDiv.style.background = '#f0fdf4';
      resultadoDiv.style.color = '#166534';
      resultadoDiv.innerHTML = `
        <strong>✓ Importación completada</strong><br>
        Total procesados: ${r.totalProcesados}<br>
        Creados exitosamente: ${r.totalCreados}<br>
        Errores: ${r.totalErrores}
        ${r.errores && r.errores.length > 0 ? `<br><strong>Errores:</strong><br>${r.errores.map(e => `Fila ${e.fila}: ${e.email} - ${e.error}`).join('<br>')}` : ''}
      `;
      // Recargar lista de usuarios
      cargarUsuarios();
    } else {
      resultadoDiv.style.background = '#fef2f2';
      resultadoDiv.style.color = '#991b1b';
      resultadoDiv.innerHTML = `<strong>Error:</strong> ${data.error}`;
    }
  } catch (error) {
    const resultadoDiv = document.getElementById('importar-resultado');
    resultadoDiv.style.display = 'block';
    resultadoDiv.style.background = '#fef2f2';
    resultadoDiv.style.color = '#991b1b';
    resultadoDiv.innerHTML = `<strong>Error de conexión:</strong> ${error.message}`;
  }
  
  btn.disabled = false;
  btn.textContent = 'Importar usuarios';
};

const descargarPlantillaUsuarios = async () => {
  try {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_URL}/api/admin/usuarios/plantilla`, {
      headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    });
    
    if (!res.ok) throw new Error('Error al descargar');
    
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_usuarios.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    dsToast({ title: 'No se pudo descargar', message: error.message, type: 'error' });
  }
};

// ==================== MÓDULO DE PAGOS Y CONCILIACIÓN ====================
let pagoEnEdicionId = null;

window.cargarPagosAdmin = async () => {
  const tbody = document.getElementById('pagos-admin-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="padding:40px;text-align:center">Buscando pagos...</td></tr>';

  const search = document.getElementById('pago-filtro-search').value;
  const plan = document.getElementById('pago-filtro-plan').value;
  const estatus = document.getElementById('pago-filtro-estatus').value;

  try {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (plan) params.append('plan', plan);
    if (estatus) params.append('estatus', estatus);

    const data = await api.get(`/admin/pagos?${params.toString()}`);
    
    if (!data.ok || !data.pagos || !data.pagos.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--text-light)">No se encontraron pagos.</td></tr>';
      return;
    }

    tbody.innerHTML = data.pagos.map(p => {
      const fecha = new Date(p.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
      return `
        <tr>
          <td>${fecha}</td>
          <td>
            <div style="font-weight:600">${p.usuario_email || 'N/A'}</div>
            <div style="font-size:11px;color:var(--text-light)">ID: ${p.stripe_session_id?.substring(0, 15)}...</div>
          </td>
          <td style="text-transform:capitalize">${p.plan_contratado}</td>
          <td style="font-weight:700">$${p.monto} MXN</td>
          <td><span class="badge-estatus badge-${p.estatus}">${p.estatus}</span></td>
          <td>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-outline" style="padding:4px 10px;font-size:11px" onclick="window.open('https://dashboard.stripe.com/payments/${p.stripe_session_id}', '_blank')" target="_blank">🔍 Stripe</button>
              <button class="btn btn-outline" style="padding:4px 10px;font-size:11px" onclick="abrirModalAclaracion('${p._id}', '${p.stripe_session_id}', \`${p.notas_admin || ''}\`)">📝 Nota</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding:40px;text-align:center;color:red">Error al conectar con el servidor.</td></tr>';
  }
};

window.abrirModalAclaracion = (id, stripeId, notaActual) => {
  pagoEnEdicionId = id;
  document.getElementById('aclaracion-id').textContent = stripeId;
  document.getElementById('aclaracion-texto').value = notaActual;
  document.getElementById('modal-aclaracion-pago').style.display = 'flex';
};

window.guardarAclaracion = async () => {
  const texto = document.getElementById('aclaracion-texto').value;
  try {
    const data = await api.patch(`/admin/pagos/${pagoEnEdicionId}`, { notas_admin: texto });
    if (data.ok) {
      dsToast({ title: 'Guardado', message: 'Nota agregada al pago.', type: 'success' });
      document.getElementById('modal-aclaracion-pago').style.display = 'none';
      cargarPagosAdmin(); 
    }
  } catch (e) {
    dsToast({ title: 'Error', message: 'No se pudo guardar.', type: 'error' });
  }
};