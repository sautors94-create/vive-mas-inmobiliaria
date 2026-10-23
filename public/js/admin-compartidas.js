/* ═══════════════════════════════════════════════════════════════════
   admin-compartidas.js — Vive Más Inmobiliaria (panel admin)
   Muestra las compartidas SIN tocar tu admin.js:
   1) Agrega la columna "🔄 Compartidas" a la tabla de "Todas las
      propiedades" (se inyecta sola cada vez que la tabla se pinta,
      con orden, filtros o paginación — sin duplicar celdas).
   2) Agrega el badge "🔄 N compartidas" al drawer de detalle de
      propiedad (envolviendo window.abrirDrawerPropiedad).
   3) Lee los conteos de GET /api/admin/propiedades/compartidas
      (módulo backend-compartidas.js). Si el módulo aún no está
      instalado en el servidor, muestra "—" sin romper nada.

   INSTALACIÓN: en tu HTML del panel admin, DESPUÉS del <script> de
   admin.js, agrega:
     <script src="js/admin-compartidas.js"></script>
   ═══════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';
  if (window.__vmAdminCompartidasLoaded) return;
  window.__vmAdminCompartidasLoaded = true;

  const TH_CLASE = 'vm-th-compartidas';
  const TD_CLASE = 'vm-td-compartidas';
  let avisoModulo = false;

  const idDeFila = (tr) => {
    const m = (tr.getAttribute('onclick') || '').match(/abrirDrawerPropiedad\(['"]([^'"]+)['"]\)/);
    return m ? m[1] : null;
  };

  const pedirConteos = async (ids) => {
    if (!ids.length) return {};
    try {
      const res = await fetch('/api/admin/propiedades/compartidas?ids=' + encodeURIComponent(ids.join(',')), {
        headers: { Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json().catch(() => null);
      return (d && d.conteos) || {};
    } catch (e) {
      if (!avisoModulo) {
        avisoModulo = true;
        console.info('[Compartidas] El módulo backend-compartidas.js aún no está instalado en el ' +
          'servidor; la columna mostrará "—" hasta entonces.');
      }
      return null;
    }
  };

  // Estado del módulo del backend: null=desconocido · true=instalado · false=sin instalar
  let moduloActivo = null;
  let cacheConteos = {}; // id -> conteo (evita re-consumir red al repintar)

  // ── 1) columna en la tabla de propiedades ───────────────────────
  const pintarCelda = (tr, texto, sinModulo) => {
    let td = tr.querySelector('.' + TD_CLASE);
    if (!td) {
      td = document.createElement('td');
      td.className = TD_CLASE;
      td.style.cssText = 'white-space:nowrap;';
      tr.appendChild(td);
    }
    td.textContent = texto;
    td.title = sinModulo
      ? 'Se activará cuando instales backend-compartidas.js en el servidor'
      : 'Veces que se compartió esta propiedad';
  };

  let ultimaFirma = '';
  let enCurso = false;

  const decorar = async () => {
    if (enCurso) return;
    const tbody = document.getElementById('prop-mod-tbody');
    if (!tbody) return;
    const filas = Array.from(tbody.querySelectorAll('tr')).filter(tr => idDeFila(tr));
    if (!filas.length) return;

    const ids = filas.map(idDeFila);
    const firma = ids.join(',');
    const faltan = filas.some(tr => !tr.querySelector('.' + TD_CLASE));
    // Mismas filas y celdas intactas → nada que hacer (sin red, sin duplicar)
    if (firma === ultimaFirma && !faltan) return;
    enCurso = true;

    try {
      const tabla = tbody.closest('table');
      if (tabla) {
        const head = tabla.querySelector('thead tr');
        if (head && !head.querySelector('.' + TH_CLASE)) {
          const th = document.createElement('th');
          th.className = TH_CLASE;
          th.textContent = '🔄 Compartidas';
          head.appendChild(th);
        }
      }
      let sinModulo = false;
      let conteos = null;
      if (firma === ultimaFirma) {
        // Re-render de las MISMAS filas (ordenar/filtrar): repintar desde caché
        sinModulo = (moduloActivo === false);
        conteos = cacheConteos;
      } else {
        const r = await pedirConteos(Array.from(new Set(ids)));
        if (!r) { sinModulo = true; moduloActivo = false; conteos = {}; }
        else { moduloActivo = true; conteos = r; cacheConteos = Object.assign({}, cacheConteos, r); }
      }
      if (sinModulo) {
        filas.forEach(tr => pintarCelda(tr, '—', true));
      } else {
        filas.forEach((tr) => {
          const n = conteos[idDeFila(tr)];
          pintarCelda(tr, '🔄 ' + (typeof n === 'number' ? n : 0), false);
        });
      }
      ultimaFirma = firma;
    } finally {
      enCurso = false;
      // Si las filas cambiaron mientras pedíamos, reintentar (la firma
      // evita bucles: si no cambió, esto no vuelve a consumir red)
      programar();
    }
  };

  let timer = null;
  const programar = () => { clearTimeout(timer); timer = setTimeout(() => { decorar(); }, 250); };

  const engancharTabla = () => {
    const tbody = document.getElementById('prop-mod-tbody');
    if (!tbody) return false;
    new MutationObserver(programar).observe(tbody, { childList: true });
    programar();
    return true;
  };

  // ── 2) badge en el drawer de detalle ────────────────────────────
  const inyectarEnDrawer = async (id) => {
    const content = document.getElementById('drawer-prop-content');
    if (!content || !content.querySelector('.status-badge')) return; // drawer con error → no tocar
    let badge = document.getElementById('vm-drawer-compartidas');
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'vm-drawer-compartidas';
      badge.className = 'status-badge';
      badge.style.cssText = 'background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;cursor:default';
      const fila = content.querySelector('.status-badge').parentNode;
      if (fila) fila.appendChild(badge);
      else content.insertBefore(badge, content.firstChild);
    }
    badge.textContent = '🔄 …';
    const conteos = await pedirConteos([id]);
    badge.textContent = (!conteos || typeof conteos[id] !== 'number')
      ? '🔄 —'
      : '🔄 ' + conteos[id] + ' compartida' + (conteos[id] === 1 ? '' : 's');
    if (!conteos) badge.title = 'Se activará cuando instales backend-compartidas.js en el servidor';
  };

  const envolverDrawer = () => {
    if (typeof window.abrirDrawerPropiedad !== 'function') return false;
    if (window.abrirDrawerPropiedad.__vmCompartidas) return true;
    const original = window.abrirDrawerPropiedad;
    const envuelto = async (id) => {
      const promesa = original(id);
      try { await promesa; } catch (e) { /* el drawer ya pinta su error */ }
      try { await inyectarEnDrawer(id); } catch (e) {}
    };
    envuelto.__vmCompartidas = true;
    window.abrirDrawerPropiedad = envuelto;
    return true;
  };

  // ── arranque tolerante (los elementos pueden crearse después) ───
  const iniciar = () => {
    if (!engancharTabla()) {
      const obsBody = new MutationObserver(() => { if (engancharTabla()) obsBody.disconnect(); });
      obsBody.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => obsBody.disconnect(), 30000);
    }
    if (!envolverDrawer()) {
      let intentos = 0;
      const t = setInterval(() => {
        intentos += 1;
        if (envolverDrawer() || intentos > 40) clearInterval(t);
      }, 500);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  window.__vmAdminCompartidas = { version: '1.0', refrescar: () => { ultimaFirma = ''; programar(); } };
})();
