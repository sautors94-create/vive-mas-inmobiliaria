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
  const sec = document.getElementById(`sec-${seccion}`);
  if (sec) sec.style.display = 'block';
  event.target.closest('.sidebar-link')?.classList.add('active');
  if (seccion === 'dashboard') cargarDashboard();
  if (seccion === 'revision') cargarRevision();
  if (seccion === 'propiedades') cargarTodasPropiedades();
  if (seccion === 'leads') cargarLeads();
  if (seccion === 'pagos') cargarPagosAdmin();
  if (seccion === 'usuarios') cargarUsuarios();
  if (seccion === 'temas') cargarTemasPersonalizados();
  if (seccion === 'destacadas') cargarDestacadas();
  if (seccion === 'bloqueos') cargarVetados();
  if (seccion === 'monitoreo') cargarMonitoreo();
  if (seccion === 'novedades') cargarNovedades();
  if (seccion === 'reportes') cargarReportes();
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
  const sec = document.getElementById(`sec-${seccion}`);
  if (sec) sec.style.display = 'block';
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
  const search = document.getElementById('rev-filtro-search')?.value || '';
  const tipo = document.getElementById('rev-filtro-tipo')?.value || '';
  const ciudad = document.getElementById('rev-filtro-ciudad')?.value || '';
  const orden = document.getElementById('rev-filtro-orden')?.value || 'antigua';

  const params = new URLSearchParams({ status: 'revision' });
  if (search) params.append('search', search);
  if (tipo) params.append('tipo', tipo);
  if (ciudad) params.append('ciudad', ciudad);

  const data = await api.get(`/admin/propiedades?${params.toString()}`);
  let propiedades = data.propiedades || [];
  propiedades.sort((a, b) => orden === 'antigua'
    ? new Date(a.createdAt) - new Date(b.createdAt)
    : new Date(b.createdAt) - new Date(a.createdAt));

  const updEl = document.getElementById('rev-mod-updated');
  if (updEl) updEl.textContent = `Actualizado ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;

  renderRevModKpis(propiedades);

  if (propiedades.length === 0) {
    lista.innerHTML = '<div class="loading" style="color:var(--text-light)">No hay propiedades en revisión.</div>';
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
          <div class="th-status">Esperando</div>
          <div class="th-actions">Acciones</div>
        </div>
        <div class="admin-table-body">
          ${propiedades.map(p => {
            const foto = (p.fotos && p.fotos.length > 0) ? p.fotos[0] : null;
            const propietario = p.propietario?.nombre || '—';
            const ciudad = p.ubicacion?.ciudad || '—';
            const estado = p.ubicacion?.estado || '—';
            const dias = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86400000);

            return `
              <div class="tr" role="row" onclick="abrirDrawerPropiedad('${p._id}')" style="cursor:pointer">
                <div class="td th-avatar" data-label="Propiedad">
                  <div class="prop-avatar">
                    ${foto ? `<img src="${foto}" alt="${escapeHtml(p.titulo)}" />` : `<div class="prop-avatar-placeholder">${escapeHtml((p.titulo || '?').charAt(0).toUpperCase())}</div>`}
                  </div>
                  <div class="prop-title">${escapeHtml(p.titulo || 'Sin título')}</div>
                  ${(p.fotos || []).length < 3 ? '<div style="font-size:11px;color:#e65100;margin-top:2px">⚠️ Menos de 3 fotos</div>' : ''}
                </div>
                <div class="td th-location" data-label="Ubicación">${escapeHtml(ciudad)}, ${escapeHtml(estado)}</div>
                <div class="td th-price" data-label="Precio">${formatPrecio(p.precio)}</div>
                <div class="td th-owner" data-label="Propietario">${escapeHtml(propietario)}</div>
                <div class="td th-status" data-label="Esperando">
                  <span class="status-badge ${dias >= 3 ? 'status-rechazada' : 'status-revision'}">${dias === 0 ? 'Hoy' : `${dias} día${dias === 1 ? '' : 's'}`}</span>
                </div>
                <div class="td th-actions" data-label="Acciones" onclick="event.stopPropagation()">
                  <div class="admin-actions-row">
                    <button class="btn btn-primary admin-mini-btn" onclick="aprobarPropiedad('${p._id}')">Aprobar</button>
                    <button class="btn btn-outline admin-mini-btn" style="border-color:#e65100;color:#e65100" onclick="abrirModalRechazo('${p._id}')">Rechazar</button>
                    <button class="btn btn-outline admin-mini-btn" onclick="bloquearPropiedad('${p._id}')">Bloquear</button>
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

const renderRevModKpis = (propiedades) => {
  const el = document.getElementById('rev-mod-kpis');
  if (!el) return;
  const total = propiedades.length;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const nuevasHoy = propiedades.filter(p => new Date(p.createdAt) >= hoy).length;
  const masAntigua = total > 0 ? Math.max(...propiedades.map(p => Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86400000))) : 0;
  const fotosIncompletas = propiedades.filter(p => (p.fotos || []).length < 3).length;
  const kpis = [
    { num: total, label: 'Pendientes' },
    { num: nuevasHoy, label: 'Nuevas hoy' },
    { num: total ? `${masAntigua}d` : '—', label: 'Más antigua en cola' },
    { num: fotosIncompletas, label: 'Con menos de 3 fotos' },
  ];
  el.innerHTML = kpis.map(k => `<div class="mod-kpi-card"><div class="mod-kpi-num">${k.num}</div><div class="mod-kpi-label">${k.label}</div></div>`).join('');
};

const escapeHtml = (str) => {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"')
    .replaceAll("'", '&#039;');
};

let propMod = { data: [], ordenCampo: null, ordenAsc: true };

const cargarTodasPropiedades = async () => {
  const status = document.getElementById('filtro-status')?.value || '';
  const search = document.getElementById('search-props')?.value || '';
  const ciudad = document.getElementById('filtro-ciudad')?.value || '';
  const plan = document.getElementById('filtro-plan-prop')?.value || '';
  const rangoFecha = document.getElementById('filtro-fecha')?.value || '';

  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (search) params.append('search', search);
  if (ciudad) params.append('ciudad', ciudad);
  if (plan) params.append('plan', plan);
  if (rangoFecha) {
    const dias = rangoFecha === 'hoy' ? 0 : parseInt(rangoFecha, 10);
    const desde = new Date(); desde.setHours(0, 0, 0, 0); desde.setDate(desde.getDate() - dias);
    params.append('fechaDesde', desde.toISOString());
  }

  const [dataProps, dataStats] = await Promise.all([
    api.get(`/admin/propiedades?${params.toString()}`),
    api.get('/admin/propiedades/stats')
  ]);

  renderPropModKpis(dataStats);
  renderPropModTendencia(dataStats.tendencia || []);

  propMod.data = dataProps.propiedades || [];
  propMod.ordenCampo = null;
  renderPropModTabla();

  const updEl = document.getElementById('prop-mod-updated');
  if (updEl) updEl.textContent = `Actualizado ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
};

const renderPropModKpis = (s) => {
  const el = document.getElementById('prop-mod-kpis');
  if (!el || !s.ok) return;
  const kpis = [
    { num: s.total, label: 'Total' },
    { num: s.revision, label: 'En revisión' },
    { num: s.aprobadas, label: 'Aprobadas (30d)' },
    { num: s.rechazadas, label: 'Rechazadas (30d)' },
    { num: s.nuevasHoy, label: 'Nuevas hoy' }
  ];
  el.innerHTML = kpis.map(k => `<div class="mod-kpi-card"><div class="mod-kpi-num">${k.num}</div><div class="mod-kpi-label">${k.label}</div></div>`).join('');
};

const renderPropModTendencia = (tendencia) => {
  const el = document.getElementById('prop-mod-tendencia');
  if (!el || !window.adminCharts) return;
  window.adminCharts.renderBarTrend(el, {
    labels: tendencia.map(d => new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short' })),
    series: [{ name: 'Publicaciones nuevas', values: tendencia.map(d => d.count), color: 'var(--primary)' }]
  });
};

const ordenarPropiedades = (campo) => {
  if (propMod.ordenCampo === campo) { propMod.ordenAsc = !propMod.ordenAsc; }
  else { propMod.ordenCampo = campo; propMod.ordenAsc = true; }
  renderPropModTabla();
};

const valorOrdenable = (p, campo) => {
  switch (campo) {
    case 'titulo': return (p.titulo || '').toLowerCase();
    case 'propietario': return (p.propietario?.nombre || '').toLowerCase();
    case 'ciudad': return (p.ubicacion?.ciudad || '').toLowerCase();
    case 'precio': return p.precio || 0;
    case 'plan': return (p.propietario?.plan || '').toLowerCase();
    case 'status': return (p.status || '').toLowerCase();
    case 'fecha': return new Date(p.createdAt).getTime();
    default: return '';
  }
};

const renderPropModTabla = () => {
  const tbody = document.getElementById('prop-mod-tbody');
  if (!tbody) return;
  let filas = [...propMod.data];
  if (propMod.ordenCampo) {
    filas.sort((a, b) => {
      const va = valorOrdenable(a, propMod.ordenCampo);
      const vb = valorOrdenable(b, propMod.ordenCampo);
      if (va < vb) return propMod.ordenAsc ? -1 : 1;
      if (va > vb) return propMod.ordenAsc ? 1 : -1;
      return 0;
    });
  }
  if (filas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading">No hay propiedades con esos filtros.</td></tr>';
    return;
  }
  tbody.innerHTML = filas.map(p => `
    <tr onclick="abrirDrawerPropiedad('${p._id}')">
      <td>${escapeHtml(p.titulo || 'Sin título')}</td>
      <td>${escapeHtml(p.propietario?.nombre || '—')}</td>
      <td>${escapeHtml(p.ubicacion?.ciudad || '—')}</td>
      <td>${formatPrecio(p.precio)}</td>
      <td><span class="plan-badge plan-${p.propietario?.plan || 'gratuito'}">${p.propietario?.plan || 'gratuito'}</span></td>
      <td><span class="status-badge status-${p.status}">${p.status}</span></td>
      <td>${new Date(p.createdAt).toLocaleDateString('es-MX')}</td>
      <td onclick="event.stopPropagation()">
        ${p.status === 'revision' ? `<button class="btn btn-primary admin-mini-btn" onclick="aprobarPropiedad('${p._id}')">Aprobar</button>` : ''}
        <button class="btn btn-outline admin-mini-btn" onclick="abrirDrawerPropiedad('${p._id}')">Ver</button>
      </td>
    </tr>`).join('');
};

const exportarPropiedadesExcel = async () => {
  try {
    const status = document.getElementById('filtro-status')?.value || '';
    const search = document.getElementById('search-props')?.value || '';
    const ciudad = document.getElementById('filtro-ciudad')?.value || '';
    const plan = document.getElementById('filtro-plan-prop')?.value || '';
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    if (ciudad) params.append('ciudad', ciudad);
    if (plan) params.append('plan', plan);

    const token = localStorage.getItem('accessToken');
    const res = await fetch(`/api/admin/propiedades/exportar?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
    if (!res.ok) { const d = await res.json(); dsToast({ title: 'Error', message: d.error || 'No se pudo exportar', type: 'error' }); return; }
    const blob = await res.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `propiedades-${Date.now()}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    dsToast({ title: 'Exportado', message: 'Excel descargado correctamente.', type: 'success' });
  } catch (e) {
    dsToast({ title: 'Error', message: 'No se pudo generar el Excel', type: 'error' });
  }
};

let leadsMod = { data: [], ordenCampo: null, ordenAsc: true };

const cargarLeads = async () => {
  const status = document.getElementById('filtro-leads-status')?.value || '';
  const tipo = document.getElementById('filtro-leads-tipo')?.value || '';
  const search = document.getElementById('search-leads')?.value || '';
  const rangoFecha = document.getElementById('filtro-leads-fecha')?.value || '';

  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (tipo) params.append('tipo', tipo);
  if (search) params.append('search', search);
  if (rangoFecha) {
    const dias = rangoFecha === 'hoy' ? 0 : parseInt(rangoFecha, 10);
    const desde = new Date(); desde.setHours(0, 0, 0, 0); desde.setDate(desde.getDate() - dias);
    params.append('fechaDesde', desde.toISOString());
  }

  const [dataLeads, dataStats] = await Promise.all([
    api.get(`/admin/leads?${params.toString()}`),
    api.get('/admin/leads/stats')
  ]);

  renderLeadsModKpis(dataStats);
  if (window.adminCharts) {
    window.adminCharts.renderBarTrend(document.getElementById('leads-mod-tendencia'), {
      labels: (dataStats.tendencia || []).map(d => new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short' })),
      series: [{ name: 'Leads nuevos', values: (dataStats.tendencia || []).map(d => d.count), color: 'var(--primary)' }]
    });
  }

  leadsMod.data = dataLeads.leads || [];
  leadsMod.ordenCampo = null;
  renderLeadsModTabla();

  const updEl = document.getElementById('leads-mod-updated');
  if (updEl) updEl.textContent = `Actualizado ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
};

