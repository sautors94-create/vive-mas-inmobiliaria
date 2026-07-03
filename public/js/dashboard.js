if (!auth.isLoggedIn()) window.location.href = 'login.html';

const user = auth.getUser();
let mapaPublicar = null;
let markerPublicar = null;

document.addEventListener('DOMContentLoaded', () => {
  // Si llega con ?seccion=X en la URL (ej. desde el panel admin), abre esa sección directamente
  const seccionURL = new URLSearchParams(window.location.search).get('seccion');
  if (seccionURL && document.getElementById(`sec-${seccionURL}`)) {
    document.querySelectorAll('.dash-section').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    document.getElementById(`sec-${seccionURL}`).style.display = 'block';
    document.querySelector(`.sidebar-link[onclick*="${seccionURL}"]`)?.classList.add('active');
    if (seccionURL === 'nueva-propiedad') setTimeout(() => iniciarMapaPublicar(), 200);
  }

  if (user) {
    document.getElementById('user-nombre').textContent = user.nombre;
    document.getElementById('sidebar-nombre').textContent = user.nombre;
    document.getElementById('sidebar-plan').textContent = `Plan ${user.plan}`;
    document.getElementById('user-avatar').textContent = user.nombre.charAt(0).toUpperCase();

    // Default view: grid
    const gridBtn = document.getElementById('view-grid-btn');
    const listBtn = document.getElementById('view-list-btn');
    const container = document.getElementById('mis-props-container');
    if (gridBtn && listBtn && container) {
      const setView = (view) => {
        container.classList.toggle('mis-props-view-grid', view === 'grid');
        container.classList.toggle('mis-props-view-list', view === 'list');
        gridBtn.classList.toggle('btn-primary', view === 'grid');
        gridBtn.classList.toggle('btn-outline', view !== 'grid');
        listBtn.classList.toggle('btn-primary', view === 'list');
        listBtn.classList.toggle('btn-outline', view !== 'list');
      };

      setView('grid');
      gridBtn.addEventListener('click', () => setView('grid'));
      listBtn.addEventListener('click', () => {
        setView('list');
        cargarMisPropiedades();
      });
    }

    cargarMisPropiedades();
    cargarResumenUsuario();
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
  if (seccion === 'leads') cargarLeadsUsuario();
  if (seccion === 'mensajes') cargarMensajes();
  if (seccion === 'nueva-propiedad') iniciarMapaPublicar();
};

const actualizarBadgeMensajes = (total) => {
  const badge = document.getElementById('mensajes-badge');
  if (!badge) return;
  badge.textContent = total;
  badge.style.display = total > 0 ? 'inline-flex' : 'none';
};

const cargarResumenUsuario = async () => {
  const planPill = document.getElementById('resume-plan-pill');
  const titleEl = document.getElementById('resume-insights-title');
  const descEl = document.getElementById('resume-insights-desc');
  const gridEl = document.getElementById('resume-stats-grid');

  if (!gridEl || !titleEl || !descEl) return;

  try {
    // Fuentes actuales disponibles en el proyecto:
    // - Mis propiedades
    // - Leads del usuario
    // No existe un endpoint premium consolidado para user dashboard.
    const [misPropsRes, leadsRes] = await Promise.all([
      api.get('/propiedades/mis-propiedades'),
      api.get('/auth/leads')
    ]);

    const propiedades = misPropsRes?.propiedades || [];
    const leads = leadsRes?.leads || [];
    const mensajesNoLeidos = leadsRes?.mensajesNoLeidos || 0;

    const total = propiedades.length;
    const enRevision = propiedades.filter(p => p.status === 'revision').length;
    const aprobadas = propiedades.filter(p => p.status === 'aprobada').length;
    const rechazadas = propiedades.filter(p => p.status === 'rechazada').length;

    if (planPill && user?.plan) {
      planPill.style.display = 'inline-flex';
      planPill.textContent = `Plan: ${user.plan}`;
    }

    // Stats cards (KPIs con trend indicator)
    const kpiTrend = (numero, label) => {
      // Sin histórico real en backend: usamos un fallback determinista para UI.
      // Cuando exista endpoint de métricas históricas, se reemplaza por datos reales.
      const seed = (String(label) + ':' + numero).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const deltaPct = ((seed % 19) - 9) * 1.2; // -10.8% .. +9.6%
      const isUp = deltaPct >= 0;
      const deltaText = `${isUp ? '↑' : '↓'} ${Math.abs(deltaPct).toFixed(1)}%`;
      const pillClass = isUp ? 'trend-up' : 'trend-down';
      return `<span class="trend-pill ${pillClass}">${deltaText}</span>`;
    };

    gridEl.innerHTML = [
      { label: 'En revisión', numero: enRevision, icon: 'hourglass' },
      { label: 'Aprobadas', numero: aprobadas, icon: 'star' },
      { label: 'Rechazadas', numero: rechazadas, icon: 'hourglass' },
      { label: 'Leads', numero: leads.length, icon: 'list' }
    ].map(s => `
      <div class="stat-card ds-anim-in">
        <div class="stat-row">
          <div class="stat-left">
            <div class="stat-numero">${s.numero}</div>
            <div class="stat-label">${s.label} ${kpiTrend(s.numero, s.label)}</div>
          </div>
          <div class="stat-icon">
            <span class="li-icon" data-lucide="${s.icon}"></span>
          </div>
        </div>
      </div>`).join('');


    // Insights (texto dinámico simple)
    const mensajeText = mensajesNoLeidos > 0 ? `Tienes ${mensajesNoLeidos} mensaje(s) sin leer.` : 'Sin mensajes pendientes.';
    const revisionText = enRevision > 0 ? `Hay ${enRevision} publicación(es) en revisión.` : 'Tus publicaciones están al día.';

    titleEl.textContent = total > 0 ? 'Tu performance en el dashboard' : 'Empieza tu primera publicación';
    descEl.textContent = `${revisionText} ${mensajeText}`.trim();

    // Re-inyectar iconos Lucide si existe el helper.
    if (window.dsLucide?.inject) window.dsLucide.inject();
  } catch (e) {
    titleEl.textContent = 'No se pudo cargar el resumen';
    descEl.textContent = 'Intenta nuevamente más tarde.';
    gridEl.innerHTML = '';
  }
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
  if (!direccion && !ciudad) {
    dsToast({ title: 'Falta la dirección', message: 'Escribe una dirección o ciudad para buscar.', type: 'error' });
    return;
  }

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
      dsToast({ title: 'Sin resultados', message: 'No se encontró la dirección. Haz clic directamente en el mapa.', type: 'error' });
    }
  } catch (e) {
    dsToast({ title: 'Error al buscar', message: 'No se pudo geocodificar. Haz clic directamente en el mapa.', type: 'error' });
  }
};

