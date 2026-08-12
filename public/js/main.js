// ==================== PREMIUM SEARCH SYSTEM ====================

// Estado de filtros
const filtrosActivos = {
  estado: [],
  operacion: [],
  tipo: [],
  precioMin: 0,
  precioMax: 100000000,
  credito: []
};

// ==================== POPOVER SYSTEM ====================
const openPopover = (popoverId, triggerElement) => {
  closeAllPopovers();
  const popover = document.getElementById(popoverId);
  const overlay = document.getElementById('popover-overlay');
  if (!popover || !overlay) return;

  const searchBar = document.getElementById('search-bar');
  const searchRect = searchBar.getBoundingClientRect();

  popover.style.top = (searchRect.bottom + 8) + 'px';
  popover.style.left = searchRect.left + 'px';
  popover.style.width = searchRect.width + 'px';

  overlay.classList.add('active');
  popover.classList.add('active');
  triggerElement.classList.add('active');
};

const closeAllPopovers = () => {
  const overlay = document.getElementById('popover-overlay');
  const popovers = document.querySelectorAll('.popover');
  const fields = document.querySelectorAll('.search-bar-field');

  overlay?.classList.remove('active');
  popovers.forEach(p => p.classList.remove('active'));
  fields.forEach(f => f.classList.remove('active'));
};

// ==================== FILTER FUNCTIONS ====================

const toggleOption = (element, filterType) => {
  const value = element.getAttribute('data-value');
  element.classList.toggle('selected');

  if (element.classList.contains('selected')) {
    if (!filtrosActivos[filterType].includes(value)) {
      filtrosActivos[filterType].push(value);
    }
  } else {
    filtrosActivos[filterType] = filtrosActivos[filterType].filter(v => v !== value);
  }

  updateLabels();
  renderChips();
};

const selectRadio = (element, filterType) => {
  const parent = element.parentElement;
  parent.querySelectorAll('.radio-option').forEach(opt => opt.classList.remove('selected'));
  element.classList.add('selected');

  filtrosActivos[filterType] = element.getAttribute('data-value');
  updateLabels();
  renderChips();
  closeAllPopovers();
};

const toggleCheckbox = (element, filterType) => {
  const value = element.getAttribute('data-value');
  element.classList.toggle('selected');

  if (element.classList.contains('selected')) {
    if (!filtrosActivos[filterType].includes(value)) {
      filtrosActivos[filterType].push(value);
    }
  } else {
    filtrosActivos[filterType] = filtrosActivos[filterType].filter(v => v !== value);
  }

  updateLabels();
  renderChips();
};

const filterEstados = (query) => {
  const options = document.querySelectorAll('#opciones-estado .popover-option');
  const lowerQuery = query.toLowerCase();
  options.forEach(opt => {
    opt.style.display = opt.textContent.toLowerCase().includes(lowerQuery) ? '' : 'none';
  });
};

// ==================== DUAL RANGE SLIDER ====================
const updateDualRange = (type) => {
  const minInput = document.getElementById(`${type}-min`);
  const maxInput = document.getElementById(`${type}-max`);
  const minLabel = document.getElementById(`${type}-min-label`);
  const maxLabel = document.getElementById(`${type}-max-label`);
  const fill = document.getElementById(`${type}-fill`);

  if (!minInput || !maxInput) return;

  let min = parseInt(minInput.value);
  let max = parseInt(maxInput.value);

  if (min > max) { min = max; minInput.value = min; }

  if (minLabel) minLabel.textContent = formatPrecioCortoCorto(min);
  if (maxLabel) maxLabel.textContent = formatPrecioCortoCorto(max);

  if (fill) {
    const range = 100000000;
    const left = (min / range) * 100;
    const width = ((max - min) / range) * 100;
    fill.style.left = left + '%';
    fill.style.width = width + '%';
  }

  filtrosActivos[`${type}Min`] = min;
  filtrosActivos[`${type}Max`] = max;

  renderChips();
};

const syncDualRange = (position, type) => {
  const input = document.getElementById(`${type}-${position}-input`);
  const slider = document.getElementById(`${type}-${position}`);
  const label = document.getElementById(`${type}-${position}-label`);

  if (!input) return;

  let value = parseInt(input.value) || 0;
  if (position === 'max') value = parseInt(input.value) || 100000000;

  if (slider) slider.value = value;
  if (label) label.textContent = formatPrecioCortoCorto(value);

  updateDualRange(type);
};

const formatPrecioCortoCorto = (valor) => {
  if (valor >= 1000000) return `$${(valor / 1000000).toFixed(1)}M`;
  if (valor >= 1000) return `$${(valor / 1000).toFixed(0)}K`;
  return `$${valor}`;
};

