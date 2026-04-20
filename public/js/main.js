const buscar = () => {
  const operacion = document.getElementById('tipo-operacion').value;
  const tipo = document.getElementById('tipo-propiedad').value;
  const estado = document.getElementById('estado').value;
  const precioMin = document.getElementById('precio-min-input').value;
  const precioMax = document.getElementById('precio-max-input').value;

  const params = new URLSearchParams();
  if (operacion) params.append('operacion', operacion);
  if (tipo) params.append('tipo', tipo);
  if (estado) params.append('estado', estado);
  if (precioMin) params.append('precioMin', precioMin);
  if (precioMax && precioMax < 100000000) params.append('precioMax', precioMax);

  window.location.href = `pages/catalogo.html?${params.toString()}`;
};

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
const formatPrecioSlider = (valor) => {
  if (valor >= 1000000) return `$${(valor/1000000).toFixed(1)}M`;
  if (valor >= 1000) return `$${(valor/1000).toFixed(0)}K`;
  return `$${valor}`;
};

const actualizarPrecioInicio = (valor) => {
  document.getElementById('precio-label').textContent = formatPrecioSlider(valor);
  document.getElementById('precio-max-input').value = valor;
};

const sincronizarSlider = (valor) => {
  document.getElementById('precio-max-range').value = valor || 100000000;
  document.getElementById('precio-label').textContent = formatPrecioSlider(valor || 100000000);
};

document.addEventListener('DOMContentLoaded', () => {
  cargarPropiedadesDestacadas();

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