let fotosOrden = []; // array de objetos: { file, dataUrl }
let fotoPortadaIdx = 0; // índice dentro de fotosOrden

const previsualizarFotos = (input) => {
  const preview = document.getElementById('fotos-preview');
  if (!preview) return;

  preview.innerHTML = '';
  fotosOrden = [];
  fotoPortadaIdx = 0;

  const files = Array.from(input.files || []).slice(0, 15);
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      fotosOrden.push({ file, dataUrl: e.target.result });
      renderFotosPreview();
    };
    reader.readAsDataURL(file);
  });
};

const actualizarBadgesPaso6 = () => {
  const badgeCount = document.getElementById('badge-fotos-count');
  const badgeMin = document.getElementById('badge-fotos-min');
  const badgePortada = document.getElementById('badge-fotos-portada');

  const fotosCount = fotosOrden.length;
  const minOk = fotosCount >= 2;
  const portadaOk = fotosCount > 0 && fotoPortadaIdx >= 0 && fotoPortadaIdx < fotosCount;

  if (badgeCount) badgeCount.textContent = `Fotos: ${fotosCount}`;
  if (badgeMin) {
    badgeMin.textContent = `Mínimo 2: ${minOk ? 'OK' : 'Pendiente'}`;
    badgeMin.classList.toggle('ds-badge-primary', minOk);
    badgeMin.classList.toggle('ds-badge-soft', !minOk);
  }
  if (badgePortada) {
    badgePortada.textContent = `Portada: ${portadaOk ? 'OK' : 'Pendiente'}`;
    badgePortada.classList.toggle('ds-badge-primary', portadaOk);
    badgePortada.classList.toggle('ds-badge-soft', !portadaOk);
  }
};

