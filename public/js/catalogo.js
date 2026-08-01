let paginaActual = 1;

// Current filter state - premium filters
const filtrosActuales = {
  estado: '',
  ciudad: '',
  colonia: '',
  operacion: '',
  tipo: '',
  precioMin: 0,
  precioMax: 100000000,
  recamaras: '',
  banos: '',
  m2Min: 0,
  m2Max: 1000,
  orden: '-createdAt'
};

// Format price value
const formatPrecioCorto = (valor) => {
  if (valor >= 1000000) return `$${(valor/1000000).toFixed(1)}M`;
  if (valor >= 1000) return `$${(valor/1000).toFixed(0)}K`;
  return `$${valor}`;
};

const obtenerFiltros = () => {
  const f = filtrosActuales;
  return {
    operacion: f.operacion || '',
    tipo: f.tipo || '',
    estado: f.estado || '',
    ciudad: f.ciudad || '',
    // precioMin solo se manda si es mayor a 0
    precioMin: f.precioMin > 0 ? f.precioMin : '',
    // precioMax solo se manda si es menor al máximo absoluto
    precioMax: f.precioMax < 100000000 ? f.precioMax : '',
    recamaras: f.recamaras || '',
    banos: f.banos || '',
    m2Min: f.m2Min > 0 ? f.m2Min : '',
    m2Max: f.m2Max < 1000 ? f.m2Max : '',
    orden: f.orden || '-createdAt',
    pagina: paginaActual,
    limite: 15
  };
};

// Load properties from API
const cargarPropiedades = async () => {
  const grid = document.getElementById('properties-grid');
  const totalEl = document.getElementById('total-resultados');
  grid.innerHTML = '<div class="loading">Cargando propiedades...</div>';

  renderChipsActivos();

  const filtros = obtenerFiltros();
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([k, v]) => { if (v) params.append(k, v); });

  const data = await api.get(`/propiedades?${params.toString()}`);

  if (!data.propiedades || data.propiedades.length === 0) {
    grid.innerHTML = '<div class="loading">No se encontraron propiedades con esos filtros.</div>';
    totalEl.textContent = '0 propiedades encontradas';
    document.getElementById('paginacion').innerHTML = '';
    return;
  }

  totalEl.textContent = `${data.total} propiedad${data.total !== 1 ? 'es' : ''} encontrada${data.total !== 1 ? 's' : ''}`;
  grid.innerHTML = data.propiedades.map(crearCardPropiedad).join('');
  renderPaginacion(data.paginas);
};

// ==========================================
// PAGINACIÓN CON FLECHAS Y PUNTOS SUSPENSIVOS
// ==========================================

// Render pagination
const renderPaginacion = (totalPaginas) => {
  const paginacion = document.getElementById('paginacion');
  if (totalPaginas <= 1) { paginacion.innerHTML = ''; return; }
  
  let html = '';

  // 1. Flecha Izquierda ‹
  html += `<button ${paginaActual === 1 ? 'disabled' : ''} onclick="irPagina(${paginaActual - 1})">‹</button>`;

  // 2. Lógica para mostrar solo un bloque de páginas y puntos suspensivos
  let inicio = 1;
  let fin = totalPaginas;

  if (totalPaginas > 7) {
    inicio = Math.max(1, paginaActual - 2);
    fin = Math.min(totalPaginas, inicio + 4);
    if (fin - inicio < 4) inicio = Math.max(1, fin - 4);
  }

  // Puntos y primer número al inicio
  if (inicio > 1) {
    html += `<button class="${1 === paginaActual ? 'active' : ''}" onclick="irPagina(1)">1</button>`;
    if (inicio > 2) {
      html += `<span class="pag-puntos">...</span>`;
    }
  }

  // Bloque de números del medio
  for (let i = inicio; i <= fin; i++) {
    html += `<button class="${i === paginaActual ? 'active' : ''}" onclick="irPagina(${i})">${i}</button>`;
  }

  // Puntos y último número al final
  if (fin < totalPaginas) {
    if (fin < totalPaginas - 1) {
      html += `<span class="pag-puntos">...</span>`;
    }
    html += `<button class="${totalPaginas === paginaActual ? 'active' : ''}" onclick="irPagina(${totalPaginas})">${totalPaginas}</button>`;
  }

  // 3. Flecha Derecha ›
  html += `<button ${paginaActual === totalPaginas ? 'disabled' : ''} onclick="irPagina(${paginaActual + 1})">›</button>`;

  paginacion.innerHTML = html;
};

