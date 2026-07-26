// ==========================================
// COMPARADOR DE PROPIEDADES
// Estado compartido entre catálogo, inicio, favoritos y detalle
// Máximo 3 propiedades a la vez
// ==========================================

const COMPARADOR_MAX = 3;
const COMPARADOR_KEY = 'vm_comparador';

const comparadorObtener = () => {
  try {
    return JSON.parse(localStorage.getItem(COMPARADOR_KEY) || '[]');
  } catch (e) {
    return [];
  }
};

const comparadorGuardar = (ids) => {
  localStorage.setItem(COMPARADOR_KEY, JSON.stringify(ids));
  comparadorRenderBarra();
};

const comparadorTieneId = (id) => comparadorObtener().includes(id);

window.comparadorToggle = (id, event) => {
  if (event) event.stopPropagation();
  let ids = comparadorObtener();
  if (ids.includes(id)) {
    ids = ids.filter(x => x !== id);
  } else {
    if (ids.length >= COMPARADOR_MAX) {
      if (window.dsToast) dsToast({ title: 'Máximo 3 propiedades', message: 'Quita una propiedad de la comparación antes de agregar otra.', type: 'info' });
      return;
    }
    ids.push(id);
  }
  comparadorGuardar(ids);
  // Actualizar el estado visual de todos los checkboxes de esta propiedad en la página
  document.querySelectorAll(`[data-comparador-id="${id}"]`).forEach(el => {
    el.classList.toggle('activo', ids.includes(id));
    const check = el.querySelector('input[type="checkbox"]');
    if (check) check.checked = ids.includes(id);
  });
};

window.comparadorQuitar = (id) => {
  const ids = comparadorObtener().filter(x => x !== id);
  comparadorGuardar(ids);
  if (window.location.pathname.includes('comparador.html')) {
    comparadorRenderTabla();
  }
};

window.comparadorLimpiar = () => {
  comparadorGuardar([]);
  if (window.location.pathname.includes('comparador.html')) {
    comparadorRenderTabla();
  }
};

const comparadorRenderBarra = () => {
  const ids = comparadorObtener();
  let barra = document.getElementById('comparador-barra');

  if (ids.length === 0) {
    if (barra) barra.remove();
    return;
  }

  if (!barra) {
    barra = document.createElement('div');
    barra.id = 'comparador-barra';
    barra.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:var(--text,#1a1a1a);color:white;padding:14px 20px;display:flex;align-items:center;justify-content:center;gap:16px;z-index:9998;box-shadow:0 -4px 20px rgba(0,0,0,0.2);flex-wrap:wrap';
    document.body.appendChild(barra);
  }

  const enComparador = window.location.pathname.includes('comparador.html');
  barra.innerHTML = `
    <span style="font-size:14px;font-weight:600">⚖️ ${ids.length}/${COMPARADOR_MAX} propiedades para comparar</span>
    ${!enComparador ? `<a href="${window.location.pathname.includes('/pages/') ? 'comparador.html' : 'pages/comparador.html'}" style="background:var(--primary);color:white;padding:8px 18px;border-radius:20px;font-size:13px;font-weight:600;text-decoration:none">Ver comparación</a>` : ''}
    <button onclick="comparadorLimpiar()" style="background:none;border:1px solid rgba(255,255,255,0.4);color:white;padding:8px 16px;border-radius:20px;font-size:13px;cursor:pointer">Limpiar</button>
  `;
};

document.addEventListener('DOMContentLoaded', comparadorRenderBarra);