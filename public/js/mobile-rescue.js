// ==========================================
// VISTA MÓVIL SIMPLIFICADA — dashboard.html / admin.html
// Oculta el sidebar en pantallas chicas y lo reemplaza por un
// <select> de navegación, más dos botones flotantes (inicio / salir).
// Requiere mobile-rescue.css. Solo actúa si la página tiene
// el layout de dashboard/admin (.dashboard-layout) — en cualquier
// otra página no hace nada.
// ==========================================
(function () {
  if (window.__vmMobileRescue) return; // evita doble inyección si el script se incluye 2 veces
  window.__vmMobileRescue = true;

  const BREAKPOINT = 900;
  let floatBtns = null;
  let navSelect = null;

  // Texto visible de un link de sidebar, sin el badge de notificaciones
  // ni el chevron de los grupos colapsables (y sin depender de que el
  // elemento esté visible: el sidebar ya está display:none en móvil,
  // así que .innerText no sirve aquí — usamos .textContent sobre un clon).
  function textoDeLink(link) {
    const clone = link.cloneNode(true);
    clone.querySelectorAll('.nav-badge, .chevron').forEach((el) => el.remove());
    return clone.textContent.replace(/\s+/g, ' ').trim();
  }

  function seccionDe(link) {
    const m = (link.getAttribute('onclick') || '').match(/mostrarSeccion\('([^']+)'\)/);
    return m ? m[1] : null;
  }

  function agregarOpcion(optgroup, link) {
    const seccion = seccionDe(link);
    if (!seccion) return;
    const option = document.createElement('option');
    option.value = seccion;
    option.textContent = textoDeLink(link);
    optgroup.appendChild(option);
  }

  function construirBotonesFlotantes() {
    if (floatBtns) return;
    floatBtns = document.createElement('div');
    floatBtns.className = 'vm-floating-btns';
    floatBtns.innerHTML = `
      <a href="/" title="Ir al inicio" aria-label="Ir al inicio">🏠</a>
      <button type="button" class="vm-logout-btn" title="Cerrar sesión" aria-label="Cerrar sesión"
        onclick="if(window.auth && auth.logout){auth.logout()}else{window.location.href='login.html'}">⏻</button>
    `;
    document.body.appendChild(floatBtns);
  }

  function quitarBotonesFlotantes() {
    if (floatBtns) { floatBtns.remove(); floatBtns = null; }
  }

  function construirMenuNavegacion() {
    if (navSelect) return;
    const main = document.querySelector('.dashboard-main');
    if (!main) return;

    const select = document.createElement('select');
    select.className = 'vm-mobile-nav';
    select.setAttribute('aria-label', 'Ir a sección');

    const grupos = document.querySelectorAll('.dashboard-sidebar .sidebar-group');
    if (grupos.length) {
      // Sidebar con grupos (admin.html) → un <optgroup> por grupo
      grupos.forEach((grupo) => {
        const tituloEl = grupo.querySelector('.sidebar-section-title span');
        const optgroup = document.createElement('optgroup');
        optgroup.label = tituloEl ? tituloEl.textContent.trim() : 'Sección';
        grupo.querySelectorAll('.sidebar-link').forEach((link) => agregarOpcion(optgroup, link));
        if (optgroup.children.length) select.appendChild(optgroup);
      });
    } else {
      // Sidebar plano (dashboard.html) → un solo <optgroup>
      const links = document.querySelectorAll('.dashboard-sidebar .sidebar-link');
      if (!links.length) return;
      const optgroup = document.createElement('optgroup');
      optgroup.label = 'Navegación';
      links.forEach((link) => agregarOpcion(optgroup, link));
      select.appendChild(optgroup);
    }

    if (!select.querySelector('option')) return; // nada que navegar, no insertar nada

    // Preseleccionar la sección actualmente activa
    const activo = document.querySelector('.dashboard-sidebar .sidebar-link.active');
    const seccionActiva = activo ? seccionDe(activo) : null;
    if (seccionActiva) select.value = seccionActiva;

    select.addEventListener('change', function () {
      if (window.mostrarSeccion) window.mostrarSeccion(this.value);
    });

    main.insertBefore(select, main.firstChild);
    navSelect = select;

    // Si la navegación ocurre por otra vía (p. ej. un link interno),
    // mantener el <select> sincronizado con la sección visible.
    if (!window.__vmMostrarSeccionParcheado && typeof window.mostrarSeccion === 'function') {
      window.__vmMostrarSeccionParcheado = true;
      const original = window.mostrarSeccion;
      window.mostrarSeccion = function (nombre) {
        original(nombre);
        if (navSelect) navSelect.value = nombre;
      };
    }
  }

  function quitarMenuNavegacion() {
    if (navSelect) { navSelect.remove(); navSelect = null; }
  }

  function aplicarVistaMovil() {
    if (!document.querySelector('.dashboard-layout')) return; // solo dashboard/admin

    if (window.innerWidth <= BREAKPOINT) {
      construirBotonesFlotantes();
      construirMenuNavegacion();
    } else {
      quitarBotonesFlotantes();
      quitarMenuNavegacion();
    }
  }

  let resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(aplicarVistaMovil, 150);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aplicarVistaMovil);
  } else {
    aplicarVistaMovil();
  }
})();