// Go to page
const irPagina = (pagina) => {
  // Validar que la página a la que quiere ir no sea menor a 1 (por la flecha izquierda)
  if (pagina < 1) return;
  paginaActual = pagina;
  cargarPropiedades();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Apply filters and reload
const aplicarFiltros = () => {
  paginaActual = 1;
  cargarPropiedades();
  registrarBusquedaReciente();
};

let _busquedaRecienteTimeout = null;
const registrarBusquedaReciente = () => {
  if (typeof auth === 'undefined' || !auth.isLoggedIn || !auth.isLoggedIn()) return;
  clearTimeout(_busquedaRecienteTimeout);
  _busquedaRecienteTimeout = setTimeout(async () => {
    const f = filtrosActuales;
    if (!f.estado && !f.ciudad && !f.operacion && !f.tipo && (!f.precioMax || f.precioMax >= 100000000)) return;
    try {
      await api.post('/propiedades/registrar-busqueda', {
        estado: f.estado || '',
        ciudad: f.ciudad || '',
        operacion: f.operacion || '',
        tipo: f.tipo || '',
        precioMax: (f.precioMax && f.precioMax < 100000000) ? f.precioMax : null
      });
    } catch (e) { /* silencioso: no es crítico para la navegación del catálogo */ }
  }, 1200);
};

// ===========================================
// PREMIUM FILTER FUNCTIONS
// ===========================================

// Toggle filter popover
const toggleFilterPopover = (filterType) => {
  const popover = document.getElementById(`filter-popover-${filterType}`);
  const chip = document.querySelector(`.sticky-chip[data-filter="${filterType}"]`);
  if (!popover || !chip) return;

  const yaEstabaActivo = popover.classList.contains('active');

  document.querySelectorAll('.filter-popover-container').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sticky-chip').forEach(c => c.classList.remove('active'));

  if (!yaEstabaActivo) {
    const rect = chip.getBoundingClientRect();
    popover.style.position = 'fixed';
    popover.style.top = (rect.bottom + 8) + 'px';
    popover.style.left = rect.left + 'px';
    popover.style.margin = '0';

    popover.classList.add('active');
    chip.classList.add('active');
  }
};

// Close all filter popovers
const closeAllFilterPopovers = () => {
  document.querySelectorAll('.filter-popover-container').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sticky-chip').forEach(c => c.classList.remove('active'));
};

// Toggle filter radio (single select)
const toggleFilterRadio = (filterType) => {
  toggleFilterPopover(filterType);
};

// Select quick radio option
const selectQuickRadio = (element, type) => {
  const container = element.parentElement;
  container.querySelectorAll('.radio-option').forEach(opt => opt.classList.remove('selected'));
  element.classList.add('selected');

  filtrosActuales[type] = element.dataset.value;
  actualizarChipLabel(type);
  closeAllFilterPopovers();
  aplicarFiltros();
};

// Selección múltiple de estado en el popover de ubicación del catálogo (igual que en inicio)
const toggleEstadoCatalogo = (element) => {
  element.classList.toggle('selected');
  const seleccionados = Array.from(document.querySelectorAll('#opciones-estado-catalogo .popover-option.selected'))
    .map(el => el.dataset.value);
  filtrosActuales.estado = seleccionados.join(',');
  actualizarChipLabel('ubicacion');
  aplicarFiltros();
};

// Buscador dentro de la lista de estados
const filterEstadosCatalogo = (query) => {
  const opciones = document.querySelectorAll('#opciones-estado-catalogo .popover-option');
  const q = query.toLowerCase();
  opciones.forEach(opt => {
    opt.style.display = opt.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
};

// Recámaras: selección única (1+, 2+, 3+ o 4+), no acumulable. Click de nuevo para quitar.
const selectQuickRecamaras = (element) => {
  const yaSeleccionado = element.classList.contains('selected');
  const popover = element.closest('.filter-popover-container');
  popover.querySelectorAll('.checkbox-option').forEach(el => el.classList.remove('selected'));

  filtrosActuales.recamaras = yaSeleccionado ? '' : element.dataset.value;
  if (!yaSeleccionado) element.classList.add('selected');

  actualizarChipLabel('recamaras');
  aplicarFiltros();
};

// Misma lógica para el panel avanzado (sin auto-aplicar; espera al botón "Ver resultados")
const selectAdvRecamaras = (element) => {
  const yaSeleccionado = element.classList.contains('selected');
  const contenedor = element.closest('.accordion-content');
  contenedor.querySelectorAll('.checkbox-option').forEach(el => el.classList.remove('selected'));

  filtrosActuales.recamaras = yaSeleccionado ? '' : element.dataset.value;
  if (!yaSeleccionado) element.classList.add('selected');

  actualizarChipLabel('recamaras');
};

// Toggle quick checkbox option (multi-select) — SOLO dentro de su propio popover
const toggleQuickCheckbox = (element, type) => {
  element.classList.toggle('selected');

  const popover = element.closest('.filter-popover-container');
  const selected = Array.from(popover.querySelectorAll('.checkbox-option.selected[data-value]'))
    .map(el => el.dataset.value);

  filtrosActuales[type] = selected.join(',');
  actualizarChipLabel(type);
  aplicarFiltros();
};

// Update quick dual range slider
const updateQuickDualRange = (type) => {
  const minInput = document.getElementById(`f-${type}-min`);
  const maxInput = document.getElementById(`f-${type}-max`);
  const minLabel = document.getElementById(`label-cat-${type}-min`);
  const maxLabel = document.getElementById(`label-cat-${type}-max`);
  const fill = document.getElementById(`${type}-fill`);

  if (minInput && maxInput && minLabel && maxLabel) {
    const min = parseInt(minInput.value);
    const max = parseInt(maxInput.value);
    const maxRange = parseInt(maxInput.max);

    filtrosActuales[type === 'precio' ? 'precioMin' : 'm2Min'] = min;
    filtrosActuales[type === 'precio' ? 'precioMax' : 'm2Max'] = max;

    if (type === 'precio') {
      minLabel.textContent = formatPrecioCorto(min);
      maxLabel.textContent = formatPrecioCorto(max);

      const left = (min / maxRange) * 100;
      const right = (max / maxRange) * 100;
      if (fill) fill.style.left = left + '%';
      if (fill) fill.style.width = (right - left) + '%';
    }
  }
};

// Apply quick filter
const applyQuickFilter = (type) => {
  if (type === 'precio') {
    filtrosActuales.precioMin = parseInt(document.getElementById('f-precio-min')?.value || 0);
    filtrosActuales.precioMax = parseInt(document.getElementById('f-precio-max')?.value || 100000000);
    actualizarChipLabel('precio');
  }
  closeAllFilterPopovers();
  aplicarFiltros();
};

// Update chip label display
const actualizarChipLabel = (type) => {
  let label = '';
  let chipId = '';

  switch(type) {
    case 'ubicacion':
      chipId = 'chip-ubicacion';
      label = filtrosActuales.estado ? `📍 ${filtrosActuales.estado}` : '📍 Ubicación';
      break;
    case 'operacion': {
      chipId = 'chip-operacion';
      if (!filtrosActuales.operacion) {
        label = '🏠 Operación';
      } else {
        const nombres = filtrosActuales.operacion.split(',').map(v => v === 'renta' ? 'Renta' : 'Venta');
        label = `🏠 ${nombres.join(' y ')}`;
      }
      break;
    }
    case 'tipo':
      chipId = 'chip-tipo';
      label = filtrosActuales.tipo ? `🏡 ${filtrosActuales.tipo.split(',').length} seleccionado(s)` : '🏡 Tipo';
      break;
    case 'precio':
      chipId = 'chip-precio';
      label = `${formatPrecioCorto(filtrosActuales.precioMin)} - ${formatPrecioCorto(filtrosActuales.precioMax)}`;
      break;
    case 'recamaras':
      chipId = 'chip-recamaras';
      label = filtrosActuales.recamaras ? `🛏 ${filtrosActuales.recamaras}+` : '🛏 Recámaras';
      break;
  }

  const chip = document.getElementById(chipId);
  if (chip) chip.textContent = label;
};

// ===========================================
// CHIPS ACTIVOS (con botón para quitar individual)
// ===========================================
const renderChipsActivos = () => {
  const container = document.getElementById('catalogo-chips');
  if (!container) return;

  let chips = [];
  const tipoLabels = { casa: 'Casa', departamento: 'Depto', terreno: 'Terreno', local: 'Local' };

  (filtrosActuales.estado || '').split(',').filter(Boolean).forEach(e => {
    chips.push(`<div class="chip">📍 ${e} <button class="chip-remove" onclick="quitarValorFiltro('estado','${e}')">×</button></div>`);
  });

  (filtrosActuales.operacion || '').split(',').filter(Boolean).forEach(o => {
    const nombre = o === 'renta' ? 'Renta' : 'Venta';
    chips.push(`<div class="chip">🏠 ${nombre} <button class="chip-remove" onclick="quitarValorFiltro('operacion','${o}')">×</button></div>`);
  });

  (filtrosActuales.tipo || '').split(',').filter(Boolean).forEach(t => {
    chips.push(`<div class="chip">🏡 ${tipoLabels[t] || t} <button class="chip-remove" onclick="quitarValorFiltro('tipo','${t}')">×</button></div>`);
  });

  if (filtrosActuales.precioMin > 0 || filtrosActuales.precioMax < 100000000) {
    chips.push(`<div class="chip">💰 ${formatPrecioCorto(filtrosActuales.precioMin)} - ${formatPrecioCorto(filtrosActuales.precioMax)} <button class="chip-remove" onclick="quitarValorFiltro('precio')">×</button></div>`);
  }

  if (filtrosActuales.recamaras) {
    chips.push(`<div class="chip">🛏 ${filtrosActuales.recamaras}+ <button class="chip-remove" onclick="quitarValorFiltro('recamaras')">×</button></div>`);
  }

  if (filtrosActuales.ciudad) {
    chips.push(`<div class="chip">🏙 ${filtrosActuales.ciudad} <button class="chip-remove" onclick="quitarValorFiltro('ciudad')">×</button></div>`);
  }

  if (chips.length > 0) {
    chips.push(`<span class="chip-clear" onclick="limpiarFiltros()">Limpiar todo</span>`);
  }

  container.innerHTML = chips.join('');
};

// Quita un valor específico de un filtro (multi-select) o el filtro completo (single)
const quitarValorFiltro = (tipo, valor) => {
  if (tipo === 'estado' || tipo === 'operacion' || tipo === 'tipo') {
    filtrosActuales[tipo] = (filtrosActuales[tipo] || '')
      .split(',').filter(Boolean).filter(v => v !== valor).join(',');

    document.querySelectorAll(`.checkbox-option[data-value="${valor}"]`).forEach(el => {
      const onclickAttr = el.getAttribute('onclick') || '';
      if (onclickAttr.includes(`'${tipo}'`)) el.classList.remove('selected');
    });

    if (tipo === 'estado') {
      document.querySelectorAll(`#opciones-estado-catalogo .popover-option[data-value="${valor}"]`).forEach(el => el.classList.remove('selected'));
      const advEstado = document.getElementById('adv-estado');
      if (advEstado && advEstado.value === valor) advEstado.value = '';
    }
  } else if (tipo === 'precio') {
    filtrosActuales.precioMin = 0;
    filtrosActuales.precioMax = 100000000;
    const fMin = document.getElementById('f-precio-min');
    const fMax = document.getElementById('f-precio-max');
    const advMin = document.getElementById('adv-precio-min');
    const advMax = document.getElementById('adv-precio-max');
    if (fMin) fMin.value = 0;
    if (fMax) fMax.value = 100000000;
    if (advMin) advMin.value = 0;
    if (advMax) advMax.value = 100000000;
  } else if (tipo === 'recamaras') {
    filtrosActuales.recamaras = '';
    document.querySelectorAll(`.checkbox-option.selected`).forEach(el => {
      const onclickAttr = el.getAttribute('onclick') || '';
      if (onclickAttr.includes('Recamaras(')) el.classList.remove('selected');
    });
  } else if (tipo === 'ciudad') {
    filtrosActuales.ciudad = '';
    const advCiudad = document.getElementById('adv-ciudad');
    if (advCiudad) advCiudad.value = '';
  }

  ['ubicacion', 'operacion', 'tipo', 'precio', 'recamaras'].forEach(actualizarChipLabel);
  window.history.replaceState({}, document.title, window.location.pathname);
  aplicarFiltros();
};

// ===========================================
// ADVANCED PANEL FUNCTIONS
// ===========================================

// Open advanced panel
const openAdvancedPanel = () => {
  document.getElementById('advanced-panel')?.classList.add('active');
  document.body.style.overflow = 'hidden';
};

// Close advanced panel
const closeAdvancedPanel = (event) => {
  if (!event || event.target === document.getElementById('advanced-panel')) {
    document.getElementById('advanced-panel')?.classList.remove('active');
    document.body.style.overflow = '';
  }
};

// Toggle accordion
const toggleAccordion = (header) => {
  header.parentElement.classList.toggle('open');
};

// Update advanced dual range
const updateAdvDualRange = (type) => {
  if (type === 'precio') {
    const min = parseInt(document.getElementById('adv-precio-min')?.value || 0);
    const max = parseInt(document.getElementById('adv-precio-max')?.value || 100000000);
    filtrosActuales.precioMin = min;
    filtrosActuales.precioMax = max;
    document.getElementById('adv-precio-min-label').textContent = formatPrecioCorto(min);
    document.getElementById('adv-precio-max-label').textContent = formatPrecioCorto(max);
  } else if (type === 'm2') {
    const min = parseInt(document.getElementById('adv-m2-min')?.value || 0);
    const max = parseInt(document.getElementById('adv-m2-max')?.value || 1000);
    filtrosActuales.m2Min = min;
    filtrosActuales.m2Max = max;
    document.getElementById('adv-m2-min-label').textContent = min + 'm²';
    document.getElementById('adv-m2-max-label').textContent = max + 'm²';
  }
};

// Advanced: ubicación (estado/ciudad/colonia) — conecta los campos al estado de filtros
const updateAdvUbicacion = () => {
  filtrosActuales.estado = document.getElementById('adv-estado')?.value || '';
  filtrosActuales.ciudad = document.getElementById('adv-ciudad')?.value.trim() || '';
  filtrosActuales.colonia = document.getElementById('adv-colonia')?.value.trim() || '';
  actualizarChipLabel('ubicacion');
};

// Advanced radio selection
const selectAdvRadio = (element, type) => {
  const container = element.parentElement;
  container.querySelectorAll('.radio-option').forEach(opt => opt.classList.remove('selected'));
  element.classList.add('selected');
  filtrosActuales[type] = element.dataset.value;
  if (type === 'operacion') actualizarChipLabel('operacion');
};

// Advanced checkbox toggle — SOLO dentro de su propio acordeón
const toggleAdvCheckbox = (element, type) => {
  element.classList.toggle('selected');

  const contenedor = element.closest('.accordion-content');
  const selected = Array.from(contenedor.querySelectorAll('.checkbox-option.selected[data-value]'))
    .map(el => el.dataset.value);

  filtrosActuales[type] = selected.join(',');
  if (type === 'tipo') actualizarChipLabel('tipo');
  if (type === 'recamaras') actualizarChipLabel('recamaras');
  if (type === 'operacion') actualizarChipLabel('operacion');
};

// ===========================================
// FILTER STATE MANAGEMENT
// ===========================================

const limpiarFiltros = () => {
  Object.keys(filtrosActuales).forEach(key => {
    if (key === 'precioMax') filtrosActuales[key] = 100000000;
    else if (key === 'm2Max') filtrosActuales[key] = 1000;
    else if (key === 'orden') filtrosActuales[key] = '-createdAt';
    else filtrosActuales[key] = '';
  });

  closeAdvancedPanel();
  closeAllFilterPopovers();

  document.querySelectorAll('.checkbox-option.selected, .radio-option.selected').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('#opciones-estado-catalogo .popover-option.selected').forEach(el => el.classList.remove('selected'));
  const advEstado = document.getElementById('adv-estado');
  const advCiudad = document.getElementById('adv-ciudad');
  const advColonia = document.getElementById('adv-colonia');
  if (advEstado) advEstado.value = '';
  if (advCiudad) advCiudad.value = '';
  if (advColonia) advColonia.value = '';

  const precioMin = document.getElementById('f-precio-min');
  const precioMax = document.getElementById('f-precio-max');
  if (precioMin) precioMin.value = 0;
  if (precioMax) precioMax.value = 100000000;

  ['ubicacion', 'operacion', 'tipo', 'precio', 'recamaras'].forEach(actualizarChipLabel);

  const chipsContainer = document.getElementById('catalogo-chips');
  if (chipsContainer) chipsContainer.innerHTML = '';

  window.history.replaceState({}, document.title, window.location.pathname);

  aplicarFiltros();
};

// Load filters from URL
const cargarFiltrosDesdeURL = () => {
  const params = new URLSearchParams(window.location.search);

  filtrosActuales.operacion = params.get('operacion') || '';
  filtrosActuales.tipo = params.get('tipo') || '';
  filtrosActuales.estado = params.get('estado') || '';
  filtrosActuales.ciudad = params.get('ciudad') || '';
  filtrosActuales.precioMin = parseInt(params.get('precioMin') || 0);
  filtrosActuales.precioMax = parseInt(params.get('precioMax') || 100000000);
  filtrosActuales.recamaras = params.get('recamaras') || '';
  filtrosActuales.banos = params.get('banos') || '';

  ['ubicacion', 'operacion', 'tipo', 'precio', 'recamaras'].forEach(actualizarChipLabel);
};

// ===========================================
// DOM READY
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
  cargarFiltrosDesdeURL();
  cargarPropiedades();
  actualizarNavbar();

  const ordenSelect = document.getElementById('f-orden');
  if (ordenSelect) {
    ordenSelect.addEventListener('change', () => {
      filtrosActuales.orden = ordenSelect.value;
      aplicarFiltros();
    });
  }

  const advEstado = document.getElementById('adv-estado');
  const advCiudad = document.getElementById('adv-ciudad');
  const advColonia = document.getElementById('adv-colonia');
  if (advEstado) advEstado.addEventListener('change', updateAdvUbicacion);
  if (advCiudad) advCiudad.addEventListener('input', updateAdvUbicacion);
  if (advColonia) advColonia.addEventListener('input', updateAdvUbicacion);

  const toggle = document.getElementById('nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  const navActions = document.querySelector('.nav-actions');
  if (toggle) {
    toggle.addEventListener('click', () => {
      navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
      navActions.style.display = navActions.style.display === 'flex' ? 'none' : 'flex';
    });
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.sticky-chip') && !e.target.closest('.filter-popover-container')) {
      closeAllFilterPopovers();
    }
  });

  cargarEstadosDisponibles();
});

const cargarEstadosDisponibles = async () => {
  try {
    const data = await api.get('/propiedades/estados/disponibles');
    if (!data.ok || !data.estados?.length) return;

    const lista = document.getElementById('opciones-estado-catalogo');
    const listaAdv = document.getElementById('adv-estado');
    if (!lista) return;

    lista.innerHTML = data.estados.map(e => `
      <div class="popover-option" data-value="${e._id}" onclick="toggleEstadoCatalogo(this)">
        ${e._id} <span style="font-size:11px;color:var(--text-light);margin-left:4px">(${e.total})</span>
      </div>`).join('');

    if (listaAdv) {
      const opcionTodas = listaAdv.querySelector('option[value=""]');
      const opcionesAnteriores = Array.from(listaAdv.options).slice(1);
      data.estados.forEach(e => {
        const existe = opcionesAnteriores.some(o => o.value === e._id);
        if (!existe) {
          const opt = document.createElement('option');
          opt.value = e._id;
          opt.textContent = e._id;
          listaAdv.appendChild(opt);
        }
      });
    }
  } catch (e) {}
};