const renderLeadsModKpis = (s) => {
  const el = document.getElementById('leads-mod-kpis');
  if (!el || !s.ok) return;
  const kpis = [
    { num: s.total, label: 'Total' },
    { num: s.nuevos, label: 'Nuevos' },
    { num: s.contactados, label: 'Contactados' },
    { num: s.cerrados, label: 'Cerrados (30d)' },
    { num: s.nuevosHoy, label: 'Nuevos hoy' }
  ];
  el.innerHTML = kpis.map(k => `<div class="mod-kpi-card"><div class="mod-kpi-num">${k.num}</div><div class="mod-kpi-label">${k.label}</div></div>`).join('');
};

const ordenarLeads = (campo) => {
  if (leadsMod.ordenCampo === campo) { leadsMod.ordenAsc = !leadsMod.ordenAsc; }
  else { leadsMod.ordenCampo = campo; leadsMod.ordenAsc = true; }
  renderLeadsModTabla();
};

const valorOrdenableLead = (l, campo) => {
  switch (campo) {
    case 'folio': return (l.folio || '').toLowerCase();
    case 'nombre': return (l.nombre || '').toLowerCase();
    case 'tipo': return (l.tipo || '').toLowerCase();
    case 'servicio': return (l.servicio || '').toLowerCase();
    case 'ciudad': return (l.ciudad || '').toLowerCase();
    case 'status': return (l.status || '').toLowerCase();
    case 'fecha': return new Date(l.createdAt).getTime();
    default: return '';
  }
};

const renderLeadsModTabla = () => {
  const tbody = document.getElementById('leads-mod-tbody');
  if (!tbody) return;
  let filas = [...leadsMod.data];
  if (leadsMod.ordenCampo) {
    filas.sort((a, b) => {
      const va = valorOrdenableLead(a, leadsMod.ordenCampo);
      const vb = valorOrdenableLead(b, leadsMod.ordenCampo);
      if (va < vb) return leadsMod.ordenAsc ? -1 : 1;
      if (va > vb) return leadsMod.ordenAsc ? 1 : -1;
      return 0;
    });
  }
  if (filas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading">No hay leads con esos filtros.</td></tr>';
    return;
  }
  const badgeTipo = (tipo) => tipo === 'soporte'
    ? `<span class="status-badge" style="background:#eff6ff;color:#1d4ed8">🎧 Soporte</span>`
    : `<span class="status-badge" style="background:#f0fdf4;color:#166534">🏠 Servicio</span>`;
  tbody.innerHTML = filas.map(l => `
    <tr onclick="abrirDrawerLead('${l._id}')">
      <td>${escapeHtml(l.folio || '—')}</td>
      <td>${escapeHtml(l.nombre)}</td>
      <td>${badgeTipo(l.tipo)}</td>
      <td>${escapeHtml(l.servicio || '—')}</td>
      <td>${escapeHtml(l.ciudad || '—')}</td>
      <td><span class="status-badge status-${l.status}">${l.status}</span></td>
      <td>${new Date(l.createdAt).toLocaleDateString('es-MX')}</td>
      <td onclick="event.stopPropagation()">
        <button class="btn btn-outline admin-mini-btn" onclick="abrirDrawerLead('${l._id}')">Ver</button>
      </td>
    </tr>`).join('');
};

