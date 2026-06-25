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

// Get filters from state
const obtenerFiltros = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    operacion: filtrosActuales.operacion || (params.get('operacion') || ''),
    tipo: filtrosActuales.tipo || (params.get('tipo') || ''),
    estado: filtrosActuales.estado || (params.get('estado') || ''),
    ciudad: filtrosActuales.ciudad || (params.get('ciudad') || ''),
    precioMin: filtrosActuales.precioMin || (params.get('precioMin') || ''),
    precioMax: filtrosActuales.precioMax || (params.get('precioMax') || ''),
    recamaras: filtrosActuales.recamaras || (params.get('recamaras') || ''),
    banos: filtrosActuales.banos || (params.get('banos') || ''),
    m2Min: filtrosActuales.m2Min || (params.get('m2Min') || ''),
    m2Max: filtrosActuales.m2Max || (params.get('m2Max') || ''),
    orden: filtrosActuales.orden || '-createdAt',
    pagina: paginaActual,
    limite: 15
  };
};

// Load properties from API
const cargarPropiedades = async () => {
  const grid = document.getElementById('properties-grid');
  const totalEl = document.getElementById('total-resultados');
  grid.innerHTML = '<div class="loading">Cargando propiedades...</div>';

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

// Render pagination
const renderPaginacion = (totalPaginas) => {
  const paginacion = document.getElementById('paginacion');
  if (totalPaginas <= 1) { paginacion.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= totalPaginas; i++) {
    html += `<button class="${i === paginaActual ? 'active' : ''}" onclick="irPagina(${i})">${i}</button>`;
  }
  paginacion.innerHTML = html;
};

// Go to page
const irPagina = (pagina) => {
  paginaActual = pagina;
  cargarPropiedades();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Apply filters and reload
const aplicarFiltros = () => {
  paginaActual = 1;
  cargarPropiedades();
};

// ===========================================
// PREMIUM FILTER FUNCTIONS
// ===========================================

// Toggle filter popover
const toggleFilterPopover = (filterType) => {
  const popover = document.getElementById(`filter-popover-${filterType}`);
  const chip = document.querySelector(`.sticky-chip[data-filter="${filterType}"]`);

  document.querySelectorAll('.filter-popover-container').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sticky-chip').forEach(c => c.classList.remove('active'));

  if (popover) {
    popover.classList.toggle('active');
    if (popover.classList.contains('active') && chip) {
      chip.classList.add('active');
    }
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
  if (type === 'estado') {
    filtrosActuales.estado = document.getElementById('f-estado')?.value || '';
    actualizarChipLabel('ubicacion');
  } else if (type === 'precio') {
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
    case 'operacion':
      chipId = 'chip-operacion';
      label = filtrosActuales.operacion ? `🏠 ${filtrosActuales.operacion === 'renta' ? 'Renta' : 'Venta'}` : '🏠 Operación';
      break;
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
};

// ===========================================
// FILTER STATE MANAGEMENT
// ===========================================

// Clean all filters
const limpiarFiltros = () => {
  Object.keys(filtrosActuales).forEach(key => {
    if (key === 'precioMax') filtrosActuales[key] = 100000000;
    else if (key === 'm2Max') filtrosActuales[key] = 1000;
    else if (key === 'orden') filtrosActuales[key] = '-createdAt';
    else filtrosActuales[key] = '';
  });

  // Close panel
  closeAdvancedPanel();

  // Reset visual state
  document.querySelectorAll('.checkbox-option.selected, .radio-option.selected').forEach(el => el.classList.remove('selected'));
  const advEstado = document.getElementById('adv-estado');
  const advCiudad = document.getElementById('adv-ciudad');
  const advColonia = document.getElementById('adv-colonia');
  if (advEstado) advEstado.value = '';
  if (advCiudad) advCiudad.value = '';
  if (advColonia) advColonia.value = '';

  // Update chip labels
  ['ubicacion', 'operacion', 'tipo', 'precio', 'recamaras'].forEach(actualizarChipLabel);

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

  // Update chip labels
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

  // Close popovers when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.sticky-chip') && !e.target.closest('.filter-popover-container')) {
      closeAllFilterPopovers();
    }
  });
});