// ==================== LABELS & CHIPS ====================
const updateLabels = () => {
  const labelUbicacion = document.getElementById('label-ubicacion');
  if (labelUbicacion) {
    labelUbicacion.textContent = filtrosActivos.estado.length > 0
      ? filtrosActivos.estado.join(', ')
      : '¿Dónde buscas?';
  }

  const labelOperacion = document.getElementById('label-operacion');
  if (labelOperacion) {
    labelOperacion.textContent = filtrosActivos.operacion.length > 0
      ? filtrosActivos.operacion.map(v => v === 'renta' ? 'Renta' : 'Venta').join(' y ')
      : 'Renta o Venta';
  }

  const labelTipo = document.getElementById('label-tipo');
  if (labelTipo) {
    const tipoLabels = { casa: 'Casa', departamento: 'Depto', terreno: 'Terreno', local: 'Local' };
    labelTipo.textContent = filtrosActivos.tipo.length > 0
      ? filtrosActivos.tipo.map(t => tipoLabels[t] || t).join(', ')
      : 'Tipo de propiedad';
  }

  const labelPrecio = document.getElementById('label-precio');
  if (labelPrecio) {
    if (filtrosActivos.precioMin > 0 || filtrosActivos.precioMax < 100000000) {
      labelPrecio.textContent = `${formatPrecioCortoCorto(filtrosActivos.precioMin)} - ${formatPrecioCortoCorto(filtrosActivos.precioMax)}`;
    } else {
      labelPrecio.textContent = 'Cualquier precio';
    }
  }

  const labelCredito = document.getElementById('label-credito');
  if (labelCredito) {
    const creditoLabels = {
      infonavit: 'INFONAVIT', fovissste: 'FOVISSSTE', cofinavit: 'Cofinavit', conavi: 'Conavi',
      bbva: 'BBVA', banorte: 'Banorte', santander: 'Santander', hsbc: 'HSBC', scotiabank: 'Scotiabank',
      banamex: 'Banamex', banregio: 'Banregio', mifel: 'Mifel', afirme: 'Afirme', inbursa: 'Inbursa',
      banco_azteca: 'Banco Azteca', caja_popular_mexicana: 'Caja Popular Mexicana', pemex: 'PEMEX',
      cfe: 'CFE', banjercito: 'Banjército', imss: 'IMSS'
    };
    labelCredito.textContent = filtrosActivos.credito.length > 0
      ? filtrosActivos.credito.map(c => creditoLabels[c] || c).join(', ')
      : 'Cualquier crédito';
  }
};

const renderChips = () => {
  const container = document.getElementById('active-chips');
  if (!container) return;

  let chips = [];

  filtrosActivos.estado.forEach(e => {
    chips.push(`<div class="chip">📍 ${e} <button class="chip-remove" onclick="removeChip('estado', '${e}')">×</button></div>`);
  });

  filtrosActivos.operacion.forEach(o => {
    const nombre = o === 'renta' ? 'Renta' : 'Venta';
    chips.push(`<div class="chip">🏠 ${nombre} <button class="chip-remove" onclick="removeChip('operacion', '${o}')">×</button></div>`);
  });

  filtrosActivos.tipo.forEach(t => {
    const labels = { casa: 'Casa', departamento: 'Depto', terreno: 'Terreno', local: 'Local' };
    chips.push(`<div class="chip">🏡 ${labels[t]} <button class="chip-remove" onclick="removeChip('tipo', '${t}')">×</button></div>`);
  });

  if (filtrosActivos.precioMin > 0 || filtrosActivos.precioMax < 100000000) {
    chips.push(`<div class="chip">💰 ${formatPrecioCortoCorto(filtrosActivos.precioMin)} - ${formatPrecioCortoCorto(filtrosActivos.precioMax)} <button class="chip-remove" onclick="removeChip('precio')">×</button></div>`);
  }

  const creditoLabels = {
    infonavit: 'INFONAVIT', fovissste: 'FOVISSSTE', cofinavit: 'Cofinavit', conavi: 'Conavi',
    bbva: 'BBVA', banorte: 'Banorte', santander: 'Santander', hsbc: 'HSBC', scotiabank: 'Scotiabank',
    banamex: 'Banamex', banregio: 'Banregio', mifel: 'Mifel', afirme: 'Afirme', inbursa: 'Inbursa',
    banco_azteca: 'Banco Azteca', caja_popular_mexicana: 'Caja Popular Mexicana', pemex: 'PEMEX',
    cfe: 'CFE', banjercito: 'Banjército', imss: 'IMSS'
  };
  filtrosActivos.credito.forEach(c => {
    chips.push(`<div class="chip">💳 ${creditoLabels[c] || c} <button class="chip-remove" onclick="removeChip('credito', '${c}')">×</button></div>`);
  });

  if (chips.length > 0) {
    chips.push(`<span class="chip-clear" onclick="clearAllChips()">Limpiar todo</span>`);
  }

  container.innerHTML = chips.join('');
};