const exportarLeadsExcel = async () => {
  try {
    const status = document.getElementById('filtro-leads-status')?.value || '';
    const tipo = document.getElementById('filtro-leads-tipo')?.value || '';
    const search = document.getElementById('search-leads')?.value || '';
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (tipo) params.append('tipo', tipo);
    if (search) params.append('search', search);

    const token = localStorage.getItem('accessToken');
    const res = await fetch(`/api/admin/leads/exportar?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
    if (!res.ok) { const d = await res.json(); dsToast({ title: 'Error', message: d.error || 'No se pudo exportar', type: 'error' }); return; }
    const blob = await res.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `leads-${Date.now()}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    dsToast({ title: 'Exportado', message: 'Excel descargado correctamente.', type: 'success' });
  } catch (e) {
    dsToast({ title: 'Error', message: 'No se pudo generar el Excel', type: 'error' });
  }
};

// ==========================================
// DRAWER LATERAL — MÓDULO "LEADS"
// ==========================================
window.abrirDrawerLead = (id) => {
  const l = leadsMod.data.find(x => x._id === id);
  const content = document.getElementById('drawer-lead-content');
  if (!content || !l) return;

  const badgeTipo = l.tipo === 'soporte'
    ? `<span class="status-badge" style="background:#eff6ff;color:#1d4ed8">🎧 Soporte</span>`
    : `<span class="status-badge" style="background:#f0fdf4;color:#166534">🏠 Servicio</span>`;

  const conversacion = Array.isArray(l.conversacion) && l.conversacion.length > 0
    ? l.conversacion.map(m => `<div style="padding:8px 12px;background:${m.role === 'user' ? '#eff6ff' : '#f8f9fa'};border-radius:8px;margin-bottom:6px;font-size:13px"><b>${m.role === 'user' ? 'Usuario' : 'Bot'}:</b> ${escapeHtml(m.content || m.text || '')}</div>`).join('')
    : '<div style="font-size:13px;color:var(--text-light)">Sin historial de conversación.</div>';

  content.innerHTML = `
    <div style="padding:24px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px">
        <div>
          <h2 style="font-size:20px;font-weight:700;margin-bottom:4px">${escapeHtml(l.nombre)}</h2>
          <div style="font-size:13px;color:var(--text-light)">Folio: ${escapeHtml(l.folio || '—')}</div>
          <div style="display:flex;gap:8px;margin-top:8px">
            ${badgeTipo}
            <span class="status-badge status-${l.status}">${l.status}</span>
          </div>
        </div>
      </div>

      <div style="padding:16px;background:#f8f9fa;border-radius:10px;border:1px solid #e5e7eb;margin-bottom:16px;font-size:13px;line-height:1.9">
        <div><b>Teléfono:</b> ${escapeHtml(l.telefono || '—')}</div>
        <div><b>Email:</b> ${escapeHtml(l.email || '—')}</div>
        <div><b>Servicio:</b> ${escapeHtml(l.servicio || '—')}</div>
        <div><b>Ciudad:</b> ${escapeHtml(l.ciudad || '—')}${l.pais ? ', ' + escapeHtml(l.pais) : ''}</div>
        <div><b>Fecha:</b> ${new Date(l.createdAt).toLocaleString('es-MX')}</div>
        ${l.usuarioRegistrado ? `<div><b>Usuario registrado:</b> ${escapeHtml(l.usuarioRegistrado.nombre)} (${escapeHtml(l.usuarioRegistrado.email)})</div>` : ''}
        ${l.atendidoPor ? `<div><b>Atendido por:</b> ${escapeHtml(l.atendidoPor.nombre)}</div>` : ''}
      </div>

      <div style="margin-bottom:16px">
        <label style="font-size:12px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:0.05em">Historial de conversación</label>
        <div style="margin-top:8px;max-height:220px;overflow-y:auto">${conversacion}</div>
      </div>

      <div class="form-grupo" style="margin-bottom:12px">
        <label>Estado</label>
        <select id="drawer-lead-status" class="form-input">
          <option value="nuevo" ${l.status === 'nuevo' ? 'selected' : ''}>Nuevo</option>
          <option value="contactado" ${l.status === 'contactado' ? 'selected' : ''}>Contactado</option>
          <option value="cerrado" ${l.status === 'cerrado' ? 'selected' : ''}>Cerrado</option>
        </select>
      </div>
      <div class="form-grupo" style="margin-bottom:16px">
        <label>Notas internas</label>
        <textarea id="drawer-lead-notas" class="form-input" rows="3" placeholder="Notas de seguimiento...">${escapeHtml(l.notas || '')}</textarea>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
        <button class="btn btn-outline" style="padding:9px 18px;font-size:13px" onclick="cerrarDrawerLead()">Cerrar</button>
        <button class="btn btn-outline" style="padding:9px 18px;font-size:13px;border-color:#c62828;color:#c62828" onclick="eliminarLeadAdmin('${l._id}')">Eliminar</button>
        <button class="btn btn-primary" style="padding:9px 18px;font-size:13px" onclick="guardarLeadDrawer('${l._id}')">Guardar cambios</button>
      </div>
    </div>`;

  document.getElementById('drawer-lead').classList.add('abierto');
  document.getElementById('drawer-lead-overlay').classList.add('abierto');
};

window.cerrarDrawerLead = () => {
  document.getElementById('drawer-lead').classList.remove('abierto');
  document.getElementById('drawer-lead-overlay').classList.remove('abierto');
};

window.guardarLeadDrawer = async (id) => {
  const status = document.getElementById('drawer-lead-status').value;
  const notas = document.getElementById('drawer-lead-notas').value;
  const data = await api.patch(`/admin/leads/${id}`, { status, notas });
  if (data.ok) {
    dsToast({ title: 'Lead actualizado', message: 'Los cambios se guardaron correctamente.', type: 'success' });
    cerrarDrawerLead();
    cargarLeads();
  } else {
    dsToast({ title: 'No se pudo guardar', message: data.error || 'Intenta de nuevo.', type: 'error' });
  }
};

window.eliminarLeadAdmin = async (id) => {
  const ok = await dsConfirm({ title: '¿Eliminar este lead?', message: 'Esta acción no se puede deshacer.', confirmText: 'Sí, eliminar', danger: true });
  if (!ok) return;
  const data = await api.delete(`/admin/leads/${id}`);
  if (data.ok) {
    dsToast({ title: 'Lead eliminado', message: '', type: 'success' });
    cerrarDrawerLead();
    cargarLeads();
  } else {
    dsToast({ title: 'No se pudo eliminar', message: data.error || 'Intenta de nuevo.', type: 'error' });
  }
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
        <button class="btn btn-outline" style="padding:5px 12px;font-size:12px;border-color:#0369a1;color:#0369a1" onclick="verPropiedadPreview('${p._id}')">👁 Preview</button>
        <button class="btn btn-primary" style="padding:5px 12px;font-size:12px" onclick="aprobarPropiedad('${p._id}')">Aprobar</button>
        <button class="btn btn-outline" style="padding:5px 12px;font-size:12px;border-color:#e65100;color:#e65100" onclick="abrirModalRechazo('${p._id}')">Rechazar</button>
      ` : ''}
      <button class="btn btn-outline" style="padding:5px 12px;font-size:12px;border-color:${p.status === 'bloqueada' ? '#2e7d32' : '#6a1b9a'};color:${p.status === 'bloqueada' ? '#2e7d32' : '#6a1b9a'}" onclick="bloquearPropiedad('${p._id}')">
        ${p.status === 'bloqueada' ? 'Desbloquear' : 'Bloquear'}
      </button>
      <button class="btn btn-outline" style="padding:5px 12px;font-size:12px;border-color:#c62828;color:#c62828" onclick="eliminarPropAdmin('${p._id}', '${p.titulo.replace(/'/g, "\\'")}')">Eliminar</button>
    </div>
  </div>`;

const aprobarPropiedad = async (id) => {
  const data = await api.patch(`/admin/propiedades/${id}/aprobar`);
  if (data.ok) {
    dsToast({ title: 'Propiedad aprobada', message: 'Ya es visible en el catálogo público.', type: 'success' });
    cargarRevision(); cargarDashboard();
  } else if (data.esPropiaPropiedad) {
    dsToast({ title: 'No permitido', message: 'No puedes aprobar tus propias propiedades. Otro administrador debe revisarla.', type: 'error' });
  } else {
    dsToast({ title: 'No se pudo aprobar', message: data.error || 'Intenta de nuevo.', type: 'error' });
  }
};

const abrirModalRechazo = (id) => {
  propiedadArechazar = id;
  document.getElementById('motivo-rechazo').value = '';
  document.getElementById('permite-edicion-rechazo').checked = true;
  document.getElementById('modal-rechazo').style.display = 'flex';
};

const cerrarModal = () => {
  document.getElementById('modal-rechazo').style.display = 'none';
  propiedadArechazar = null;
};

const confirmarRechazo = async () => {
  const motivo = document.getElementById('motivo-rechazo').value.trim();
  const permiteEdicion = document.getElementById('permite-edicion-rechazo').checked;
  if (!motivo) { dsToast({ title: 'Falta el motivo', message: 'Escribe el motivo del rechazo antes de continuar.', type: 'error' }); return; }
  const data = await api.patch(`/admin/propiedades/${propiedadArechazar}/rechazar`, { motivo, permiteEdicion });
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

let usrMod = { data: [], ordenCampo: null, ordenAsc: true };

const cargarUsuarios = async () => {
  const plan = document.getElementById('filtro-plan')?.value || '';
  const status = document.getElementById('filtro-status-user')?.value || '';
  const search = document.getElementById('search-usuarios')?.value || '';

  const params = new URLSearchParams();
  if (plan) params.append('plan', plan);
  if (status) params.append('status', status);
  if (search) params.append('search', search);

  const [dataUsr, dataStats] = await Promise.all([
    api.get(`/admin/usuarios?${params.toString()}`),
    api.get('/admin/usuarios/stats')
  ]);

  renderUsrModKpis(dataStats);
  if (window.adminCharts) {
    window.adminCharts.renderBarTrend(document.getElementById('usr-mod-tendencia'), {
      labels: (dataStats.tendencia || []).map(d => new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short' })),
      series: [{ name: 'Usuarios nuevos', values: (dataStats.tendencia || []).map(d => d.count), color: 'var(--primary)' }]
    });
  }

  usrMod.data = dataUsr.usuarios || [];
  usrMod.ordenCampo = null;
  renderUsrModTabla();

  const updEl = document.getElementById('usr-mod-updated');
  if (updEl) updEl.textContent = `Actualizado ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
};

const renderUsrModKpis = (s) => {
  const el = document.getElementById('usr-mod-kpis');
  if (!el || !s.ok) return;
  const kpis = [
    { num: s.total, label: 'Total' },
    { num: s.gratuito, label: 'Gratuito' },
    { num: s.basico, label: 'Básico' },
    { num: s.premium, label: 'Premium' },
    { num: s.suspendidos, label: 'Suspendidos' }
  ];
  el.innerHTML = kpis.map(k => `<div class="mod-kpi-card"><div class="mod-kpi-num">${k.num}</div><div class="mod-kpi-label">${k.label}</div></div>`).join('');
};

const ordenarUsuarios = (campo) => {
  if (usrMod.ordenCampo === campo) { usrMod.ordenAsc = !usrMod.ordenAsc; }
  else { usrMod.ordenCampo = campo; usrMod.ordenAsc = true; }
  renderUsrModTabla();
};

const valorOrdenableUsr = (u, campo) => {
  switch (campo) {
    case 'nombre': return (u.nombre || '').toLowerCase();
    case 'email': return (u.email || '').toLowerCase();
    case 'plan': return (u.plan || '').toLowerCase();
    case 'status': return (u.status || '').toLowerCase();
    case 'fecha': return new Date(u.createdAt).getTime();
    default: return '';
  }
};

const renderUsrModTabla = () => {
  const tbody = document.getElementById('usr-mod-tbody');
  if (!tbody) return;
  let filas = [...usrMod.data];
  if (usrMod.ordenCampo) {
    filas.sort((a, b) => {
      const va = valorOrdenableUsr(a, usrMod.ordenCampo);
      const vb = valorOrdenableUsr(b, usrMod.ordenCampo);
      if (va < vb) return usrMod.ordenAsc ? -1 : 1;
      if (va > vb) return usrMod.ordenAsc ? 1 : -1;
      return 0;
    });
  }
  if (filas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">No hay usuarios con esos filtros.</td></tr>';
    return;
  }
  tbody.innerHTML = filas.map(u => `
    <tr onclick="abrirDrawerUsuario('${u._id}')">
      <td>${escapeHtml(u.nombre)}</td>
      <td>${escapeHtml(u.email)}</td>
      <td><span class="plan-badge plan-${u.role === 'basico_plus' ? 'ilimitado' : u.plan}">${u.role === 'basico_plus' ? '🎁 ilimitado' : u.plan}</span></td>
      <td><span class="status-badge status-${u.status}">${u.status}</span></td>
      <td>${new Date(u.createdAt).toLocaleDateString('es-MX')}</td>
      <td onclick="event.stopPropagation()">
        <button class="btn btn-outline admin-mini-btn" onclick="abrirDrawerUsuario('${u._id}')">Ver</button>
      </td>
    </tr>`).join('');
};

const exportarUsuariosExcel = async () => {
  try {
    const plan = document.getElementById('filtro-plan')?.value || '';
    const status = document.getElementById('filtro-status-user')?.value || '';
    const search = document.getElementById('search-usuarios')?.value || '';
    const params = new URLSearchParams();
    if (plan) params.append('plan', plan);
    if (status) params.append('status', status);
    if (search) params.append('search', search);

    const token = localStorage.getItem('accessToken');
    const res = await fetch(`/api/admin/usuarios/exportar?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
    if (!res.ok) { const d = await res.json(); dsToast({ title: 'Error', message: d.error || 'No se pudo exportar', type: 'error' }); return; }
    const blob = await res.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `usuarios-${Date.now()}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    dsToast({ title: 'Exportado', message: 'Excel descargado correctamente.', type: 'success' });
  } catch (e) {
    dsToast({ title: 'Error', message: 'No se pudo generar el Excel', type: 'error' });
  }
};

// ==========================================
// DRAWER LATERAL — MÓDULO "USUARIOS"
// ==========================================
const renderKycDrawer = (u) => {
  const kyc = u.kyc || { status: 'pendiente' };
  const colores = {
    pendiente: { bg: '#f8f9fa', border: '#e5e7eb', text: 'var(--text-light)', label: 'Sin verificar' },
    en_revision: { bg: '#fff8e1', border: '#f5d98a', text: '#7a5c00', label: 'En revisión' },
    aprobado: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', label: 'Aprobado' },
    rechazado: { bg: '#fdecea', border: '#f5c2c0', text: '#7a2a27', label: 'Rechazado' }
  };
  const c = colores[kyc.status] || colores.pendiente;

  const documentos = (kyc.status === 'en_revision' || kyc.status === 'aprobado' || kyc.status === 'rechazado') && kyc.ineFrenteUrl
    ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
        <a href="${kyc.ineFrenteUrl}" target="_blank"><img src="${kyc.ineFrenteUrl}" style="width:100%;height:90px;object-fit:cover;border-radius:8px;border:1px solid ${c.border}"></a>
        <a href="${kyc.ineReversoUrl}" target="_blank"><img src="${kyc.ineReversoUrl}" style="width:100%;height:90px;object-fit:cover;border-radius:8px;border:1px solid ${c.border}"></a>
      </div>`
    : '';

  return `
      <div style="padding:16px;background:${c.bg};border:1px solid ${c.border};border-radius:10px;margin-bottom:20px;font-size:13px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b style="color:${c.text}">🪪 Verificación KYC: ${c.label}</b>
        </div>
        ${u.rfc ? `<div style="margin-top:6px;color:${c.text}">RFC: ${escapeHtml(u.rfc)}</div>` : ''}
        ${kyc.status === 'rechazado' && kyc.motivoRechazo ? `<div style="margin-top:6px;color:${c.text}"><b>Motivo:</b> ${escapeHtml(kyc.motivoRechazo)}</div>` : ''}
        ${documentos}
        ${kyc.status === 'en_revision' ? `
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn btn-primary admin-mini-btn" onclick="aprobarKyc('${u._id}')">✓ Aprobar</button>
            <button class="btn btn-outline admin-mini-btn" style="border-color:#c62828;color:#c62828" onclick="rechazarKyc('${u._id}')">Rechazar</button>
          </div>` : ''}
      </div>`;
};

window.aprobarKyc = async (id) => {
  const data = await api.patch(`/admin/usuarios/${id}/kyc`, { aprobado: true });
  if (data.ok) {
    dsToast({ title: 'Verificación aprobada', type: 'success' });
    cerrarDrawerUsuario();
    cargarUsuarios();
  } else {
    dsToast({ title: 'Error', message: data.error || 'No se pudo aprobar', type: 'error' });
  }
};

window.rechazarKyc = (id) => {
  usuarioKycARechazar = id;
  document.getElementById('kyc-rechazo-motivo').value = '';
  document.getElementById('modal-rechazar-kyc').style.display = 'flex';
};

window.confirmarRechazoKyc = async () => {
  const motivo = document.getElementById('kyc-rechazo-motivo').value.trim();
  if (!motivo) { dsToast({ title: 'Falta el motivo', message: 'Escribe por qué se rechaza la verificación.', type: 'error' }); return; }

  const data = await api.patch(`/admin/usuarios/${usuarioKycARechazar}/kyc`, { aprobado: false, motivo });
  if (data.ok) {
    dsToast({ title: 'Verificación rechazada', type: 'success' });
    document.getElementById('modal-rechazar-kyc').style.display = 'none';
    cerrarDrawerUsuario();
    cargarUsuarios();
  } else {
    dsToast({ title: 'Error', message: data.error || 'No se pudo rechazar', type: 'error' });
  }
};

window.abrirDrawerUsuario = (id) => {
  const u = usrMod.data.find(x => x._id === id);
  const content = document.getElementById('drawer-usr-content');
  if (!content || !u) return;

  content.innerHTML = `
    <div style="padding:24px">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
        <div style="width:54px;height:54px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700">${u.nombre.charAt(0).toUpperCase()}</div>
        <div>
          <h2 style="font-size:19px;font-weight:700">${escapeHtml(u.nombre)}</h2>
          <div style="display:flex;gap:8px;margin-top:6px">
            <span class="plan-badge plan-${u.role === 'basico_plus' ? 'ilimitado' : u.plan}">${u.role === 'basico_plus' ? '🎁 ilimitado' : u.plan}</span>
            <span class="status-badge status-${u.status}">${u.status}</span>
            ${u.identidadVerificada ? '<span class="status-badge" style="background:#eff6ff;color:#1d4ed8">✓ Identidad verificada</span>' : ''}
          </div>
        </div>
      </div>

      <div style="padding:16px;background:#f8f9fa;border-radius:10px;border:1px solid #e5e7eb;margin-bottom:20px;font-size:13px;line-height:1.9">
        <div><b>Email:</b> ${escapeHtml(u.email)}</div>
        <div><b>Teléfono:</b> ${escapeHtml(u.telefono || '—')}</div>
        <div><b>Rol:</b> ${escapeHtml(u.role || 'user')}</div>
        <div><b>Registrado:</b> ${new Date(u.createdAt).toLocaleString('es-MX')}</div>
        ${u.planFechaFin ? `<div><b>Plan vence:</b> ${new Date(u.planFechaFin).toLocaleDateString('es-MX')}</div>` : ''}
      </div>

      ${renderKycDrawer(u)}

      <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
        <button class="btn btn-outline" style="padding:9px 18px;font-size:13px" onclick="cerrarDrawerUsuario()">Cerrar</button>
        <button class="btn btn-outline" style="padding:9px 18px;font-size:13px" onclick="seleccionarPlan('${u._id}', '${u.role === 'basico_plus' ? 'ilimitado' : u.plan}')">Cambiar plan</button>
        <button class="btn btn-outline" style="padding:9px 18px;font-size:13px;border-color:${u.status === 'activo' ? '#e65100' : '#2e7d32'};color:${u.status === 'activo' ? '#e65100' : '#2e7d32'}" onclick="cerrarDrawerUsuario();suspenderUsuario('${u._id}')">${u.status === 'activo' ? 'Suspender' : 'Activar'}</button>
        <button class="btn btn-outline" style="padding:9px 18px;font-size:13px;border-color:#dc2626;color:#dc2626" onclick="cerrarDrawerUsuario();abrirModalVetar('${u._id}')">🛡️ Vetar</button>
        <button class="btn btn-outline" style="padding:9px 18px;font-size:13px;border-color:#c62828;color:#c62828" onclick="cerrarDrawerUsuario();eliminarUsuario('${u._id}', '${(u.nombre || '').replace(/'/g, "\\'")}')">Eliminar</button>
      </div>
    </div>`;

  document.getElementById('drawer-usr').classList.add('abierto');
  document.getElementById('drawer-usr-overlay').classList.add('abierto');
};

window.cerrarDrawerUsuario = () => {
  document.getElementById('drawer-usr').classList.remove('abierto');
  document.getElementById('drawer-usr-overlay').classList.remove('abierto');
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
    { valor: 'premium', etiqueta: 'Premium' },
    { valor: 'ilimitado', etiqueta: '🎁 Gratuito Ilimitado (solo admin)' }
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

let destMod = { propiedades: [], destacadasIds: [] };

const cargarDestacadas = async () => {
  const dataProps = await api.get('/admin/propiedades?status=aprobada');
  const dataConf = await api.get('/site/destacadas');
  destMod.destacadasIds = (dataConf.destacadas || []).map(d => d._id);
  destMod.propiedades = dataProps.propiedades || [];

  const kpisEl = document.getElementById('dest-mod-kpis');
  if (kpisEl) {
    const kpis = [
      { num: destMod.destacadasIds.length, label: 'Destacadas actuales' },
      { num: destMod.propiedades.length, label: 'Propiedades aprobadas' },
      { num: Math.max(0, 8 - destMod.destacadasIds.length), label: 'Cupo recomendado restante (máx. 8)' }
    ];
    kpisEl.innerHTML = kpis.map(k => `<div class="mod-kpi-card"><div class="mod-kpi-num">${k.num}</div><div class="mod-kpi-label">${k.label}</div></div>`).join('');
  }

  renderDestModTabla();
};

const renderDestModTabla = () => {
  const tbody = document.getElementById('dest-mod-tbody');
  if (!tbody) return;
  const search = (document.getElementById('dest-search')?.value || '').toLowerCase();
  const filtro = document.getElementById('dest-filtro')?.value || '';

  let filas = destMod.propiedades.filter(p => {
    const esDestacada = destMod.destacadasIds.includes(p._id);
    if (filtro === 'destacadas' && !esDestacada) return false;
    if (filtro === 'no-destacadas' && esDestacada) return false;
    if (search && !p.titulo?.toLowerCase().includes(search) && !p.ubicacion?.ciudad?.toLowerCase().includes(search)) return false;
    return true;
  });

  if (filas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading">No hay propiedades aprobadas con esos filtros.</td></tr>';
    return;
  }

  tbody.innerHTML = filas.map(p => {
    const esDestacada = destMod.destacadasIds.includes(p._id);
    const foto = p.fotos && p.fotos.length > 0
      ? `<img src="${p.fotos[0]}" style="width:44px;height:44px;object-fit:cover;border-radius:8px">`
      : `<div style="width:44px;height:44px;background:#f3f4f6;border-radius:8px"></div>`;
    return `
    <tr>
      <td>${foto}</td>
      <td>${escapeHtml(p.titulo || 'Sin título')}</td>
      <td>${escapeHtml(p.ubicacion?.ciudad || '—')}</td>
      <td>${formatPrecio(p.precio)}</td>
      <td><span class="plan-badge plan-${p.propietario?.plan || 'gratuito'}">${p.propietario?.plan || 'gratuito'}</span></td>
      <td><span class="status-badge ${esDestacada ? 'status-aprobada' : 'status-revision'}">${esDestacada ? '⭐ Destacada' : 'Normal'}</span></td>
      <td>
        <button class="btn ${esDestacada ? 'btn-outline' : 'btn-primary'} admin-mini-btn" onclick="toggleDestacada('${p._id}', ${esDestacada})">
          ${esDestacada ? 'Quitar' : '⭐ Destacar'}
        </button>
      </td>
    </tr>`;
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
        <button class="btn btn-outline" style="padding:5px 12px;font-size:12px;border-color:#c62828;color:#c62828" onclick="eliminarTemaPersonalizado('${t._id}', '${t.nombre.replace(/'/g, "\\'")}')">Eliminar</button>
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
  document.getElementById('cp-accent').value = tema.accent;
  document.getElementById('cp-accent-hex').value = tema.accent;
  document.getElementById('cp-accentDark').value = tema.accentDark;
  document.getElementById('cp-bgDark').value = tema.bgDark;
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

// ========== IMPORTAR USUARIOS MEJORADO ==========
let archivoSeleccionado = null;
let datosPreview = [];

const mostrarModalImportar = () => {
  document.getElementById('modal-importar').style.display = 'flex';
  archivoSeleccionado = null;
  datosPreview = [];
  document.getElementById('archivo-seleccionado').textContent = '📁 Haz clic para seleccionar archivo';
  document.getElementById('importar-preview').style.display = 'none';
  document.getElementById('importar-preview').innerHTML = '';
  document.getElementById('importar-resultado').style.display = 'none';
  document.getElementById('importar-resultado').innerHTML = '';
  document.getElementById('btn-importar').disabled = true;
  document.getElementById('btn-importar').style.opacity = '0.5';
  document.getElementById('importar-file-input').value = '';
  document.getElementById('importar-plan').value = '';
  document.getElementById('importar-forzar-duplicados').checked = true;
};

const cerrarModalImportar = () => {
  document.getElementById('modal-importar').style.display = 'none';
  archivoSeleccionado = null;
  datosPreview = [];
};

const seleccionarArchivoImportar = async (input) => {
  const file = input.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx', 'csv'].includes(ext)) {
    dsToast({ title: 'Formato no válido', message: 'Solo se aceptan archivos Excel (.xlsx) o CSV.', type: 'error' });
    input.value = '';
    return;
  }
  archivoSeleccionado = file;
  document.getElementById('archivo-seleccionado').textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  await parsearVistaPrevia(file);
};

const parsearVistaPrevia = async (file) => {
  const previewDiv = document.getElementById('importar-preview');
  previewDiv.style.display = 'block';
  previewDiv.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-light)"><div style="font-size:24px;margin-bottom:8px">⏳</div>Analizando archivo...</div>';
  document.getElementById('importar-resultado').style.display = 'none';
  try {
    let filas = [];
    if (file.name.endsWith('.csv')) {
      const texto = await file.text();
      const lineas = texto.split('\n').map(l => l.trim()).filter(l => l);
      if (lineas.length < 2) {
        previewDiv.innerHTML = '<div style="padding:20px;text-align:center;color:#c62828;font-weight:600">El archivo está vacío o no tiene datos</div>';
        return;
      }
      const encabezados = lineas[0].split(',').map(h => h.trim().toLowerCase());
      for (let i = 1; i < lineas.length; i++) {
        const valores = lineas[i].split(',').map(v => v.trim());
        const fila = {};
        encabezados.forEach((h, idx) => { fila[h] = valores[idx] || ''; });
        filas.push(fila);
      }
    } else {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      filas = XLSX.utils.sheet_to_json(sheet);
    }
    datosPreview = filas;
    renderTablaPreview(filas);
    const btn = document.getElementById('btn-importar');
    btn.disabled = false;
    btn.style.opacity = '1';
  } catch (error) {
    previewDiv.innerHTML = `<div style="padding:20px;text-align:center;color:#c62828"><div style="font-size:24px;margin-bottom:8px">❌</div>Error al leer archivo: ${error.message}</div>`;
  }
};

const renderTablaPreview = (filas) => {
  const previewDiv = document.getElementById('importar-preview');
  if (!filas.length) {
    previewDiv.innerHTML = '<div style="padding:20px;text-align:center;color:#c62828;font-weight:600">No se encontraron registros en el archivo</div>';
    return;
  }
  const emailsVistos = {};
  let duplicadosInternos = 0;
  filas.forEach(f => {
    const email = (f.email || f.correo || f.Email || f.Correo || '').toString().trim().toLowerCase();
    if (email && emailsVistos[email]) { duplicadosInternos++; emailsVistos[email]++; }
    else if (email) { emailsVistos[email] = 1; }
  });
  let erroresCount = 0;
  filas.forEach(f => {
    const email = (f.email || f.correo || f.Email || f.Correo || '').toString().trim().toLowerCase();
    const nombre = (f.nombre || f.Nombre || '').toString().trim();
    if (!email || !email.includes('@') || !nombre) erroresCount++;
  });
  let html = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
      <div style="padding:8px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:12px;font-weight:600;color:#166534">📊 ${filas.length} registros</div>
      ${erroresCount > 0 ? `<div style="padding:8px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:12px;font-weight:600;color:#991b1b">⚠️ ${erroresCount} con datos faltantes</div>` : '<div style="padding:8px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:12px;font-weight:600;color:#166534">✅ Sin errores obvios</div>'}
      ${duplicadosInternos > 0 ? `<div style="padding:8px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;font-weight:600;color:#92400e">🔄 ${duplicadosInternos} emails duplicados en el archivo</div>` : ''}
    </div>
    <div style="overflow-x:auto;max-height:280px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:12px">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead style="position:sticky;top:0;z-index:2"><tr style="background:#f8fafc">
          <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;font-weight:700;color:#475569;font-size:11px;text-transform:uppercase">#</th>
          <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;font-weight:700;color:#475569;font-size:11px;text-transform:uppercase">Nombre</th>
          <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;font-weight:700;color:#475569;font-size:11px;text-transform:uppercase">Email</th>
          <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;font-weight:700;color:#475569;font-size:11px;text-transform:uppercase">Teléfono</th>
          <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;font-weight:700;color:#475569;font-size:11px;text-transform:uppercase">Plan</th>
          <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #e2e8f0;font-weight:700;color:#475569;font-size:11px;text-transform:uppercase">Estado</th>
        </tr></thead><tbody>`;
  filas.forEach((fila, i) => {
    const nombre = (fila.nombre || fila.Nombre || '').toString().trim();
    const email = (fila.email || fila.correo || fila.Email || fila.Correo || '').toString().trim().toLowerCase();
    const telefono = (fila.telefono || fila.Telefono || '').toString().trim();
    const plan = (fila.plan || fila.Plan || 'gratuito').toString().toLowerCase().trim();
    const sinNombre = !nombre;
    const sinEmail = !email || !email.includes('@');
    const esDuplicado = emailsVistos[email] > 1;
    let bg = '';
    let statusHtml = '<span style="color:#16a34a;font-weight:700">✓ OK</span>';
    if (sinNombre && sinEmail) { bg = '#fef2f2'; statusHtml = '<span style="color:#991b1b;font-weight:700">❌ Sin nombre ni email</span>'; }
    else if (sinNombre) { bg = '#fffbeb'; statusHtml = '<span style="color:#92400e;font-weight:600">⚠️ Sin nombre</span>'; }
    else if (sinEmail) { bg = '#fef2f2'; statusHtml = '<span style="color:#991b1b;font-weight:700">❌ Sin email</span>'; }
    else if (esDuplicado) { bg = '#fffbeb'; statusHtml = '<span style="color:#92400e;font-weight:600">🔄 Duplicado</span>'; }
    const planForzado = document.getElementById('importar-plan')?.value;
    const planMostrar = planForzado ? planForzado : plan;
    const planBadge = planMostrar === 'premium' ? `<span style="padding:2px 8px;background:#fef3c7;color:#92400e;border-radius:6px;font-weight:600;font-size:11px">${planMostrar}</span>` : planMostrar === 'basico' ? `<span style="padding:2px 8px;background:#eff6ff;color:#1d4ed8;border-radius:6px;font-weight:600;font-size:11px">${planMostrar}</span>` : `<span style="padding:2px 8px;background:#f1f5f9;color:#475569;border-radius:6px;font-weight:600;font-size:11px">${planMostrar}</span>`;
    html += `<tr style="background:${bg};${i % 2 === 0 && !bg ? 'background:#fafbfc' : ''}">
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#94a3b8">${i + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-weight:500">${escapeHtml(nombre) || '<span style="color:#c62828;font-style:italic">— faltante —</span>'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-size:11px">${escapeHtml(email) || '<span style="color:#c62828;font-style:italic">— faltante —</span>'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b">${escapeHtml(telefono) || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${planBadge}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${statusHtml}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  previewDiv.innerHTML = html;
};

document.addEventListener('DOMContentLoaded', () => {
  const planSelect = document.getElementById('importar-plan');
  if (planSelect) {
    planSelect.addEventListener('change', () => {
      if (datosPreview.length > 0) renderTablaPreview(datosPreview);
    });
  }
});

const importarUsuarios = async () => {
  if (!archivoSeleccionado) { dsToast({ title: 'Falta el archivo', message: 'Selecciona un archivo primero.', type: 'error' }); return; }
  const btn = document.getElementById('btn-importar');
  btn.disabled = true;
  btn.textContent = '⏳ Importando...';
  btn.style.opacity = '0.5';
  const formData = new FormData();
  formData.append('archivo', archivoSeleccionado);
  formData.append('planForzar', document.getElementById('importar-plan')?.value || '');
  formData.append('forzarDuplicados', document.getElementById('importar-forzar-duplicados')?.checked ? 'true' : 'false');
  try {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_URL}/api/admin/usuarios/masivo`, {
      method: 'POST',
      headers: { 'Authorization': token ? `Bearer ${token}` : '' },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) console.error('❌ ERROR:', data);
    const resultadoDiv = document.getElementById('importar-resultado');
    resultadoDiv.style.display = 'block';
    if (data.ok) {
      const r = data.resultado;
      let html = `<div style="margin-bottom:12px;font-weight:700;color:#166534;font-size:15px">✓ Importación completada</div>
        <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
          <div style="padding:8px 14px;background:#dcfce7;border-radius:8px;font-weight:700;color:#166534">Total: ${r.totalProcesados}</div>
          <div style="padding:8px 14px;background:#bbf7d0;border-radius:8px;font-weight:700;color:#166534">Creados: ${r.totalCreados}</div>
          <div style="padding:8px 14px;background:${r.totalErrores > 0 ? '#fecaca' : '#dcfce7'};border-radius:8px;font-weight:700;color:${r.totalErrores > 0 ? '#991b1b' : '#166534'}">Errores: ${r.totalErrores}</div>
        </div>`;
      if (r.exito && r.exito.length > 0) {
        html += `<div style="margin-bottom:12px;font-weight:600;color:#0f172a;font-size:13px">🔑 Credenciales de los usuarios creados:</div>
          <div style="overflow-x:auto;max-height:200px;overflow-y:auto;border:1px solid #bbf7d0;border-radius:10px;margin-bottom:12px">
            <table style="width:100%;border-collapse:collapse;font-size:11px">
              <thead style="position:sticky;top:0;background:#f0fdf4;z-index:1"><tr>
                <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #bbf7d0;font-weight:600">Nombre</th>
                <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #bbf7d0;font-weight:600">Email</th>
                <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #bbf7d0;font-weight:600">Contraseña</th>
                <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #bbf7d0;font-weight:600">Plan</th>
              </tr></thead><tbody>
                ${r.exito.map(u => `<tr style="background:white">
                  <td style="padding:5px 10px;border-bottom:1px solid #f0fdf4;font-weight:500">${escapeHtml(u.nombre)}</td>
                  <td style="padding:5px 10px;border-bottom:1px solid #f0fdf4;font-family:monospace">${escapeHtml(u.email)}</td>
                  <td style="padding:5px 10px;border-bottom:1px solid #f0fdf4;font-family:monospace;font-weight:700;color:#1a472a;background:#f0fdf4;border-radius:4px;display:inline-block;margin:2px 0">${u.passwordTemporal}</td>
                  <td style="padding:5px 10px;border-bottom:1px solid #f0fdf4">${escapeHtml(u.plan)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <button onclick="copiarCredenciales()" style="padding:6px 14px;border:1px solid #bbf7d0;border-radius:8px;background:white;font-size:12px;font-weight:600;cursor:pointer;color:#166534;margin-bottom:12px">📋 Copiar credenciales</button>`;
      }
      if (r.errores && r.errores.length > 0) {
        html += `<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:600;color:#991b1b;font-size:13px">⚠️ Ver ${r.errores.length} error(es)</summary>
          <div style="margin-top:8px;padding:10px;background:#fef2f2;border-radius:8px;font-size:12px">${r.errores.map(e => `Fila ${e.fila}: ${e.email} — ${e.error}`).join('<br>')}</div></details>`;
      }
      resultadoDiv.style.background = '#f0fdf4';
      resultadoDiv.style.color = '#166534';
      resultadoDiv.style.border = '1px solid #bbf7d0';
      resultadoDiv.innerHTML = html;
      window._ultimasCredenciales = r.exito || [];
      cargarUsuarios();
    } else {
      resultadoDiv.style.background = '#fef2f2';
      resultadoDiv.style.color = '#991b1b';
      resultadoDiv.style.border = '1px solid #fecaca';
      resultadoDiv.innerHTML = `<strong>Error:</strong> ${data.error || JSON.stringify(data)}`;
    }
  } catch (error) {
    console.error('❌ Error de conexión:', error);
    const resultadoDiv = document.getElementById('importar-resultado');
    resultadoDiv.style.display = 'block';
    resultadoDiv.style.background = '#fef2f2';
    resultadoDiv.style.color = '#991b1b';
    resultadoDiv.style.border = '1px solid #fecaca';
    resultadoDiv.innerHTML = `<strong>Error de conexión:</strong> ${error.message}`;
  }
  btn.disabled = false;
  btn.textContent = '⬆️ Importar usuarios';
  btn.style.opacity = '1';
};

const copiarCredenciales = () => {
  if (!window._ultimasCredenciales?.length) return;
  const texto = window._ultimasCredenciales.map(u => `Nombre: ${u.nombre}\nEmail: ${u.email}\nContraseña: ${u.passwordTemporal}\nPlan: ${u.plan}\n---`).join('\n');
  navigator.clipboard.writeText(texto).then(() => {
    dsToast({ title: 'Copiado', message: 'Credenciales copiadas al portapapeles.', type: 'success' });
  }).catch(() => {
    dsToast({ title: 'Error', message: 'No se pudo copiar.', type: 'error' });
  });
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
let pagoModData = [];
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

    const [data, dataStats] = await Promise.all([
      api.get(`/admin/pagos?${params.toString()}`),
      api.get('/admin/pagos/stats')
    ]);

    renderPagoModKpis(dataStats);
    if (window.adminCharts) {
      window.adminCharts.renderBarTrend(document.getElementById('pago-mod-tendencia'), {
        labels: (dataStats.tendencia || []).map(d => new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short' })),
        series: [{ name: 'Ingresos por día (MXN)', values: (dataStats.tendencia || []).map(d => d.count), color: 'var(--primary)' }]
      });
    }

    const updEl = document.getElementById('pago-mod-updated');
    if (updEl) updEl.textContent = `Actualizado ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;

    pagoModData = data.pagos || [];
    if (!data.ok || !data.pagos || !data.pagos.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--text-light)">No se encontraron pagos.</td></tr>';
      return;
    }
    tbody.innerHTML = data.pagos.map(p => {
      const fecha = new Date(p.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
      return `<tr onclick="abrirDrawerPago('${p._id}')" style="cursor:pointer">
        <td>${fecha}</td>
        <td><div style="font-weight:600">${p.usuario_email || 'N/A'}</div><div style="font-size:11px;color:var(--text-light)">ID: ${p.stripe_session_id?.substring(0, 15)}...</div></td>
        <td style="text-transform:capitalize">${p.plan_contratado}</td>
        <td style="font-weight:700">$${p.monto} MXN</td>
        <td><span class="badge-estatus badge-${p.estatus}">${p.estatus}</span></td>
        <td onclick="event.stopPropagation()"><div style="display:flex;gap:6px;">
          <button class="btn btn-outline" style="padding:4px 10px;font-size:11px" onclick="window.open('https://dashboard.stripe.com/payments/${p.stripe_session_id}', '_blank')">🔍 Stripe</button>
          <button class="btn btn-outline" style="padding:4px 10px;font-size:11px" onclick="abrirDrawerPago('${p._id}')">Ver</button>
        </div></td>
      </tr>`;
    }).join('');
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding:40px;text-align:center;color:#c62828">Error al conectar con el servidor.</td></tr>';
  }
};

const renderPagoModKpis = (s) => {
  const el = document.getElementById('pago-mod-kpis');
  if (!el || !s.ok) return;
  const kpis = [
    { num: `$${(s.ingresosMes || 0).toLocaleString('es-MX')}`, label: 'Ingresos (30d)' },
    { num: s.completados, label: 'Completados' },
    { num: s.pendientes, label: 'Pendientes' },
    { num: s.reembolsados, label: 'Reembolsados' }
  ];
  el.innerHTML = kpis.map(k => `<div class="mod-kpi-card"><div class="mod-kpi-num" style="font-size:20px">${k.num}</div><div class="mod-kpi-label">${k.label}</div></div>`).join('');
};

const exportarPagosExcel = async () => {
  try {
    const search = document.getElementById('pago-filtro-search')?.value || '';
    const plan = document.getElementById('pago-filtro-plan')?.value || '';
    const estatus = document.getElementById('pago-filtro-estatus')?.value || '';
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (plan) params.append('plan', plan);
    if (estatus) params.append('estatus', estatus);

    const token = localStorage.getItem('accessToken');
    const res = await fetch(`/api/admin/pagos/exportar?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
    if (!res.ok) { const d = await res.json(); dsToast({ title: 'Error', message: d.error || 'No se pudo exportar', type: 'error' }); return; }
    const blob = await res.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `pagos-${Date.now()}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    dsToast({ title: 'Exportado', message: 'Excel descargado correctamente.', type: 'success' });
  } catch (e) {
    dsToast({ title: 'Error', message: 'No se pudo generar el Excel', type: 'error' });
  }
};

window.abrirDrawerPago = (id) => {
  const p = pagoModData.find(x => x._id === id);
  if (!p) return;
  renderDrawerPago(p);
  document.getElementById('drawer-pago').classList.add('abierto');
  document.getElementById('drawer-pago-overlay').classList.add('abierto');
};

window.cerrarDrawerPago = () => {
  document.getElementById('drawer-pago')?.classList.remove('abierto');
  document.getElementById('drawer-pago-overlay')?.classList.remove('abierto');
};

const renderDrawerPago = (p) => {
  const content = document.getElementById('drawer-pago-content');
  if (!content) return;
  const fecha = new Date(p.fecha || p.createdAt).toLocaleString('es-MX');
  content.innerHTML = `
    <div style="padding:24px">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
        <div style="width:54px;height:54px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700">${(p.usuario_email || '?')[0].toUpperCase()}</div>
        <div>
          <h2 style="font-size:19px;font-weight:700">${escapeHtml(p.usuario_email || 'N/A')}</h2>
          <div style="font-size:13px;color:var(--text-light)">${fecha}</div>
          <span class="badge-estatus badge-${p.estatus}" style="margin-top:6px;display:inline-block">${p.estatus}</span>
        </div>
      </div>

      <div style="padding:16px;background:#f8f9fa;border-radius:10px;border:1px solid #e5e7eb;margin-bottom:20px;font-size:13px;line-height:1.8">
        <div><b>Plan:</b> <span style="text-transform:capitalize">${escapeHtml(p.plan_contratado || '—')}</span></div>
        <div><b>Monto:</b> $${p.monto} MXN</div>
        <div><b>Stripe Session ID:</b> ${escapeHtml(p.stripe_session_id || '—')}</div>
        <button class="btn btn-outline admin-mini-btn" style="margin-top:8px" onclick="window.open('https://dashboard.stripe.com/payments/${p.stripe_session_id}', '_blank')">🔍 Ver en Stripe</button>
      </div>

      <div style="margin-bottom:20px">
        <label style="font-size:12px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:0.05em">Cambiar estado</label>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
          ${['completado', 'pendiente', 'reembolsado'].map(e => `<button class="btn ${p.estatus === e ? 'btn-primary' : 'btn-outline'}" style="padding:6px 14px;font-size:12px;text-transform:capitalize" onclick="cambiarEstatusPago('${p._id}','${e}')">${e}</button>`).join('')}
        </div>
      </div>

      <div style="margin-bottom:20px">
        <label style="font-size:12px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:0.05em">Nota de conciliación</label>
        <textarea id="drawer-pago-nota" class="form-input" rows="4" style="margin-top:8px" placeholder="Agregar nota de conciliación...">${escapeHtml(p.notas_admin || '')}</textarea>
        <button class="btn btn-primary" style="margin-top:8px" onclick="guardarNotaPago('${p._id}')">Guardar nota</button>
      </div>

      <div style="display:flex;justify-content:flex-end">
        <button class="btn btn-outline" style="padding:9px 18px;font-size:13px" onclick="cerrarDrawerPago()">Cerrar</button>
      </div>
    </div>`;
};

window.cambiarEstatusPago = async (id, estatus) => {
  try {
    const data = await api.patch(`/admin/pagos/${id}`, { estatus });
    if (data.ok) {
      dsToast({ title: 'Actualizado', message: `Estado cambiado a ${estatus}.`, type: 'success' });
      const p = pagoModData.find(x => x._id === id);
      if (p) p.estatus = estatus;
      renderDrawerPago(p);
      cargarPagosAdmin();
    } else {
      dsToast({ title: 'Error', message: data.error || 'No se pudo actualizar.', type: 'error' });
    }
  } catch (e) {
    dsToast({ title: 'Error', message: 'No se pudo actualizar.', type: 'error' });
  }
};

window.guardarNotaPago = async (id) => {
  const texto = document.getElementById('drawer-pago-nota')?.value || '';
  try {
    const data = await api.patch(`/admin/pagos/${id}`, { notas_admin: texto });
    if (data.ok) {
      dsToast({ title: 'Guardado', message: 'Nota agregada al pago.', type: 'success' });
      const p = pagoModData.find(x => x._id === id);
      if (p) p.notas_admin = texto;
    } else {
      dsToast({ title: 'Error', message: data.error || 'No se pudo guardar.', type: 'error' });
    }
  } catch (e) {
    dsToast({ title: 'Error', message: 'No se pudo guardar.', type: 'error' });
  }
};

// ==========================================
// VISTA PREVIA DE PROPIEDAD
// ==========================================
const construirDetallePropiedad = (p, botonesHtml) => {
  const fotos = p.fotos && p.fotos.length > 0
    ? p.fotos.map((f, i) => `<div style="width:100%;height:300px;border-radius:12px;overflow:hidden;position:relative"><img src="${f}" style="width:100%;height:100%;object-fit:cover"><div style="position:absolute;bottom:10px;left:10px;background:rgba(0,0,0,0.6);color:white;padding:3px 10px;border-radius:20px;font-size:12px">${i+1}/${p.fotos.length}</div></div>`).join('')
    : '<div style="width:100%;height:300px;background:#f3f4f6;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:14px">Sin fotografías</div>';
  const propietario = p.propietario;
  const ubicacion = p.ubicacion || {};
  return `
    <div style="position:relative">
      <div id="preview-fotos-container" style="position:relative">${fotos}</div>
      ${p.fotos?.length > 1 ? `<div style="display:flex;justify-content:center;gap:6px;padding:12px 0"><button onclick="previewFoto(-1)" style="padding:8px 14px;background:#f1f5f9;border:none;border-radius:8px;cursor:pointer">←</button><button onclick="previewFoto(1)" style="padding:8px 14px;background:#f1f5f9;border:none;border-radius:8px;cursor:pointer">→</button></div>` : ''}
    </div>
    <div style="padding:24px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px">
        <div>
          <h2 style="font-size:22px;font-weight:700;margin-bottom:4px">${escapeHtml(p.titulo || 'Sin título')}</h2>
          <div style="font-size:14px;color:var(--text-light)">📍 ${escapeHtml(ubicacion.ciudad || '')}, ${escapeHtml(ubicacion.estado || '')}</div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <span class="status-badge status-${p.status}">${p.status}</span>
            <span class="status-badge" style="background:#eff6ff;color:#1d4ed8">${p.operacion}</span>
            <span class="status-badge" style="background:#f0fdf4;color:#166534">${p.tipo}</span>
          </div>
        </div>
        <div style="text-align:right"><div style="font-size:24px;font-weight:800;color:var(--primary)">${formatPrecio(p.precio)}</div></div>
      </div>
      ${p.motivo_rechazo ? `<div style="margin-bottom:16px;padding:12px 14px;background:#fdecea;border:1px solid #f5c2c0;border-radius:10px;font-size:13px;color:#7a2a27"><b>Motivo de rechazo:</b> ${escapeHtml(p.motivo_rechazo)}</div>` : ''}
      ${p.descripcion ? `<div style="margin-bottom:20px;padding:16px;background:#f8f9fa;border-radius:10px;font-size:14px;line-height:1.7;color:#374151;white-space:pre-wrap">${escapeHtml(p.descripcion)}</div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;margin-bottom:20px">
        ${p.caracteristicas?.recamaras ? `<div style="text-align:center;padding:12px;background:#f0fdf4;border-radius:10px"><div style="font-size:20px">🛏️</div><div style="font-size:13px;font-weight:600">${p.caracteristicas.recamaras}</div><div style="font-size:11px;color:var(--text-light)">Recámaras</div></div>` : ''}
        ${p.caracteristicas?.banos ? `<div style="text-align:center;padding:12px;background:#eff6ff;border-radius:10px"><div style="font-size:20px">🚿</div><div style="font-size:13px;font-weight:600">${p.caracteristicas.banos}</div><div style="font-size:11px;color:var(--text-light)">Baños</div></div>` : ''}
        ${p.caracteristicas?.m2 ? `<div style="text-align:center;padding:12px;background:#fef3c7;border-radius:10px"><div style="font-size:20px">📐</div><div style="font-size:13px;font-weight:600">${p.caracteristicas.m2} m²</div><div style="font-size:11px;color:var(--text-light)">Construcción</div></div>` : ''}
        ${p.caracteristicas?.estacionamientos ? `<div style="text-align:center;padding:12px;background:#f0fdf4;border-radius:10px"><div style="font-size:20px">🚗</div><div style="font-size:13px;font-weight:600">${p.caracteristicas.estacionamientos}</div><div style="font-size:11px;color:var(--text-light)">Estaciona.</div></div>` : ''}
      </div>
      <div style="padding:16px;background:#f8f9fa;border-radius:10px;border:1px solid #e5e7eb">
        <div style="font-size:12px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px">Propietario</div>
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:44px;height:44px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700">${(propietario?.nombre || '?')[0].toUpperCase()}</div>
          <div>
            <div style="font-size:15px;font-weight:600">${escapeHtml(propietario?.nombre || 'Desconocido')}</div>
            <div style="font-size:13px;color:var(--text-light)">${escapeHtml(propietario?.email || '')}${propietario?.telefono ? ' · ' + propietario.telefono : ''}</div>
            <div style="display:flex;gap:6px;margin-top:4px">
              <span class="plan-badge plan-${propietario?.plan || 'gratuito'}">${propietario?.plan || 'gratuito'}</span>
              <span class="status-badge status-${propietario?.status || 'activo'}">${propietario?.status || 'activo'}</span>
              ${propietario?.identidadVerificada ? '<span class="status-badge" style="background:#eff6ff;color:#1d4ed8">✓ Identidad verificada</span>' : ''}
            </div>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end;flex-wrap:wrap">${botonesHtml}</div>
    </div>`;
};

window.verPropiedadPreview = async (id) => {
  const content = document.getElementById('preview-prop-content');
  if (!content) return;
  content.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-light)">Cargando...</div>';
  document.getElementById('modal-preview-prop').style.display = 'flex';
  try {
    const data = await api.get(`/admin/propiedades/${id}/preview`);
    if (!data.ok) { content.innerHTML = '<div style="padding:40px;text-align:center;color:#c62828">Error al cargar</div>'; return; }
    const p = data.propiedad;
    const botones = `
      <button class="btn btn-outline" style="padding:10px 20px;font-size:13px" onclick="document.getElementById('modal-preview-prop').style.display='none'">Cerrar</button>
      <button class="btn btn-primary" style="padding:10px 20px;font-size:13px" onclick="document.getElementById('modal-preview-prop').style.display='none';aprobarPropiedad('${p._id}')">✅ Aprobar</button>`;
    content.innerHTML = construirDetallePropiedad(p, botones);
    window.previewFotoIdx = 0;
  } catch (e) {
    content.innerHTML = '<div style="padding:40px;text-align:center;color:#c62828">Error de conexión</div>';
  }
};

// ==========================================
// DRAWER LATERAL — MÓDULO "TODAS LAS PROPIEDADES"
// ==========================================
window.abrirDrawerPropiedad = async (id) => {
  const content = document.getElementById('drawer-prop-content');
  if (!content) return;
  content.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-light)">Cargando...</div>';
  document.getElementById('drawer-prop').classList.add('abierto');
  document.getElementById('drawer-prop-overlay').classList.add('abierto');
  try {
    const data = await api.get(`/admin/propiedades/${id}/preview`);
    if (!data.ok) { content.innerHTML = '<div style="padding:40px;text-align:center;color:#c62828">Error al cargar</div>'; return; }
    const p = data.propiedad;
    const botones = [
      `<button class="btn btn-outline" style="padding:9px 18px;font-size:13px" onclick="cerrarDrawerPropiedad()">Cerrar</button>`
    ];
    if (p.status === 'revision') {
      botones.push(`<button class="btn btn-outline" style="padding:9px 18px;font-size:13px;border-color:#e65100;color:#e65100" onclick="cerrarDrawerPropiedad();abrirModalRechazo('${p._id}')">Rechazar</button>`);
      botones.push(`<button class="btn btn-primary" style="padding:9px 18px;font-size:13px" onclick="cerrarDrawerPropiedad();aprobarPropiedad('${p._id}')">✅ Aprobar</button>`);
    }
    botones.push(`<button class="btn btn-outline" style="padding:9px 18px;font-size:13px;border-color:${p.status === 'bloqueada' ? '#2e7d32' : '#6a1b9a'};color:${p.status === 'bloqueada' ? '#2e7d32' : '#6a1b9a'}" onclick="cerrarDrawerPropiedad();bloquearPropiedad('${p._id}')">${p.status === 'bloqueada' ? 'Desbloquear' : 'Bloquear'}</button>`);
    botones.push(`<button class="btn btn-outline" style="padding:9px 18px;font-size:13px;border-color:#c62828;color:#c62828" onclick="cerrarDrawerPropiedad();eliminarPropAdmin('${p._id}', '${(p.titulo || '').replace(/'/g, "\\'")}')">Eliminar</button>`);
    content.innerHTML = construirDetallePropiedad(p, botones.join(''));
    window.previewFotoIdx = 0;
  } catch (e) {
    content.innerHTML = '<div style="padding:40px;text-align:center;color:#c62828">Error de conexión</div>';
  }
};

window.cerrarDrawerPropiedad = () => {
  document.getElementById('drawer-prop').classList.remove('abierto');
  document.getElementById('drawer-prop-overlay').classList.remove('abierto');
};

window.previewFotoIdx = 0;
window.previewFoto = (dir) => {
  const contenedor = document.getElementById('preview-fotos-container');
  if (!contenedor) return;
  const slides = contenedor.children;
  if (slides.length <= 1) return;
  window.previewFotoIdx = (window.previewFotoIdx + dir + slides.length) % slides.length;
  Array.from(slides).forEach((s, i) => s.style.display = i === window.previewFotoIdx ? 'block' : 'none');
};

// ==========================================
// USUARIOS VETADOS
// ==========================================
let vetMod = { data: [], ordenCampo: null, ordenAsc: true };

const cargarVetados = async () => {
  const search = document.getElementById('vetado-search')?.value || '';
  const activo = document.getElementById('vetado-filtro')?.value || '';
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (activo) params.append('activo', activo);

  const [dataVet, dataStats] = await Promise.all([
    api.get(`/admin/vetados?${params.toString()}`),
    api.get('/admin/vetados/stats')
  ]);

  renderVetModKpis(dataStats);
  if (window.adminCharts) {
    window.adminCharts.renderBarTrend(document.getElementById('vet-mod-tendencia'), {
      labels: (dataStats.tendencia || []).map(d => new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short' })),
      series: [{ name: 'Vetados nuevos', values: (dataStats.tendencia || []).map(d => d.count), color: 'var(--primary)' }]
    });
  }

  vetMod.data = dataVet.vetados || [];
  vetMod.ordenCampo = null;
  renderVetModTabla();

  const updEl = document.getElementById('vet-mod-updated');
  if (updEl) updEl.textContent = `Actualizado ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
};

const renderVetModKpis = (s) => {
  const el = document.getElementById('vet-mod-kpis');
  if (!el || !s.ok) return;
  const kpis = [
    { num: s.total, label: 'Total' },
    { num: s.activos, label: 'Activos' },
    { num: s.desactivados, label: 'Desactivados' },
    { num: s.conAlias, label: 'Con alias vinculado' },
    { num: s.nuevosMes, label: 'Nuevos (30d)' }
  ];
  el.innerHTML = kpis.map(k => `<div class="mod-kpi-card"><div class="mod-kpi-num">${k.num}</div><div class="mod-kpi-label">${k.label}</div></div>`).join('');
};

const ordenarVetados = (campo) => {
  if (vetMod.ordenCampo === campo) { vetMod.ordenAsc = !vetMod.ordenAsc; }
  else { vetMod.ordenCampo = campo; vetMod.ordenAsc = true; }
  renderVetModTabla();
};

const valorOrdenableVet = (v, campo) => {
  switch (campo) {
    case 'usuario': return (v.usuario?.nombre || '').toLowerCase();
    case 'razon': return (v.razon || '').toLowerCase();
    case 'aliases': return (v.aliases || []).length;
    case 'status': return v.activo ? 1 : 0;
    case 'fecha': return new Date(v.createdAt).getTime();
    default: return '';
  }
};

const renderVetModTabla = () => {
  const tbody = document.getElementById('vet-mod-tbody');
  if (!tbody) return;
  let filas = [...vetMod.data];
  if (vetMod.ordenCampo) {
    filas.sort((a, b) => {
      const va = valorOrdenableVet(a, vetMod.ordenCampo);
      const vb = valorOrdenableVet(b, vetMod.ordenCampo);
      if (va < vb) return vetMod.ordenAsc ? -1 : 1;
      if (va > vb) return vetMod.ordenAsc ? 1 : -1;
      return 0;
    });
  }
  if (filas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">No hay usuarios vetados con esos filtros.</td></tr>';
    return;
  }
  tbody.innerHTML = filas.map(v => {
    const u = v.usuario || {};
    return `
    <tr onclick="abrirDrawerVetado('${v._id}')">
      <td>${escapeHtml(u.nombre || 'Usuario eliminado')}</td>
      <td>${escapeHtml(v.razon || '—')}</td>
      <td>${(v.aliases || []).length}</td>
      <td><span class="status-badge" style="background:${v.activo ? '#fef2f2' : '#f0fdf4'};color:${v.activo ? '#991b1b' : '#166534'}">${v.activo ? 'Activo' : 'Desactivado'}</span></td>
      <td>${new Date(v.createdAt).toLocaleDateString('es-MX')}</td>
      <td onclick="event.stopPropagation()">
        <button class="btn btn-outline admin-mini-btn" onclick="abrirDrawerVetado('${v._id}')">Ver</button>
      </td>
    </tr>`;
  }).join('');
};

const exportarVetadosExcel = async () => {
  try {
    const search = document.getElementById('vetado-search')?.value || '';
    const activo = document.getElementById('vetado-filtro')?.value || '';
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (activo) params.append('activo', activo);

    const token = localStorage.getItem('accessToken');
    const res = await fetch(`/api/admin/vetados/exportar?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
    if (!res.ok) { const d = await res.json(); dsToast({ title: 'Error', message: d.error || 'No se pudo exportar', type: 'error' }); return; }
    const blob = await res.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `vetados-${Date.now()}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    dsToast({ title: 'Exportado', message: 'Excel descargado correctamente.', type: 'success' });
  } catch (e) {
    dsToast({ title: 'Error', message: 'No se pudo generar el Excel', type: 'error' });
  }
};

// ==========================================
// CREAR VETADO (desde el drawer de Usuarios)
// ==========================================
let usuarioAVetarId = null;
let usuarioKycARechazar = null;

window.abrirModalVetar = (id) => {
  usuarioAVetarId = id;
  document.getElementById('vetar-razon').value = '';
  document.getElementById('vetar-detalles').value = '';
  document.getElementById('modal-vetar').style.display = 'flex';
};

window.confirmarVetar = async () => {
  const razon = document.getElementById('vetar-razon').value.trim();
  if (!razon) { dsToast({ title: 'Falta la razón', message: 'Escribe la razón del vetado.', type: 'error' }); return; }
  const detalles = document.getElementById('vetar-detalles').value.trim();

  const data = await api.post(`/admin/vetados/${usuarioAVetarId}`, { razon, detalles });
  if (data.ok) {
    dsToast({ title: 'Usuario vetado', message: 'La cuenta fue suspendida y registrada como vetada.', type: 'success' });
    document.getElementById('modal-vetar').style.display = 'none';
    cargarUsuarios();
  } else {
    dsToast({ title: 'No se pudo vetar', message: data.error || 'Intenta de nuevo.', type: 'error' });
  }
};

// ==========================================
// DRAWER LATERAL — MÓDULO "USUARIOS VETADOS"
// ==========================================
window.abrirDrawerVetado = async (id) => {
  const v = vetMod.data.find(x => x._id === id);
  const content = document.getElementById('drawer-vet-content');
  if (!content || !v) return;
  renderDrawerVetado(v);
  document.getElementById('drawer-vet').classList.add('abierto');
  document.getElementById('drawer-vet-overlay').classList.add('abierto');
};

const renderDrawerVetado = (v, candidatosHtml) => {
  const content = document.getElementById('drawer-vet-content');
  const u = v.usuario || {};
  const admin = v.admin || {};
  const aliases = v.aliases || [];

  content.innerHTML = `
    <div style="padding:24px">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
        <div style="width:54px;height:54px;border-radius:50%;background:#dc2626;color:white;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700">${(u.nombre || '?')[0].toUpperCase()}</div>
        <div>
          <h2 style="font-size:19px;font-weight:700">${escapeHtml(u.nombre || 'Usuario eliminado')}</h2>
          <div style="font-size:13px;color:var(--text-light)">${escapeHtml(u.email || 'Sin email')}${u.telefono ? ' · ' + u.telefono : ''}</div>
          <span class="status-badge" style="background:${v.activo ? '#fef2f2' : '#f0fdf4'};color:${v.activo ? '#991b1b' : '#166534'};margin-top:6px;display:inline-block">${v.activo ? '🔴 Activo' : '🟢 Desactivado'}</span>
        </div>
      </div>

      <div style="padding:16px;background:#f8f9fa;border-radius:10px;border:1px solid #e5e7eb;margin-bottom:20px;font-size:13px;line-height:1.8">
        <div><b>Razón:</b> ${escapeHtml(v.razon || '—')}</div>
        ${v.detalles ? `<div><b>Detalles:</b> ${escapeHtml(v.detalles)}</div>` : ''}
        <div><b>Vetado por:</b> ${escapeHtml(admin.nombre || 'Admin')}</div>
        <div><b>Fecha:</b> ${new Date(v.createdAt).toLocaleString('es-MX')}</div>
      </div>

      <div style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <label style="font-size:12px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:0.05em">🔗 Aliases vinculados (${aliases.length})</label>
          <button class="btn btn-outline admin-mini-btn" onclick="buscarPosiblesAlias('${v._id}')">Buscar posibles alias</button>
        </div>
        ${aliases.length > 0 ? aliases.map(a => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f8f9fa;border-radius:8px;margin-bottom:6px;font-size:13px">
            <span>${escapeHtml(a.email || 'Sin email')}${a.telefono ? ' · ' + a.telefono : ''}</span>
            <button class="btn btn-outline admin-mini-btn" style="border-color:#c62828;color:#c62828" onclick="desvincularAliasDrawer('${v.usuario?._id}', '${a.usuarioId?._id || a.usuarioId}')">Desvincular</button>
          </div>`).join('') : '<div style="font-size:13px;color:var(--text-light)">Sin aliases vinculados.</div>'}
        <div id="vet-candidatos-alias" style="margin-top:10px">${candidatosHtml || ''}</div>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
        <button class="btn btn-outline" style="padding:9px 18px;font-size:13px" onclick="cerrarDrawerVetado()">Cerrar</button>
        ${v.activo ? `<button class="btn btn-primary" style="padding:9px 18px;font-size:13px" onclick="desvetarDesdeDrawer('${v.usuario?._id}')">Desvetar</button>` : ''}
      </div>
    </div>`;
};

window.buscarPosiblesAlias = async (vetadoId) => {
  const v = vetMod.data.find(x => x._id === vetadoId);
  if (!v || !v.usuario?._id) return;
  const cont = document.getElementById('vet-candidatos-alias');
  if (cont) cont.innerHTML = '<div style="font-size:12px;color:var(--text-light)">Buscando...</div>';
  const data = await api.get(`/admin/vetados/${v.usuario._id}/aliases/buscar`);
  if (!data.ok || !data.candidatos?.length) {
    if (cont) cont.innerHTML = '<div style="font-size:12px;color:var(--text-light)">No se encontraron coincidencias por teléfono o nombre.</div>';
    return;
  }
  const html = data.candidatos.map(c => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;margin-bottom:6px;font-size:13px">
      <span>${escapeHtml(c.nombre)} · ${escapeHtml(c.email)} <span style="color:var(--text-light)">(${escapeHtml(c.matchRazon || 'posible coincidencia')})</span></span>
      <button class="btn btn-primary admin-mini-btn" onclick="vincularAliasDrawer('${vetadoId}', '${v.usuario._id}', '${c._id}')">Vincular</button>
    </div>`).join('');
  if (cont) cont.innerHTML = html;
};

window.vincularAliasDrawer = async (vetadoId, usuarioId, aliasId) => {
  const data = await api.post(`/admin/vetados/${usuarioId}/aliases`, { aliasId });
  if (data.ok) {
    dsToast({ title: 'Alias vinculado', message: 'La cuenta alias fue suspendida.', type: 'success' });
    await cargarVetados();
    const actualizado = vetMod.data.find(x => x._id === vetadoId);
    if (actualizado) renderDrawerVetado(actualizado);
  } else {
    dsToast({ title: 'No se pudo vincular', message: data.error || 'Intenta de nuevo.', type: 'error' });
  }
};

window.desvincularAliasDrawer = async (vetadoUsuarioId, aliasId) => {
  const data = await api.post(`/admin/vetados/alias/${aliasId}/desvincular`, { vetadoId: vetadoUsuarioId });
  if (data.ok) {
    dsToast({ title: 'Alias desvinculado', message: '', type: 'success' });
    await cargarVetados();
  } else {
    dsToast({ title: 'No se pudo desvincular', message: data.error || 'Intenta de nuevo.', type: 'error' });
  }
};

window.desvetarDesdeDrawer = async (usuarioId) => {
  const ok = await dsConfirm({ title: '¿Desvetar usuario?', message: 'El usuario y sus aliases vinculados podrán volver a usar la plataforma.', confirmText: 'Desvetar' });
  if (!ok) return;
  const data = await api.post(`/admin/vetados/${usuarioId}/desvetar`);
  if (data.ok) {
    dsToast({ title: 'Usuario desvetado', type: 'success' });
    cerrarDrawerVetado();
    cargarVetados();
  } else {
    dsToast({ title: 'Error', message: data.error || 'No se pudo desvetar', type: 'error' });
  }
};

window.cerrarDrawerVetado = () => {
  document.getElementById('drawer-vet').classList.remove('abierto');
  document.getElementById('drawer-vet-overlay').classList.remove('abierto');
};

// ==========================================
// MONITOREO DE CHATS
// ==========================================
let monMod = { data: [], ordenCampo: null, ordenAsc: true };

window.cargarMonitoreo = async () => {
  const nivel = document.getElementById('monitoreo-nivel')?.value || '';
  const revision = document.getElementById('monitoreo-revision')?.value || '';
  const params = new URLSearchParams();
  if (nivel) params.append('nivel', nivel);
  if (revision) params.append('revision', revision);

  const [dataMsj, dataStats] = await Promise.all([
    api.get(`/mensajes/admin/riesgo?${params.toString()}`),
    api.get('/mensajes/admin/riesgo/stats')
  ]);

  renderMonModKpis(dataStats);
  if (window.adminCharts) {
    window.adminCharts.renderBarTrend(document.getElementById('mon-mod-tendencia'), {
      labels: (dataStats.tendencia || []).map(d => new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short' })),
      series: [{ name: 'Mensajes de riesgo', values: (dataStats.tendencia || []).map(d => d.count), color: 'var(--primary)' }]
    });
  }

  monMod.data = dataMsj.mensajes || [];
  monMod.ordenCampo = null;
  renderMonModTabla();

  const updEl = document.getElementById('mon-mod-updated');
  if (updEl) updEl.textContent = `Actualizado ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
};

const renderMonModKpis = (s) => {
  const el = document.getElementById('mon-mod-kpis');
  if (!el || !s.ok) return;
  const kpis = [
    { num: s.pendientesRevision, label: 'Pendientes de revisión' },
    { num: s.medio, label: 'Riesgo medio' },
    { num: s.alto, label: 'Riesgo alto' },
    { num: s.critico, label: 'Riesgo crítico' },
    { num: s.hoy, label: 'Nuevos hoy' }
  ];
  el.innerHTML = kpis.map(k => `<div class="mod-kpi-card"><div class="mod-kpi-num">${k.num}</div><div class="mod-kpi-label">${k.label}</div></div>`).join('');
};

const ordenarMonitoreo = (campo) => {
  if (monMod.ordenCampo === campo) { monMod.ordenAsc = !monMod.ordenAsc; }
  else { monMod.ordenCampo = campo; monMod.ordenAsc = true; }
  renderMonModTabla();
};

const riesgoOrden = { bajo: 0, medio: 1, alto: 2, critico: 3 };

const valorOrdenableMon = (m, campo) => {
  switch (campo) {
    case 'fecha': return new Date(m.createdAt).getTime();
    case 'remitente': return (m.remitente?.nombre || '').toLowerCase();
    case 'destinatario': return (m.destinatario?.nombre || '').toLowerCase();
    case 'propiedad': return (m.propiedad?.titulo || '').toLowerCase();
    case 'riesgo': return riesgoOrden[m.riesgo] ?? -1;
    case 'revision': return m.riesgoRevision ? 1 : 0;
    default: return '';
  }
};

const renderMonModTabla = () => {
  const tbody = document.getElementById('mon-mod-tbody');
  if (!tbody) return;
  let filas = [...monMod.data];
  if (monMod.ordenCampo) {
    filas.sort((a, b) => {
      const va = valorOrdenableMon(a, monMod.ordenCampo);
      const vb = valorOrdenableMon(b, monMod.ordenCampo);
      if (va < vb) return monMod.ordenAsc ? -1 : 1;
      if (va > vb) return monMod.ordenAsc ? 1 : -1;
      return 0;
    });
  }
  if (filas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading">No hay mensajes con esos filtros.</td></tr>';
    return;
  }
  const riesgoColor = { bajo: '#16a34a', medio: '#d97706', alto: '#dc2626', critico: '#7f1d1d' };
  tbody.innerHTML = filas.map(m => {
    const c = riesgoColor[m.riesgo] || '#6b7280';
    return `
    <tr onclick="abrirDrawerMonitoreo('${m._id}')">
      <td>${new Date(m.createdAt).toLocaleDateString('es-MX')}</td>
      <td>${escapeHtml(m.remitente?.nombre || '—')}</td>
      <td>${escapeHtml(m.destinatario?.nombre || '—')}</td>
      <td>${escapeHtml(m.propiedad?.titulo || 'Directa')}</td>
      <td><span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${c}20;color:${c};border:1px solid ${c}40">${(m.riesgo || 'bajo').toUpperCase()}</span></td>
      <td>${m.riesgoRevision ? '<span class="status-badge" style="background:#fef3c7;color:#92400e">Pendiente</span>' : '<span class="status-badge" style="background:#f0fdf4;color:#16a34a">Revisado</span>'}</td>
      <td onclick="event.stopPropagation()">
        <button class="btn btn-outline admin-mini-btn" onclick="abrirDrawerMonitoreo('${m._id}')">Ver</button>
      </td>
    </tr>`;
  }).join('');
};

const exportarMonitoreoExcel = async () => {
  try {
    const nivel = document.getElementById('monitoreo-nivel')?.value || '';
    const revision = document.getElementById('monitoreo-revision')?.value || '';
    const params = new URLSearchParams();
    if (nivel) params.append('nivel', nivel);
    if (revision) params.append('revision', revision);

    const token = localStorage.getItem('accessToken');
    const res = await fetch(`/api/mensajes/admin/riesgo/exportar?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
    if (!res.ok) { const d = await res.json(); dsToast({ title: 'Error', message: d.error || 'No se pudo exportar', type: 'error' }); return; }
    const blob = await res.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `mensajes-riesgo-${Date.now()}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    dsToast({ title: 'Exportado', message: 'Excel descargado correctamente.', type: 'success' });
  } catch (e) {
    dsToast({ title: 'Error', message: 'No se pudo generar el Excel', type: 'error' });
  }
};

window.purgarMensajesAntiguosAdmin = async () => {
  if (!confirm('¿Eliminar ahora todos los mensajes con más de 6 meses (excepto los marcados para revisión de riesgo)? Esta acción no se puede deshacer.')) return;
  try {
    const data = await api.post('/mensajes/admin/purgar', {});
    if (data.ok) {
      dsToast({ title: 'Purga completada', message: `${data.deletedCount} mensaje(s) eliminado(s).`, type: 'success' });
      cargarMonitoreo();
    } else {
      dsToast({ title: 'Error', message: data.error || 'No se pudo purgar.', type: 'error' });
    }
  } catch (e) {
    dsToast({ title: 'Error', message: 'No se pudo purgar.', type: 'error' });
  }
};

// ==========================================
// MÓDULO "NOVEDADES"
// ==========================================
let novedadesModData = [];

window.cargarNovedades = async () => {
  const lista = document.getElementById('nov-lista');
  if (!lista) return;
  lista.innerHTML = '<div class="loading">Cargando novedades...</div>';
  try {
    const [dataNov, dataStats] = await Promise.all([
      api.get('/admin/novedades'),
      api.get('/admin/novedades/stats')
    ]);

    const kpisEl = document.getElementById('nov-mod-kpis');
    if (kpisEl && dataStats.ok) {
      kpisEl.innerHTML = `
        <div class="mod-kpi-card"><div class="mod-kpi-num">${dataStats.totalNovedades}</div><div class="mod-kpi-label">Novedades publicadas</div></div>
        <div class="mod-kpi-card"><div class="mod-kpi-num">${dataStats.totalEnviadas}</div><div class="mod-kpi-label">Enviadas por correo</div></div>
        <div class="mod-kpi-card"><div class="mod-kpi-num">${dataStats.totalSuscritos}</div><div class="mod-kpi-label">Usuarios suscritos</div></div>
      `;
      const countEl = document.getElementById('nov-suscritos-count');
      if (countEl) countEl.textContent = dataStats.totalSuscritos;
    }

    novedadesModData = dataNov.novedades || [];
    if (!novedadesModData.length) {
      lista.innerHTML = '<div class="loading" style="color:var(--text-light)">Aún no has publicado ninguna novedad.</div>';
      return;
    }

    lista.innerHTML = novedadesModData.map(n => `
      <div style="background:white;border:1px solid var(--border);border-radius:14px;padding:18px 20px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div>
            <div style="font-weight:700;font-size:15px">${escapeHtml(n.titulo)}</div>
            <div style="font-size:12px;color:var(--text-light);margin-top:2px">
              ${new Date(n.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} · por ${n.creadoPor?.nombre || 'Admin'}
              ${n.correoEnviado ? ` · ✅ Enviada a ${n.destinatariosCorreo} usuario(s)` : ' · Sin enviar por correo'}
            </div>
          </div>
          <button class="btn btn-outline admin-mini-btn" onclick="eliminarNovedadAdmin('${n._id}')">🗑️ Eliminar</button>
        </div>
        <div style="font-size:13px;color:var(--text);margin-top:10px;line-height:1.6;white-space:pre-wrap">${escapeHtml(n.mensaje)}</div>
        ${n.link ? `<a href="${n.link}" target="_blank" style="font-size:12px;color:var(--primary);display:inline-block;margin-top:8px">🔗 ${n.link}</a>` : ''}
      </div>
    `).join('');
  } catch (error) {
    lista.innerHTML = '<div class="loading" style="color:red">Error al cargar novedades.</div>';
  }
};

window.abrirFormNovedad = () => {
  document.getElementById('nov-titulo').value = '';
  document.getElementById('nov-mensaje').value = '';
  document.getElementById('nov-link').value = '';
  document.getElementById('nov-enviar-correo').checked = false;
  document.getElementById('nov-form').style.display = 'block';
};

window.cerrarFormNovedad = () => {
  document.getElementById('nov-form').style.display = 'none';
};

window.guardarNovedad = async () => {
  const titulo = document.getElementById('nov-titulo').value.trim();
  const mensaje = document.getElementById('nov-mensaje').value.trim();
  const link = document.getElementById('nov-link').value.trim();
  const enviarCorreoAhora = document.getElementById('nov-enviar-correo').checked;

  if (!titulo || !mensaje) {
    dsToast({ title: 'Faltan datos', message: 'Título y mensaje son obligatorios.', type: 'error' });
    return;
  }

  try {
    const data = await api.post('/admin/novedades', { titulo, mensaje, link: link || null, enviarCorreoAhora });
    if (data.ok) {
      dsToast({ title: 'Novedad publicada', message: enviarCorreoAhora ? `Enviada a ${data.novedad.destinatariosCorreo} usuario(s).` : 'Se guardó sin enviar por correo.', type: 'success' });
      cerrarFormNovedad();
      cargarNovedades();
    } else {
      dsToast({ title: 'Error', message: data.error || 'No se pudo publicar.', type: 'error' });
    }
  } catch (e) {
    dsToast({ title: 'Error', message: 'No se pudo publicar la novedad.', type: 'error' });
  }
};

window.eliminarNovedadAdmin = async (id) => {
  if (!confirm('¿Eliminar esta novedad? El correo ya enviado no se puede revocar, solo se borra el registro.')) return;
  try {
    const data = await api.delete(`/admin/novedades/${id}`);
    if (data.ok) {
      dsToast({ title: 'Eliminada', message: 'Novedad eliminada.', type: 'info' });
      cargarNovedades();
    } else {
      dsToast({ title: 'Error', message: data.error || 'No se pudo eliminar.', type: 'error' });
    }
  } catch (e) {
    dsToast({ title: 'Error', message: 'No se pudo eliminar.', type: 'error' });
  }
};

// ==========================================
// MÓDULO "REPORTES"
// ==========================================
const REP_MOTIVO_LABEL = {
  spam: 'Spam o publicidad', fraude: 'Posible fraude', contenido_inapropiado: 'Contenido inapropiado',
  informacion_falsa: 'Información falsa', acoso: 'Acoso u hostigamiento', otro: 'Otro'
};
const REP_STATUS_LABEL = { pendiente: 'Pendiente', revisado: 'Revisado', descartado: 'Descartado' };

window.cargarReportes = async () => {
  const lista = document.getElementById('rep-lista');
  if (!lista) return;
  lista.innerHTML = '<div class="loading">Cargando reportes...</div>';
  const status = document.getElementById('rep-filtro-status')?.value || '';
  const tipo = document.getElementById('rep-filtro-tipo')?.value || '';
  try {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (tipo) params.append('tipo', tipo);

    const [dataRep, dataStats] = await Promise.all([
      api.get(`/reportes/admin?${params.toString()}`),
      api.get('/reportes/admin/stats')
    ]);

    const kpisEl = document.getElementById('rep-mod-kpis');
    if (kpisEl && dataStats.ok) {
      kpisEl.innerHTML = `
        <div class="mod-kpi-card"><div class="mod-kpi-num">${dataStats.pendientes}</div><div class="mod-kpi-label">Pendientes</div></div>
        <div class="mod-kpi-card"><div class="mod-kpi-num">${dataStats.revisados}</div><div class="mod-kpi-label">Revisados</div></div>
        <div class="mod-kpi-card"><div class="mod-kpi-num">${dataStats.descartados}</div><div class="mod-kpi-label">Descartados</div></div>
        <div class="mod-kpi-card"><div class="mod-kpi-num">${dataStats.totalPropiedad}</div><div class="mod-kpi-label">De publicaciones</div></div>
        <div class="mod-kpi-card"><div class="mod-kpi-num">${dataStats.totalMensaje}</div><div class="mod-kpi-label">De conversaciones</div></div>
      `;
    }

    const reportes = dataRep.reportes || [];
    if (!reportes.length) {
      lista.innerHTML = '<div class="loading" style="color:var(--text-light)">No hay reportes con estos filtros.</div>';
      return;
    }

    lista.innerHTML = reportes.map(r => `
      <div style="background:white;border:1px solid var(--border);border-radius:14px;padding:18px 20px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div>
            <span class="badge-estatus badge-${r.status === 'pendiente' ? 'pendiente' : r.status === 'revisado' ? 'completado' : 'reembolsado'}">${REP_STATUS_LABEL[r.status]}</span>
            <span style="font-size:13px;font-weight:700;margin-left:8px">${r.tipo === 'propiedad' ? '🏠 Publicación' : '💬 Conversación'}: ${REP_MOTIVO_LABEL[r.motivo] || r.motivo}</span>
            <div style="font-size:12px;color:var(--text-light);margin-top:4px">
              ${new Date(r.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              · Reportado por ${escapeHtml(r.reportadoPor?.nombre || 'Usuario')} (${escapeHtml(r.reportadoPor?.email || '')})
              ${r.propiedad ? ` · Propiedad: <b>${escapeHtml(r.propiedad.titulo)}</b>` : ''}
              ${r.usuarioReportado ? ` · Reportado: ${escapeHtml(r.usuarioReportado.nombre || '')} (${escapeHtml(r.usuarioReportado.email || '')})` : ''}
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0">
            ${r.propiedad ? `<button class="btn btn-outline admin-mini-btn" onclick="window.open('propiedad.html?id=${r.propiedad._id}','_blank')">Ver publicación</button>` : ''}
            ${r.status === 'pendiente' ? `
              <button class="btn btn-outline admin-mini-btn" onclick="actualizarReporteAdmin('${r._id}','revisado')">✓ Marcar revisado</button>
              <button class="btn btn-outline admin-mini-btn" onclick="actualizarReporteAdmin('${r._id}','descartado')">✕ Descartar</button>
            ` : ''}
            <button class="btn btn-outline admin-mini-btn" onclick="eliminarReporteAdmin('${r._id}')">🗑️</button>
          </div>
        </div>
        ${r.detalle ? `<div style="font-size:13px;color:var(--text);margin-top:10px;padding:10px 12px;background:var(--bg-secondary);border-radius:8px">${escapeHtml(r.detalle)}</div>` : ''}
      </div>
    `).join('');
  } catch (error) {
    lista.innerHTML = '<div class="loading" style="color:red">Error al cargar reportes.</div>';
  }
};

window.actualizarReporteAdmin = async (id, status) => {
  try {
    const data = await api.patch(`/reportes/admin/${id}`, { status });
    if (data.ok) {
      dsToast({ title: status === 'revisado' ? 'Marcado como revisado' : 'Descartado', message: '', type: 'success' });
      cargarReportes();
    } else {
      dsToast({ title: 'Error', message: data.error || 'No se pudo actualizar.', type: 'error' });
    }
  } catch (e) {
    dsToast({ title: 'Error', message: 'No se pudo actualizar.', type: 'error' });
  }
};

window.eliminarReporteAdmin = async (id) => {
  if (!confirm('¿Eliminar este reporte?')) return;
  try {
    const data = await api.delete(`/reportes/admin/${id}`);
    if (data.ok) { dsToast({ title: 'Eliminado', message: '', type: 'info' }); cargarReportes(); }
    else dsToast({ title: 'Error', message: data.error || 'No se pudo eliminar.', type: 'error' });
  } catch (e) {
    dsToast({ title: 'Error', message: 'No se pudo eliminar.', type: 'error' });
  }
};

// ==========================================
// DRAWER LATERAL — MÓDULO "MONITOREO"
// ==========================================
window.abrirDrawerMonitoreo = (id) => {
  const m = monMod.data.find(x => x._id === id);
  const content = document.getElementById('drawer-mon-content');
  if (!content || !m) return;

  const riesgoColor = { bajo: '#16a34a', medio: '#d97706', alto: '#dc2626', critico: '#7f1d1d' };
  const c = riesgoColor[m.riesgo] || '#6b7280';
  const flags = (m.riesgoFlags || []).join(', ') || 'Ninguno';

  content.innerHTML = `
    <div style="padding:24px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px">
        <div>
          <h2 style="font-size:19px;font-weight:700;margin-bottom:6px">${escapeHtml(m.remitente?.nombre || '?')} → ${escapeHtml(m.destinatario?.nombre || '?')}</h2>
          <div style="font-size:13px;color:var(--text-light)">${new Date(m.createdAt).toLocaleString('es-MX')}</div>
        </div>
        <div style="display:flex;gap:6px">
          <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${c}20;color:${c};border:1px solid ${c}40">${(m.riesgo || 'bajo').toUpperCase()}</span>
          ${m.riesgoRevision ? '<span class="status-badge" style="background:#fef3c7;color:#92400e">Pendiente</span>' : '<span class="status-badge" style="background:#f0fdf4;color:#16a34a">Revisado</span>'}
        </div>
      </div>

      ${m.propiedad?.titulo ? `<div style="font-size:13px;color:var(--text-light);margin-bottom:12px">🏠 ${escapeHtml(m.propiedad.titulo)}${m.propiedad.precio ? ' · ' + formatPrecio(m.propiedad.precio) : ''}</div>` : ''}

      <div style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:10px;padding:16px;font-size:14px;line-height:1.6;margin-bottom:16px;white-space:pre-wrap">${escapeHtml(m.mensaje)}</div>

      <div style="padding:14px;background:${c}10;border:1px solid ${c}30;border-radius:10px;margin-bottom:20px;font-size:13px">
        <b style="color:${c}">Flags detectados:</b> ${escapeHtml(flags)}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
        <div style="padding:12px;background:#f8f9fa;border-radius:10px;border:1px solid #e5e7eb;font-size:12px;line-height:1.7">
          <div style="font-weight:600;color:var(--text-light);text-transform:uppercase;font-size:11px;margin-bottom:4px">Remitente</div>
          <div>${escapeHtml(m.remitente?.nombre || '—')}</div>
          <div style="color:var(--text-light)">${escapeHtml(m.remitente?.email || '')}</div>
          ${m.remitente?.plan ? `<span class="plan-badge plan-${m.remitente.plan}" style="margin-top:4px;display:inline-block">${m.remitente.plan}</span>` : ''}
        </div>
        <div style="padding:12px;background:#f8f9fa;border-radius:10px;border:1px solid #e5e7eb;font-size:12px;line-height:1.7">
          <div style="font-weight:600;color:var(--text-light);text-transform:uppercase;font-size:11px;margin-bottom:4px">Destinatario</div>
          <div>${escapeHtml(m.destinatario?.nombre || '—')}</div>
          <div style="color:var(--text-light)">${escapeHtml(m.destinatario?.email || '')}</div>
          ${m.destinatario?.plan ? `<span class="plan-badge plan-${m.destinatario.plan}" style="margin-top:4px;display:inline-block">${m.destinatario.plan}</span>` : ''}
        </div>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
        <button class="btn btn-outline" style="padding:9px 18px;font-size:13px" onclick="cerrarDrawerMonitoreo()">Cerrar</button>
        ${m.riesgoRevision ? `<button class="btn btn-primary" style="padding:9px 18px;font-size:13px" onclick="marcarRevisadoDrawer('${m._id}')">✓ Marcar como revisado</button>` : ''}
      </div>
    </div>`;

  document.getElementById('drawer-mon').classList.add('abierto');
  document.getElementById('drawer-mon-overlay').classList.add('abierto');
};

window.cerrarDrawerMonitoreo = () => {
  document.getElementById('drawer-mon').classList.remove('abierto');
  document.getElementById('drawer-mon-overlay').classList.remove('abierto');
};

window.marcarRevisadoDrawer = async (id) => {
  const data = await api.patch(`/mensajes/admin/${id}/revisado`);
  if (data.ok) {
    dsToast({ title: 'Marcado como revisado', type: 'success' });
    cerrarDrawerMonitoreo();
    cargarMonitoreo();
  } else {
    dsToast({ title: 'Error', message: data.error || 'No se pudo marcar', type: 'error' });
  }
};