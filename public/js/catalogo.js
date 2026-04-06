let paginaActual = 1;

const obtenerFiltros = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    operacion: document.getElementById('f-operacion')?.value || params.get('operacion') || '',
    tipo: document.getElementById('f-tipo')?.value || params.get('tipo') || '',
    estado: document.getElementById('f-estado')?.value || params.get('estado') || '',
    precioMin: document.getElementById('f-precio-min')?.value || params.get('precioMin') || '',
    precioMax: document.getElementById('f-precio-max')?.value || params.get('precioMax') || '',
    pagina: paginaActual,
    limite: 15
  };
};

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

const renderPaginacion = (totalPaginas) => {
  const paginacion = document.getElementById('paginacion');
  if (totalPaginas <= 1) { paginacion.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= totalPaginas; i++) {
    html += `<button class="${i === paginaActual ? 'active' : ''}" onclick="irPagina(${i})">${i}</button>`;
  }
  paginacion.innerHTML = html;
};

const irPagina = (pagina) => {
  paginaActual = pagina;
  cargarPropiedades();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const aplicarFiltros = () => {
  paginaActual = 1;
  cargarPropiedades();
};

const limpiarFiltros = () => {
  document.getElementById('f-operacion').value = '';
  document.getElementById('f-tipo').value = '';
  document.getElementById('f-estado').value = '';
  document.getElementById('f-precio-min').value = '';
  document.getElementById('f-precio-max').value = '';
  document.getElementById('f-precio-min-range').value = 0;
  document.getElementById('f-precio-max-range').value = 100000000;
  document.getElementById('label-min').textContent = '$0';
  document.getElementById('label-max').textContent = '$100,000,000';
  paginaActual = 1;
  cargarPropiedades();
};

const cargarFiltrosDesdeURL = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('operacion')) document.getElementById('f-operacion').value = params.get('operacion');
  if (params.get('tipo')) document.getElementById('f-tipo').value = params.get('tipo');
  if (params.get('estado')) document.getElementById('f-estado').value = params.get('estado');
  if (params.get('precioMin')) document.getElementById('f-precio-min').value = params.get('precioMin');
  if (params.get('precioMax')) document.getElementById('f-precio-max').value = params.get('precioMax');
};
const formatSlider = (valor) => {
  if (valor >= 1000000) return `$${(valor/1000000).toFixed(1)}M`;
  if (valor >= 1000) return `$${(valor/1000).toFixed(0)}K`;
  return `$${valor}`;
};

const actualizarSliderMin = (valor) => {
  const max = parseInt(document.getElementById('f-precio-max-range').value);
  if (parseInt(valor) > max) {
    document.getElementById('f-precio-min-range').value = max;
    valor = max;
  }
  document.getElementById('label-min').textContent = formatSlider(valor);
  document.getElementById('f-precio-min').value = valor;
  document.getElementById('f-precio-min').placeholder = formatSlider(valor);
};

const actualizarSliderMax = (valor) => {
  const min = parseInt(document.getElementById('f-precio-min-range').value);
  if (parseInt(valor) < min) {
    document.getElementById('f-precio-max-range').value = min;
    valor = min;
  }
  document.getElementById('label-max').textContent = formatSlider(valor);
  document.getElementById('f-precio-max').value = valor;
  document.getElementById('f-precio-max').placeholder = formatSlider(valor);
};

const actualizarDesdeInput = (tipo, valor) => {
  if (tipo === 'min') {
    document.getElementById('f-precio-min-range').value = valor || 0;
    document.getElementById('label-min').textContent = formatSlider(valor || 0);
  } else {
    document.getElementById('f-precio-max-range').value = valor || 100000000;
    document.getElementById('label-max').textContent = formatSlider(valor || 10000000);
  }
};
document.addEventListener('DOMContentLoaded', () => {
  cargarFiltrosDesdeURL();
  cargarPropiedades();
  actualizarNavbar();

  const toggle = document.getElementById('nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  const navActions = document.querySelector('.nav-actions');
  if (toggle) {
    toggle.addEventListener('click', () => {
      navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
      navActions.style.display = navActions.style.display === 'flex' ? 'none' : 'flex';
    });
  }
});