const renderFotosPreview = () => {
  const preview = document.getElementById('fotos-preview');
  if (!preview) return;

  preview.innerHTML = '';

  actualizarBadgesPaso6();

  fotosOrden.forEach((f, idx) => {




    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:100px;height:100px;border-radius:8px;overflow:hidden;border:1px solid var(--border);cursor:grab;background:var(--bg-secondary)';
    wrap.setAttribute('draggable', 'true');
    wrap.dataset.index = String(idx);

    const isPortada = idx === fotoPortadaIdx;

    wrap.innerHTML = `
      <div style="position:absolute;inset:0">
        <img src="${f.dataUrl}" style="width:100%;height:100%;object-fit:cover">
        <button type="button" data-action="eliminar" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center">✕</button>
        <button type="button" data-action="portada" style="position:absolute;bottom:4px;left:4px;background:${isPortada ? 'var(--primary)' : 'rgba(0,0,0,0.45)'};color:white;border:none;border-radius:10px;padding:3px 8px;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:6px">
          ${isPortada ? '⭐ Portada' : 'Marcar portada'}
        </button>
        ${isPortada ? '<div style="position:absolute;inset:0;border:2px solid rgba(26,71,42,0.9);pointer-events:none"></div>' : ''}
      </div>
    `;

    wrap.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('text/plain', String(idx));
      ev.dataTransfer.effectAllowed = 'move';
    });

    wrap.addEventListener('dragover', (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
    });

    wrap.addEventListener('drop', (ev) => {
      ev.preventDefault();
      const from = Number(ev.dataTransfer.getData('text/plain'));
      const to = idx;
      if (Number.isNaN(from) || from === to) return;
      fotosOrden = arrayMove(fotosOrden, from, to);
      // mantener portada según misma foto: aproximación usando portadaIdx
      if (fotoPortadaIdx === from) fotoPortadaIdx = to;
      else if (from < fotoPortadaIdx && to >= fotoPortadaIdx) fotoPortadaIdx -= 1;
      else if (from > fotoPortadaIdx && to <= fotoPortadaIdx) fotoPortadaIdx += 1;
      renderFotosPreview();
    });

    wrap.addEventListener('click', (ev) => {
      const target = ev.target;
      const actionBtn = target.closest && target.closest('button[data-action]');
      if (!actionBtn) return;
      const action = actionBtn.dataset.action;
      if (action === 'eliminar') {
        eliminarFotoPreview(idx);
      } else if (action === 'portada') {
        fotoPortadaIdx = idx;
        renderFotosPreview();
      }
    });

    preview.appendChild(wrap);
  });
};

const eliminarFotoPreview = (idx) => {
  if (idx < 0 || idx >= fotosOrden.length) return;
  fotosOrden.splice(idx, 1);
  if (fotoPortadaIdx >= fotosOrden.length) fotoPortadaIdx = Math.max(0, fotosOrden.length - 1);
  // limpiar input para que al enviar use el estado actual
  const input = document.getElementById('p-fotos');
  if (input) {
    const dt = new DataTransfer();
    fotosOrden.forEach(x => dt.items.add(x.file));
    input.files = dt.files;
  }
  renderFotosPreview();
};

const arrayMove = (arr, from, to) => {
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
};