const removeChip = (filterType, value) => {
  if (filterType === 'estado') {
    filtrosActivos.estado = filtrosActivos.estado.filter(v => v !== value);
    document.querySelector(`#opciones-estado .popover-option[data-value="${value}"]`)?.classList.remove('selected');
  } else if (filterType === 'operacion') {
    filtrosActivos.operacion = filtrosActivos.operacion.filter(v => v !== value);
    document.querySelector(`#popover-operacion .checkbox-option[data-value="${value}"]`)?.classList.remove('selected');
  } else if (filterType === 'tipo') {
    filtrosActivos.tipo = filtrosActivos.tipo.filter(v => v !== value);
    document.querySelector(`.checkbox-option[data-value="${value}"]`)?.classList.remove('selected');
  } else if (filterType === 'precio') {
    filtrosActivos.precioMin = 0;
    filtrosActivos.precioMax = 100000000;
    const pMin = document.getElementById('precio-min');
    const pMax = document.getElementById('precio-max');
    if (pMin) pMin.value = 0;
    if (pMax) pMax.value = 100000000;
    updateDualRange('precio');
  } else if (filterType === 'credito') {
    filtrosActivos.credito = filtrosActivos.credito.filter(v => v !== value);
    document.querySelector(`#popover-credito .checkbox-option[data-value="${value}"]`)?.classList.remove('selected');
  }

  updateLabels();
  renderChips();
};

const clearAllChips = () => {
  filtrosActivos.estado = [];
  filtrosActivos.operacion = [];
  filtrosActivos.tipo = [];
  filtrosActivos.precioMin = 0;
  filtrosActivos.precioMax = 100000000;
  filtrosActivos.credito = [];

  document.querySelectorAll('.popover-option.selected').forEach(opt => opt.classList.remove('selected'));
  document.querySelectorAll('.radio-option.selected').forEach(opt => opt.classList.remove('selected'));
  document.querySelectorAll('.checkbox-option.selected').forEach(opt => opt.classList.remove('selected'));

  const pMin = document.getElementById('precio-min');
  const pMax = document.getElementById('precio-max');
  if (pMin) pMin.value = 0;
  if (pMax) pMax.value = 100000000;

  updateLabels();
  renderChips();
  updateDualRange('precio');
};

// ==================== SEARCH FUNCTION ====================
const buscar = () => {
  closeAllPopovers();

  const params = new URLSearchParams();

  if (filtrosActivos.estado.length > 0) params.append('estado', filtrosActivos.estado.join(','));
  if (filtrosActivos.operacion.length > 0) params.append('operacion', filtrosActivos.operacion.join(','));
  if (filtrosActivos.tipo.length > 0) params.append('tipo', filtrosActivos.tipo.join(','));
  if (filtrosActivos.precioMin > 0) params.append('precioMin', filtrosActivos.precioMin);
  if (filtrosActivos.precioMax < 100000000) params.append('precioMax', filtrosActivos.precioMax);
  if (filtrosActivos.credito.length > 0) params.append('credito', filtrosActivos.credito.join(','));

  window.location.href = `pages/catalogo.html?${params.toString()}`;
};

// ==================== ESTADOS DINÁMICOS ====================
const cargarEstadosDisponiblesInicio = async () => {
  try {
    const data = await api.get('/propiedades/estados/disponibles');
    if (!data.ok || !data.estados?.length) return;
    const lista = document.getElementById('opciones-estado');
    if (!lista) return;
    lista.innerHTML = data.estados.map(e => `
      <div class="popover-option" data-value="${e._id}" onclick="toggleOption(this, 'estado')">
        ${e._id} <span style="font-size:11px;color:var(--text-light);margin-left:4px">(${e.total})</span>
      </div>`).join('');
  } catch (e) {}
};

// ==================== PROPIEDADES DESTACADAS ====================
const cargarPropiedadesDestacadas = async () => {
  const grid = document.getElementById('propiedades-grid');
  if (!grid) return;
  try {
    const data = await api.get('/propiedades?limite=6');
    if (data.propiedades && data.propiedades.length > 0) {
      grid.innerHTML = data.propiedades.map(crearCardPropiedad).join('');
    } else {
      grid.innerHTML = '<div class="loading">No hay propiedades disponibles aún.</div>';
    }
  } catch (error) {
    grid.innerHTML = '<div class="loading">Error cargando propiedades.</div>';
  }
};

// ==================== DOM READY ====================
document.addEventListener('DOMContentLoaded', () => {
  // Popover field click handlers
  document.querySelectorAll('.search-bar-field').forEach(field => {
    field.addEventListener('click', function () {
      const popoverId = this.getAttribute('data-popover');
      openPopover(popoverId, this);
    });
  });

  // Close popovers on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllPopovers();
  });

  // Cargar contenido
  cargarPropiedadesDestacadas();
  cargarEstadosDisponiblesInicio();

  // Nav toggle mobile — lista vertical, se cierra sola al tocar un enlace
  const toggle = document.getElementById('nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  const navActions = document.querySelector('.nav-actions');
  if (toggle) {
    toggle.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
      navActions.classList.toggle('mobile-open');
    });
    navLinks?.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
        navActions.classList.remove('mobile-open');
      });
    });
  }
});