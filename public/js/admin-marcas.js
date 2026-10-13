// ==========================================
// LÓGICA DEL PANEL DE ADMINISTRACIÓN: MARCAS
// ==========================================
let marMarcasData = [];
let marPagina = 1;
const marLimit = 12;

// Función para escapar HTML y evitar inyección de código en el panel
const esc = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Cargar todas las marcas desde el backend
window.cargarMarcasAdmin = async () => {
  const lista = document.getElementById('mar-lista');
  if (!lista) return;
  lista.innerHTML = '<div class="loading">Cargando marcas registradas...</div>';
  try {
    const data = await api.get('/admin/marcas');
    if (!data.ok) throw new Error(data.error || 'Error al cargar marcas');
    
    marMarcasData = data.marcas || [];
    marPagina = 1;
    renderizarMarcasAdmin();
  } catch (error) {
    lista.innerHTML = `<div class="loading" style="color:red">${error.message}</div>`;
  }
};

// Filtrar en tiempo real al escribir o cambiar selects
window.buscarMarcasAdmin = () => { marPagina = 1; renderizarMarcasAdmin(); };
window.filtrarMarcasAdmin = () => { marPagina = 1; renderizarMarcasAdmin(); };

// Renderizar la lista de marcas con paginación
const renderizarMarcasAdmin = () => {
  const q = (document.getElementById('mar-q')?.value || '').toLowerCase().trim();
  const estado = document.getElementById('mar-estado')?.value || '';
  const solicitudes = document.getElementById('mar-solicitudes')?.value || '';

  let filtradas = marMarcasData.filter(m => {
    // Filtro de estado
    if (estado === 'todos') return true;
    if (estado && m.status !== estado) return false;

    // Filtro de búsqueda
    if (q) {
      const txt = `${m.nombreComercial} ${m.accountId?.email || ''} ${m.accountId?.phone || ''} ${m.categorias?.map(c=>c.nombre).join(' ') || ''} ${m.ciudadesCobertura?.map(c=>c.nombre).join(' ') || ''}`.toLowerCase();
      if (!txt.includes(q)) return false;
    }

    // Filtro de solicitudes de moderación
    if (solicitudes === 'abiertas' && !(m.solicitudesModeracion || []).some(s => s.estado === 'abierta')) return false;
    if (solicitudes === 'atendidas' && !(m.solicitudesModeracion || []).some(s => s.estado === 'atendida')) return false;

    return true;
  });

  // Renderizar KPIs
  const kpisEl = document.getElementById('mar-kpis');
  if (kpisEl) {
    kpisEl.innerHTML = `
      <div class="mod-kpi-card"><div class="mod-kpi-num">${marMarcasData.length}</div><div class="mod-kpi-label">Total Marcas</div></div>
      <div class="mod-kpi-card"><div class="mod-kpi-num">${marMarcasData.filter(m=>m.status==='publicado').length}</div><div class="mod-kpi-label">Publicadas</div></div>
      <div class="mod-kpi-card"><div class="mod-kpi-num">${marMarcasData.filter(m=>m.status==='bloqueado').length}</div><div class="mod-kpi-label">Bloqueadas</div></div>
    `;
  }

  // Paginación
  const totalPaginas = Math.ceil(filtradas.length / marLimit);
  if (marPagina > totalPaginas && totalPaginas > 0) marPagina = totalPaginas;
  const inicio = (marPagina - 1) * marLimit;
  const paginaData = filtradas.slice(inicio, inicio + marLimit);

  const lista = document.getElementById('mar-lista');
  if (paginaData.length === 0) {
    lista.innerHTML = '<div class="loading" style="color:var(--text-light)">No hay marcas que coincidan con estos filtros.</div>';
  } else {
    lista.innerHTML = paginaData.map(m => {
      const contacto = m.accountId ? (m.accountId.email || m.accountId.phone) : 'Sin contacto';
      const estadoColor = m.status === 'publicado' ? '#166534' : m.status === 'bloqueado' ? '#991b1b' : '#7a5c00';
      const estadoBg = m.status === 'publicado' ? '#f0fdf4' : m.status === 'bloqueado' ? '#fef2f2' : '#fffbeb';
      
      const tieneSolicitudes = (m.solicitudesModeracion || []).some(s => s.estado === 'abierta');
      
      return `
        <div class="prop-admin-card" style="margin-bottom: 12px;">
          <div class="prop-admin-img" style="width: 80px; height: 80px; flex-shrink: 0;">
            ${m.logo ? `<img src="${m.logo}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#f3f4f6;border-radius:8px;font-size:24px">🏢</div>'}
          </div>
          <div class="prop-admin-info">
            <div class="prop-admin-titulo">
              ${esc(m.nombreComercial)} 
              ${tieneSolicitudes ? '<span style="color:#dc2626;font-size:16px;" title="Tiene solicitudes de moderación pendientes">⚠️</span>' : ''}
            </div>
            <div class="prop-admin-meta">${esc(contacto)}</div>
            <div style="margin-top:4px;">
              <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${estadoBg};color:${estadoColor};border:1px solid ${estadoColor}30;text-transform:capitalize;">${m.status}</span>
            </div>
          </div>
          <div class="prop-admin-actions" style="align-items: flex-start; flex-wrap: wrap;">
            <button class="btn btn-outline admin-mini-btn" onclick="window.open('/marca/${m.slug}', '_blank')">Ver Perfil</button>
            <button class="btn btn-outline admin-mini-btn" style="color:#f59e0b;border-color:#fde68a" onclick="resetPasswordMarca('${m._id}', '${esc(m.accountId?.email || 'Sin correo')}')">🔑 Contraseña</button>
            ${m.status !== 'bloqueado' ? `
              <button class="btn btn-outline admin-mini-btn" style="color:#dc2626;border-color:#fecaca" onclick="cambiarStatusMarca('${m._id}', 'bloqueado')">Bloquear</button>
            ` : `
              <button class="btn btn-outline admin-mini-btn" style="color:#16a34a;border-color:#bbf7d0" onclick="cambiarStatusMarca('${m._id}', 'publicado')">Desbloquear</button>
            `}
            ${m.status !== 'eliminado' ? `
              <button class="btn btn-outline admin-mini-btn" style="color:#dc2626;border-color:#fecaca" onclick="cambiarStatusMarca('${m._id}', 'eliminado')">Eliminar</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // Renderizar controles de paginación
  const pagEl = document.getElementById('mar-paginacion');
  if (pagEl) {
    if (totalPaginas > 1) {
      pagEl.innerHTML = `
        <button class="btn btn-outline admin-mini-btn" onclick="cambiarPaginaMarca(${marPagina - 1})" ${marPagina === 1 ? 'disabled' : ''}>← Anterior</button>
        <span style="font-size:13px;color:var(--text-light)">Página ${marPagina} de ${totalPaginas}</span>
        <button class="btn btn-outline admin-mini-btn" onclick="cambiarPaginaMarca(${marPagina + 1})" ${marPagina === totalPaginas ? 'disabled' : ''}>Siguiente →</button>
      `;
    } else {
      pagEl.innerHTML = '';
    }
  }
};

window.cambiarPaginaMarca = (n) => {
  marPagina = n;
  renderizarMarcasAdmin();
};

// Cambiar el estado (bloquear, desbloquear, eliminar)
window.cambiarStatusMarca = async (id, nuevoStatus) => {
  const mensajes = {
    'bloqueado': '¿Bloquear esta marca? Desaparecerá del directorio público.',
    'publicado': '¿Desbloquear esta marca? Volverá a aparecer en el directorio público.',
    'eliminado': '¿Eliminar esta marca? Se quitará del directorio y el proveedor no podrá republicarla.'
  };
  
  if (!confirm(mensajes[nuevoStatus] || `¿Cambiar estado a "${nuevoStatus}"?`)) return;
  
  try {
    const res = await api.put(`/admin/marcas/${id}/status`, { status: nuevoStatus });
    if (res.ok) {
      dsToast({ title: 'Estado actualizado', message: 'La marca ha sido actualizada correctamente.', type: 'success' });
      cargarMarcasAdmin(); // Recargar la lista
    } else {
      dsToast({ title: 'Error', message: res.error || 'No se pudo actualizar.', type: 'error' });
    }
  } catch (e) {
    dsToast({ title: 'Error de conexión', type: 'error' });
  }
};

// Resetear contraseña de una marca (desde el admin)
window.resetPasswordMarca = async (marcaId, email) => {
  if (!confirm(`¿Generar una contraseña temporal para esta marca (${email})? Se le enviará por correo si tiene uno válido.`)) return;
  
  try {
    const res = await api.post(`/admin/marcas/${marcaId}/reset-password`, {});
    if (res.ok) {
      prompt('✅ Contraseña temporal generada. Cópiala y entrégasela al cliente:', res.passwordTemporal);
      dsToast({ title: 'Contraseña reseteada', message: 'Se envió por correo si estaba disponible.', type: 'success' });
    } else {
      dsToast({ title: 'Error', message: res.error || 'No se pudo resetear.', type: 'error' });
    }
  } catch (e) {
    dsToast({ title: 'Error de conexión', type: 'error' });
  }
};

// Placeholder para el botón de categorías y ciudades (futura funcionalidad)
window.abrirCatalogosMarcas = () => {
  dsToast({ title: 'Próximamente', message: 'La edición de categorías y ciudades estará disponible aquí pronto.', type: 'info' });
};