window.initFotosPublicar = () => {
  const drop = document.getElementById('p-fotos-drop');
  const input = document.getElementById('p-fotos');
  if (!drop || !input) return;

  ['dragenter', 'dragover'].forEach(evt => {
    drop.addEventListener(evt, (e) => {
      e.preventDefault();
      drop.style.borderColor = 'var(--primary)';
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    drop.addEventListener(evt, (e) => {
      e.preventDefault();
      drop.style.borderColor = 'var(--border)';
    });
  });

  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    const dt = new DataTransfer();
    const files = Array.from(e.dataTransfer.files || []).filter(f => /^image\//.test(f.type)).slice(0, 15);
    files.forEach(f => dt.items.add(f));
    input.files = dt.files;
    previsualizarFotos(input);
  });
};


const cargarMisPropiedades = async () => {
  const container = document.getElementById('mis-props-container');
  const data = await api.get('/propiedades/mis-propiedades');

  if (!data.propiedades || data.propiedades.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px;color:var(--text-light)">
        <div style="font-size:48px;margin-bottom:16px">🏠</div>
        <p style="font-size:16px;margin-bottom:16px">Aún no tienes propiedades publicadas</p>
        <button class="btn btn-primary" onclick="mostrarSeccion('nueva-propiedad')">Publicar mi primera propiedad</button>
      </div>`;
    return;
  }

  const esGrid = container.classList.contains('mis-props-view-grid');
  container.innerHTML = data.propiedades.map(p => `
    <div class="prop-admin-card ${esGrid ? '' : 'prop-admin-card-list'}">
      <div class="prop-admin-img">
        ${p.fotos && p.fotos.length > 0
          ? `<img src="${p.fotos[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`
          : 'Sin foto'}
      </div>
      <div class="prop-admin-info">
        <div class="prop-admin-titulo">${p.titulo}</div>
        <div class="prop-admin-meta">${p.ubicacion.ciudad}, ${p.ubicacion.estado} · ${formatPrecio(p.precio)}</div>
        ${!esGrid ? `<div class="prop-admin-meta" style="margin-top:6px">Estado: <b style="color:var(--text)">${p.status}</b></div>` : ''}
      </div>
      <div class="prop-admin-actions">
        <span class="status-badge status-${p.status}">${p.status}</span>
        <button class="btn btn-outline" style="padding:6px 14px;font-size:13px" onclick="window.location='propiedad.html?id=${p._id}'">Ver</button>
        ${p.status !== 'aprobada' ? `<button class="btn btn-outline" style="padding:6px 14px;font-size:13px" onclick="editarPropiedad('${p._id}')">✏️ Editar</button>` : ''}
        <button class="btn btn-outline" style="padding:6px 14px;font-size:13px;border-color:#e24b4a;color:#e24b4a" onclick="eliminarMiPropiedad('${p._id}','${p.titulo.replace(/'/g,"\\'")}')">🗑️</button>
      </div>
    </div>`).join('');
};
const editarPropiedad = (id) => {
  window.location.href = `propiedad.html?id=${id}&editar=1`;
};

const eliminarMiPropiedad = async (id, titulo) => {
  const ok = await dsConfirm({
    title: '¿Eliminar propiedad?',
    message: `"${titulo}" se eliminará permanentemente. Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar',
    danger: true
  });
  if (!ok) return;
  const data = await api.delete(`/propiedades/${id}`);
  if (data.ok) {
    dsToast({ title: 'Propiedad eliminada', message: `"${titulo}" fue eliminada.`, type: 'success' });
    cargarMisPropiedades();
    cargarResumenUsuario();
  } else {
    dsToast({ title: 'No se pudo eliminar', message: data.error || 'Intenta de nuevo.', type: 'error' });
  }
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
  const ok = await dsConfirm({ title: '¿Quitar favorito?', message: 'Esta propiedad se eliminará de tu lista de favoritos.', confirmText: 'Quitar', danger: true });
  if (!ok) return;
  const data = await api.delete(`/favoritos/${propiedadId}`);
  if (data.ok) {
    document.getElementById(`fav-${propiedadId}`).remove();
    const grid = document.getElementById('favoritos-grid');
    if (!grid.children.length) grid.innerHTML = '<div class="loading">No tienes propiedades favoritas aún.</div>';
  }
};

