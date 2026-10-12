// Sección "Marcas y Profesionales Aliados" del Directorio.
// Todos los filtros consultan la base de datos (GET /api/marcas/publico); nada se filtra solo en pantalla.
(() => {
  const $ = (id) => document.getElementById(id);
  if (!$('mb-grid')) return;

  const estado = { q: '', categorias: new Set(), ciudades: new Set(), orden: 'recientes', pagina: 1, paginas: 1, total: 0, solicitud: 0 };
  let catalogo = { categorias: [], ciudades: [], total: 0 };
  let temporizador = null;

  const hayFiltros = () => !!(estado.q || estado.categorias.size || estado.ciudades.size);

  const inicial = (n) => mbEsc((String(n || '?').trim()[0] || '?').toUpperCase());

  const tarjeta = (m) => {
    const portada = mbImg(m.portada);
    const logo = mbImg(m.imagen);
    const masCats = (m.categorias || []).length > 1 ? ` · +${m.categorias.length - 1} más` : '';
    const masCiudades = m.totalCiudades > 1 ? ` · ${m.totalCiudades} ciudades` : '';
    return `
      <a class="marca-card" href="marca.html?s=${encodeURIComponent(m.slug)}" aria-label="Ver perfil de ${mbEsc(m.nombre)}">
        <div class="marca-cover">
          ${portada ? `<img src="${portada}" alt="" loading="lazy">` : ''}
          ${m.promocion ? `<span class="marca-promo" title="${mbEsc(m.promocion.descripcion)}">🏷️ ${mbEsc(m.promocion.etiqueta)}</span>` : ''}
        </div>
        ${logo ? `<img class="marca-logo" src="${logo}" alt="Logotipo de ${mbEsc(m.nombre)}" loading="lazy">` : `<div class="marca-logo">${inicial(m.nombre)}</div>`}
        <div class="marca-body">
          <h3>${mbEsc(m.nombre)}</h3>
          <div class="marca-cat">${mbEsc(m.categoriaPrincipal)}${masCats}</div>
          <div class="marca-ciudad">📍 ${mbEsc(m.ciudadPrincipal || 'Cobertura por definir')}${masCiudades}</div>
          <p class="marca-desc">${mbEsc(m.descripcionCorta)}</p>
          <span class="marca-ver">Ver perfil completo</span>
        </div>
      </a>`;
  };

  const pintarFiltros = () => {
    $('mb-categorias').innerHTML = catalogo.categorias
      .map((c) => `<button type="button" class="mb-chip ${estado.categorias.has(c.slug) ? 'activo' : ''}" data-cat="${mbEsc(c.slug)}">${mbEsc(c.icono || '')} ${mbEsc(c.nombre)}</button>`)
      .join('');

    const disponibles = catalogo.ciudades.filter((c) => !estado.ciudades.has(c.slug));
    $('mb-ciudad-select').innerHTML = `<option value="">＋ Agregar ciudad…</option>` +
      disponibles.map((c) => `<option value="${mbEsc(c.slug)}">${mbEsc(c.nombre)}${c.estado && c.estado !== c.nombre ? ', ' + mbEsc(c.estado) : ''} (${c.total})</option>`).join('');
    $('mb-ciudad-select').style.display = catalogo.ciudades.length ? '' : 'none';

    $('mb-ciudades-activas').innerHTML = [...estado.ciudades].map((slug) => {
      const c = catalogo.ciudades.find((x) => x.slug === slug);
      return `<button type="button" class="mb-chip activo" data-ciudad-quitar="${mbEsc(slug)}" title="Quitar ciudad">📍 ${mbEsc(c ? c.nombre : slug)} ✕</button>`;
    }).join('');
    $('mb-limpiar').style.display = hayFiltros() ? '' : 'none';
  };

  const consulta = (pagina) => {
    const p = new URLSearchParams();
    if (estado.q) p.set('q', estado.q);
    if (estado.categorias.size) p.set('categoria', [...estado.categorias].join(','));
    if (estado.ciudades.size) p.set('ciudad', [...estado.ciudades].join(','));
    p.set('orden', estado.orden);
    p.set('pagina', pagina);
    p.set('limite', 12);
    return p.toString();
  };

  const vacio = () => {
    if (!hayFiltros()) {
      return `<div class="mb-vacio"><div class="mb-vacio-icono">🤝</div><h3>Aún no hay marcas publicadas</h3><p>Sé de las primeras en ofrecer beneficios a la comunidad SomosViveMás.</p><p style="margin-top:14px"><a class="btn btn-primary" href="marca-acceso.html">+ Agregar mi marca</a></p></div>`;
    }
    return `<div class="mb-vacio"><div class="mb-vacio-icono">🔎</div><h3>Sin resultados</h3><p>No encontramos marcas con esos criterios. Prueba con otros términos o quita algún filtro.</p><p style="margin-top:12px"><button type="button" class="mb-limpiar" id="mb-limpiar-vacio">Limpiar filtros</button></p></div>`;
  };

  const cargar = async (pagina = 1) => {
    const mia = ++estado.solicitud; // descarta respuestas viejas si el usuario sigue escribiendo
    const grid = $('mb-grid');
    if (pagina === 1) grid.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';
    $('mb-mas').style.display = 'none';
    let datos;
    try {
      const res = await fetch(`${API_URL}/api/marcas/publico?${consulta(pagina)}`);
      datos = await res.json();
      if (!res.ok) throw new Error(datos.error || 'Error');
    } catch (e) {
      if (mia !== estado.solicitud) return;
      grid.innerHTML = `<div class="mb-vacio"><div class="mb-vacio-icono">⚠️</div><h3>No pudimos cargar las marcas</h3><p>Revisa tu conexión e intenta de nuevo.</p><p style="margin-top:12px"><button type="button" class="mb-limpiar" id="mb-reintentar">Reintentar</button></p></div>`;
      $('mb-conteo').textContent = '0';
      return;
    }
    if (mia !== estado.solicitud) return;
    estado.pagina = datos.pagina;
    estado.paginas = datos.paginas;
    estado.total = datos.total;
    const html = datos.marcas.map(tarjeta).join('');
    if (pagina === 1) grid.innerHTML = datos.marcas.length ? html : vacio();
    else grid.insertAdjacentHTML('beforeend', html);
    const mostradas = grid.querySelectorAll('.marca-card').length;
    $('mb-conteo').textContent = datos.total;
    $('mb-conteo-txt').textContent = datos.total === 1 ? 'marca' : 'marcas';
    $('mb-mas').style.display = datos.pagina < datos.paginas ? '' : 'none';
    $('mb-mostradas').textContent = mostradas < datos.total ? ` (mostrando ${mostradas})` : '';
  };

  const refrescar = () => { pintarFiltros(); cargar(1); };

  // --- eventos ---
  $('mb-q').addEventListener('input', (e) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { estado.q = e.target.value.trim(); estado.pagina = 1; $('mb-limpiar').style.display = hayFiltros() ? '' : 'none'; cargar(1); }, 300);
  });
  $('mb-categorias').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    const s = b.dataset.cat;
    estado.categorias.has(s) ? estado.categorias.delete(s) : estado.categorias.add(s);
    refrescar();
  });
  $('mb-ciudad-select').addEventListener('change', (e) => { if (e.target.value) { estado.ciudades.add(e.target.value); refrescar(); } });
  $('mb-ciudades-activas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ciudad-quitar]'); if (!b) return;
    estado.ciudades.delete(b.dataset.ciudadQuitar); refrescar();
  });
  $('mb-orden').addEventListener('change', (e) => { estado.orden = e.target.value; cargar(1); });
  $('mb-mas').addEventListener('click', () => cargar(estado.pagina + 1));
  const limpiar = () => { estado.q = ''; estado.categorias.clear(); estado.ciudades.clear(); $('mb-q').value = ''; refrescar(); };
  $('mb-limpiar').addEventListener('click', limpiar);
  $('mb-grid').addEventListener('click', (e) => {
    if (e.target.id === 'mb-limpiar-vacio') limpiar();
    if (e.target.id === 'mb-reintentar') cargar(1);
  });

  // --- arranque ---
  (async () => {
    try {
      const res = await fetch(`${API_URL}/api/marcas/publico/filtros`);
      const d = await res.json();
      if (res.ok) catalogo = d;
    } catch (e) { /* los filtros se quedan vacíos; el listado igual intenta cargar */ }
    pintarFiltros();
    cargar(1);
  })();
})();