const cargarMensajes = async () => {
  const lista = document.getElementById('mensajes-lista');
  const data = await api.get('/auth/mensajes');
  if (data.ok) actualizarBadgeMensajes(data.mensajes?.filter(m => !m.leido && m.destinatario?._id === user._id).length || 0);
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
const cargarLeadsUsuario = async () => {
  const lista = document.getElementById('leads-usuario-lista');
  const data = await api.get('/auth/leads');
  if (data.ok) actualizarBadgeMensajes(data.mensajesNoLeidos || 0);
  if (!data.leads || data.leads.length === 0) {
    lista.innerHTML = '<div class="loading">No tienes leads registrados aún.</div>';
    return;
  }
  lista.innerHTML = data.leads.map(lead => {
    const esSoporte = lead.tipo === 'soporte';
    const badgeTipo = esSoporte
      ? `<span class="status-badge" style="background:#eff6ff;color:#1d4ed8">🎧 Soporte</span>`
      : `<span class="status-badge" style="background:#f0fdf4;color:#166534">🏠 Servicio</span>`;
    return `
    <div class="mensaje-card">
      <div class="mensaje-header">
        <span class="mensaje-de">${lead.folio || 'Lead'} · ${lead.servicio || 'Servicio no especificado'}</span>
        <div style="display:flex;gap:6px;align-items:center">
          ${badgeTipo}
          <span class="status-badge status-${lead.status}">${lead.status}</span>
        </div>
      </div>
      <div class="mensaje-texto">${lead.nombre} · ${lead.telefono}${lead.email ? ' · ' + lead.email : ''}</div>
      <div class="mensaje-propiedad">${new Date(lead.createdAt).toLocaleDateString('es-MX')}${lead.ciudad ? ' · ' + lead.ciudad : ''}</div>
    </div>`;
  }).join('');
};

const cargarCuenta = () => {
  const info = document.getElementById('cuenta-info');
  if (!user) return;
  info.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-bottom:32px">
      <div class="form-grupo"><label>Nombre completo</label><input type="text" class="form-input" value="${user.nombre}" disabled></div>
      <div class="form-grupo"><label>Correo electrónico</label><input type="text" class="form-input" value="${user.email}" disabled></div>
      <div class="form-grupo">
        <label>Teléfono</label>
        <div style="display:flex;gap:8px">
          <input type="tel" id="cuenta-telefono" class="form-input" value="${user.telefono || ''}" placeholder="10 dígitos" style="flex:1">
          <button class="btn btn-primary" style="padding:10px 18px;font-size:13px;white-space:nowrap" onclick="guardarTelefono()">Guardar</button>
        </div>
      </div>
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
const guardarTelefono = async () => {
  const telefono = document.getElementById('cuenta-telefono')?.value.trim();
  if (!telefono || telefono.length < 10) {
    dsToast({ title: 'Teléfono inválido', message: 'Ingresa un número de al menos 10 dígitos.', type: 'error' });
    return;
  }
  const data = await api.patch('/auth/perfil', { telefono });
  if (data.ok) {
    const userActualizado = { ...user, telefono };
    localStorage.setItem('user', JSON.stringify(userActualizado));
    dsToast({ title: 'Teléfono actualizado', message: 'Tu número fue guardado correctamente.', type: 'success' });
  } else {
    dsToast({ title: 'No se pudo guardar', message: data.error || 'Intenta de nuevo.', type: 'error' });
  }
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

let publicarPaso = 1;

// expose helpers to global scope (HTML onclick)
window.setPublicarStep = (n) => {
  publicarPaso = Number(n) || 1;
  const max = 7;
  if (publicarPaso < 1) publicarPaso = 1;
  if (publicarPaso > max) publicarPaso = max;

  document.querySelectorAll('.publicar-step-content').forEach(el => {
    const step = Number(el.getAttribute('data-step-content'));
    el.style.display = step === publicarPaso ? 'block' : 'none';
  });

  // progress
  const dots = document.querySelectorAll('#publicar-steps .ds-step');
  dots.forEach(d => {
    const step = Number(d.getAttribute('data-step'));
    d.classList.toggle('active', step === publicarPaso);
    d.disabled = step !== publicarPaso; // evita saltos sin validar
  });

  const bar = document.getElementById('publicar-progress-bar');
  if (bar) {
    const pct = ((publicarPaso - 1) / (max - 1)) * 100;
    bar.style.width = pct + '%';
  }

  // back/next/submit
  const backBtn = document.getElementById('publicar-back-btn');
  const nextBtn = document.getElementById('publicar-next-btn');
  const submitWrap = document.getElementById('publicar-submit-wrap');

  if (backBtn) backBtn.style.display = publicarPaso === 1 ? 'none' : 'inline-flex';

  if (nextBtn) {
    nextBtn.style.display = publicarPaso === 7 ? 'none' : 'inline-flex';
    nextBtn.textContent = publicarPaso === 6 ? 'Revisar →' : 'Siguiente →';
  }

  if (submitWrap) submitWrap.style.display = publicarPaso === 7 ? 'block' : 'none';

  // resumen final en step 7
  if (publicarPaso === 7) {
    cargarResumenFinal();
  }
};

const validarPaso = (paso) => {
  const errorEl = document.getElementById('form-error');
  const setErr = (msg) => {
    const showToast = typeof window.dsToast === 'function';
    if (showToast) window.dsToast({ title: 'Revisa tu publicación', message: msg, type: 'error' });
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    } else {
      dsToast({ title: data.ok ? 'Propiedad guardada' : 'Error', message: msg, type: data.ok ? 'success' : 'error' });
    }
  };




  // limpia si ok
  const clearErr = () => {
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
  };

  const titulo = document.getElementById('p-titulo')?.value?.trim();
  const precio = document.getElementById('p-precio')?.value;
  const operacion = document.getElementById('p-operacion')?.value;
  const tipo = document.getElementById('p-tipo')?.value;
  const descripcion = document.getElementById('p-descripcion')?.value?.trim();
  const estado = document.getElementById('p-estado')?.value;
  const ciudad = document.getElementById('p-ciudad')?.value?.trim();
  const direccion = document.getElementById('p-direccion')?.value?.trim();
  const lat = document.getElementById('p-lat')?.value;
  const lng = document.getElementById('p-lng')?.value;
  const recamaras = Number(document.getElementById('p-recamaras')?.value || 0);
  const banos = Number(document.getElementById('p-banos')?.value || 0);
  const mediosBanos = Number(document.getElementById('p-medios-banos')?.value || 0);
  const estacionamientos = Number(document.getElementById('p-estacionamientos')?.value || 0);
  const m2 = Number(document.getElementById('p-m2')?.value || 0);
  const fotosInput = document.getElementById('p-fotos');
  const fotosCount = fotosInput?.files?.length || 0;

  clearErr();

  switch (paso) {
    case 1:
      if (!titulo) return setErr('Ingresa el título de la propiedad.');
      if (!precio || Number(precio) <= 0) return setErr('Ingresa un precio válido.');
      if (!operacion) return setErr('Selecciona la operación.');
      if (!tipo) return setErr('Selecciona el tipo.');
      return true;
    case 2:
      if (!descripcion) return setErr('Ingresa una descripción.');
      return true;
    case 3:
      if (!estado) return setErr('Selecciona el estado.');
      if (!ciudad) return setErr('Ingresa la ciudad.');
      if (!direccion) return setErr('Ingresa la dirección.');
      return true;
    case 4:
      if (!lat || !lng || Number(lat) === 0 || Number(lng) === 0) return setErr('Selecciona la ubicación exacta en el mapa.');
      return true;
    case 5:
      // se aceptan 0, pero deben ser numéricos (si vienen vacíos se vuelven 0)
      if (Number.isNaN(recamaras) || Number.isNaN(banos) || Number.isNaN(mediosBanos) || Number.isNaN(estacionamientos) || Number.isNaN(m2)) {
        return setErr('Revisa las características (valores inválidos).');
      }
      return true;
    case 6:
      if (fotosCount < 2) return setErr('Agrega al menos 2 fotos para enviar a revisión.');
      // portada dentro de rango
      if (fotoPortadaIdx < 0 || fotoPortadaIdx >= fotosCount) fotoPortadaIdx = 0;
      return true;

    case 7:
      return true;
    default:
      return true;
  }
};

window.publicarNextStep = () => {
  const ok = validarPaso(publicarPaso);
  if (!ok) return;
  if (publicarPaso >= 7) return;

  // loading state simple en el botón para pasos de envío
  const backBtn = document.getElementById('publicar-back-btn');
  const nextBtn = document.getElementById('publicar-next-btn');
  if (publicarPaso === 6 && nextBtn) {
    nextBtn.disabled = true;
    const originalText = nextBtn.textContent;
    nextBtn.textContent = 'Revisar...';
    setTimeout(() => {
      nextBtn.disabled = false;
      nextBtn.textContent = originalText;
      setPublicarStep(publicarPaso + 1);
    }, 350);
    return;
  }

  setPublicarStep(publicarPaso + 1);
};


const publicarPrevStep = () => {
  if (publicarPaso <= 1) return;
  setPublicarStep(publicarPaso - 1);
};

const cargarResumenFinal = () => {
  const el = document.getElementById('publicar-final-summary');
  if (!el) return;

  const titulo = document.getElementById('p-titulo')?.value?.trim() || '—';
  const precio = document.getElementById('p-precio')?.value || '—';
  const operacion = document.getElementById('p-operacion')?.value || '—';
  const tipo = document.getElementById('p-tipo')?.value || '—';
  const descripcion = document.getElementById('p-descripcion')?.value?.trim() || '—';
  const estado = document.getElementById('p-estado')?.value || '—';
  const ciudad = document.getElementById('p-ciudad')?.value?.trim() || '—';
  const lat = document.getElementById('p-lat')?.value || '—';
  const lng = document.getElementById('p-lng')?.value || '—';
  const fotosCount = document.getElementById('p-fotos')?.files?.length || 0;

  const badgeEnvioStatus = document.getElementById('badge-envio-status');
  const badgeEnvioUbic = document.getElementById('badge-envio-ubic');
  const badgeEnvioFotos = document.getElementById('badge-envio-fotos');

  const fotosOk = fotosCount >= 2;
  const ubicOk = lat !== '—' && lng !== '—' && lat !== '' && lng !== '';

  if (badgeEnvioStatus) {
    const ok = fotosOk && ubicOk;
    badgeEnvioStatus.textContent = `Estado: ${ok ? 'Listo' : 'Pendiente'}`;
    badgeEnvioStatus.classList.toggle('ds-badge-primary', ok);
    badgeEnvioStatus.classList.toggle('ds-badge-soft', !ok);
  }
  if (badgeEnvioUbic) badgeEnvioUbic.textContent = `Ubicación: ${ubicOk ? 'OK' : 'Pendiente'}`;
  if (badgeEnvioFotos) badgeEnvioFotos.textContent = `Fotos: ${fotosCount} (${fotosOk ? 'OK' : 'mín. 2'})`;


  el.innerHTML = `
    <div style="font-weight:800;margin-bottom:10px">Resumen final</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px">
      <div><b>Título:</b> ${titulo}</div>
      <div><b>Precio:</b> ${precio}</div>
      <div><b>Operación:</b> ${operacion}</div>
      <div><b>Tipo:</b> ${tipo}</div>
      <div style="grid-column:1/-1"><b>Descripción:</b> ${descripcion.slice(0, 140)}${descripcion.length > 140 ? '…' : ''}</div>
      <div><b>Estado:</b> ${estado}</div>
      <div><b>Ciudad:</b> ${ciudad}</div>
      <div><b>Lat/Lng:</b> ${lat}, ${lng}</div>
      <div style="grid-column:1/-1"><b>Fotos:</b> ${fotosCount} foto(s)</div>
    </div>
    <div style="margin-top:14px;color:var(--text-light);font-size:12px">Al enviar, la publicación se crea en estado <b>revisión</b>.</div>
  `;
};


const publicarPropiedad = async () => {
  const errorEl = document.getElementById('form-error');
  const successEl = document.getElementById('form-success');
  errorEl.style.display = 'none';
  successEl.style.display = 'none';

  const showToast = (payload) => {
    if (typeof window.dsToast === 'function') window.dsToast(payload);
  };


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
  const mediosBanos = document.getElementById('p-medios-banos').value;
  const estacionamientos = document.getElementById('p-estacionamientos').value;
  const m2 = document.getElementById('p-m2').value;
  const lat = document.getElementById('p-lat').value;
  const lng = document.getElementById('p-lng').value;

  if (!titulo || !precio || !operacion || !tipo || !descripcion || !estado || !ciudad) {
    const msg = 'Por favor llena todos los campos obligatorios (*)';
    errorEl.textContent = msg;

    errorEl.style.display = 'block';
    if (typeof window.dsToast === 'function') {
      window.dsToast({ title: 'Faltan datos', message: msg, type: 'error' });
    }
    return;
  }


  const body = {
    titulo, precio: Number(precio), operacion, tipo, descripcion,
    ubicacion: { estado, ciudad, colonia, direccion, lat: lat ? parseFloat(lat) : null, lng: lng ? parseFloat(lng) : null },
caracteristicas: {
    recamaras: Number(recamaras) || 0,
    banos: Number(banos) || 0,
    mediosBanos: Number(mediosBanos) || 0,
    estacionamientos: Number(estacionamientos) || 0,
    m2: Number(m2) || 0
  }
  };


  const btn = document.querySelector('#sec-nueva-propiedad .btn-primary');
  if (btn) {
    btn.textContent = 'Enviando...';
    btn.disabled = true;
  }

  showToast({ title: 'Enviando', message: 'Tu publicación se está enviando a revisión.', type: 'info', duration: 2200 });



  const data = await api.post('/propiedades', body);

  if (data.ok) {
    const fotosInput = document.getElementById('p-fotos');
    if (fotosInput.files.length > 0) {
      const formData = new FormData();
      // enviar en el orden seleccionado; foto portada al inicio
      const ordered = fotosOrden && fotosOrden.length ? fotosOrden.slice() : Array.from(fotosInput.files).map(file => ({ file }));
      if (ordered.length > 0 && fotoPortadaIdx >= 0 && fotoPortadaIdx < ordered.length) {
        const portada = ordered.splice(fotoPortadaIdx, 1)[0];
        ordered.unshift(portada);
      }
      ordered.forEach(x => formData.append('fotos', x.file));
      await api.postForm(`/propiedades/${data.propiedad._id}/fotos`, formData);
    }

    successEl.textContent = '¡Propiedad enviada a revisión exitosamente!';
    successEl.style.display = 'block';
    if (btn) {
      btn.textContent = 'Enviar a revisión';
      btn.disabled = false;
    }
    showToast({ title: 'Enviado', message: 'Propiedad enviada a revisión exitosamente.', type: 'success' });

    setTimeout(() => mostrarSeccion('mis-propiedades'), 2000);
  } else {
    errorEl.textContent = data.error || 'Error al publicar la propiedad';
    errorEl.style.display = 'block';
    if (btn) {
      btn.textContent = 'Enviar a revisión';
      btn.disabled = false;
    }
    showToast({ title: 'Error', message: errorEl.textContent, type: 'error' });
  }
};

