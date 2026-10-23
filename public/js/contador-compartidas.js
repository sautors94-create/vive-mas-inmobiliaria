/* ═══════════════════════════════════════════════════════════════════
   contador-compartidas.js — Vive Más Inmobiliaria
   Cuenta cuántas veces se comparte una propiedad y muestra el badge
   "🔄 Compartida N veces" en la página de detalle (propiedad.html).
   ───────────────────────────────────────────────────────────────────
   Qué hace (sin tocar tu código existente):
   • Detecta los clics de compartir por delegación de eventos: enlaces
     de WhatsApp/Facebook/X/Telegram/LinkedIn, botones con clases tipo
     "compartir/share", "Copiar enlace" y el menú nativo del celular
     (navigator.share). Funciona con los botones que ya renderiza
     social-widget.js o cualquier otro.
   • Envía POST /api/propiedades/:id/compartir (requiere el módulo
     backend-compartidas.js en el servidor). Si el endpoint aún no
     existe, guarda el clic en una cola local (máx. 50) y lo reintenta
     automáticamente en las siguientes visitas — no se pierde nada.
   • Pinta el badge con el conteo cuando el backend responde.
   • Funciona también en catálogo: si el enlace compartido apunta a
     propiedad.html?id=XXX, cuenta para ESA propiedad.

   INSTALACIÓN: en propiedad.html (y opcionalmente catálogo.html),
   después de social-widget.js:
     <script src="../js/contador-compartidas.js"></script>
   ═══════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';
  if (window.__vmCompartidasLoaded) return;
  window.__vmCompartidasLoaded = true;

  const CLAVE_COLA = 'vm_compartidas_pendientes';
  const MAX_COLA = 50;
  const VENTANA_DEDUP = 8000; // ms: el mismo clic no se cuenta dos veces

  // ── utilidades ──────────────────────────────────────────────────
  const idDesdeTexto = (txt) => {
    if (!txt) return null;
    const t = String(txt);
    let m = t.match(/[?&#]id=([A-Za-z0-9_-]{6,60})/);
    if (m) return m[1];
    try {
      const d = decodeURIComponent(t);
      m = d.match(/[?&#]id=([A-Za-z0-9_-]{6,60})/);
      if (m) return m[1];
    } catch (e) { /* texto no codificado */ }
    m = t.match(/propiedad\/([A-Za-z0-9_-]{6,60})/);
    return m ? m[1] : null;
  };

  // Id de la propiedad "actual" de la página (detalle)
  const obtenerIdPagina = () => {
    const deUrl = idDesdeTexto(window.location.href);
    if (deUrl) return deUrl;
    const g = window.propiedadActual || window.__propiedad ||
      (window.vmProp && window.vmProp.propiedad);
    if (g && (g._id || g.id)) return String(g._id || g.id);
    const can = document.querySelector('link[rel="canonical"]') ||
      document.querySelector('meta[property="og:url"]');
    if (can) return idDesdeTexto(can.getAttribute('href') || can.getAttribute('content') || '');
    return null;
  };

  // Id de la propiedad asociada al elemento clickeado (enlaces que ya
  // llevan la URL de la propiedad dentro — tarjetas del catálogo)
  const obtenerIdElemento = (el) => {
    if (!el || !el.closest) return null;
    const link = el.closest('a[href]');
    if (link) {
      const id = idDesdeTexto(link.getAttribute('href'));
      if (id) return id;
    }
    const btn = el.closest('[data-vm-propiedad]');
    if (btn) return btn.getAttribute('data-vm-propiedad') || null;
    return null;
  };

  // ── detección de "esto es un compartir" ─────────────────────────
  const REDES = [
    ['wa.me', 'whatsapp'], ['api.whatsapp.com', 'whatsapp'], ['whatsapp://', 'whatsapp'],
    ['facebook.com/sharer', 'facebook'], ['fb.com/sharer', 'facebook'],
    ['twitter.com/intent', 'x'], ['x.com/intent', 'x'],
    ['t.me/share', 'telegram'], ['linkedin.com/share', 'linkedin'],
    ['pinterest.com/pin', 'pinterest']
  ];

  const detectarRed = (el) => {
    if (!el || !el.closest) return null;
    // "Copiar enlace" tiene prioridad (es la intención más específica)
    const b2 = el.closest('button, a, [role="button"]');
    if (b2) {
      const tc = ((b2.textContent || '') + ' ' + (b2.className || '') + ' ' + (b2.id || '')).toLowerCase();
      if (tc.indexOf('copiar') !== -1 || tc.indexOf('copy') !== -1 || tc.indexOf('🔗') !== -1) return 'enlace';
    }
    const a = el.closest('a[href]');
    if (a) {
      const href = (a.getAttribute('href') || '').toLowerCase();
      for (let i = 0; i < REDES.length; i++) {
        if (href.indexOf(REDES[i][0]) !== -1) return REDES[i][1];
      }
    }
    const btn = el.closest('[data-vm-share], [data-share], .btn-compartir, .compartir-btn, ' +
      '.share-btn, .btn-share, [class*="compartir"], [class*="share-btn"], ' +
      '[id*="compartir"], [id*="btn-share"]');
    if (btn) {
      const t = ((btn.textContent || '') + ' ' + (btn.id || '') + ' ' + (btn.className || '')).toLowerCase();
      if (t.indexOf('whats') !== -1) return 'whatsapp';
      if (t.indexOf('face') !== -1) return 'facebook';
      if (t.indexOf('twitt') !== -1 || t.indexOf('twitter') !== -1) return 'x';
      if (t.indexOf('telegram') !== -1) return 'telegram';
      return 'otro';
    }
    return null;
  };

  // ── cola local (respaldo si el endpoint aún no existe) ──────────
  const leerCola = () => {
    try { return JSON.parse(localStorage.getItem(CLAVE_COLA) || '[]') || []; }
    catch (e) { return []; }
  };
  const guardarCola = (cola) => {
    try { localStorage.setItem(CLAVE_COLA, JSON.stringify(cola.slice(-MAX_COLA))); } catch (e) {}
  };

  // ── envío al backend ────────────────────────────────────────────
  const enviarCompartida = async (id, red, esReintento) => {
    try {
      const res = await fetch('/api/propiedades/' + encodeURIComponent(id) + '/compartir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ red: red || 'otro' })
      });
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        if (typeof d.compartidas === 'number' && id === obtenerIdPagina()) pintarBadge(d.compartidas);
        return true;
      }
      throw new Error('HTTP ' + res.status);
    } catch (e) {
      if (!esReintento) {
        const cola = leerCola();
        cola.push({ id, red: red || 'otro', ts: Date.now() });
        guardarCola(cola);
      }
      return false;
    }
  };

  const vaciando = { v: false };
  const vaciarCola = async () => {
    if (vaciando.v) return;
    vaciando.v = true;
    try {
      const cola = leerCola();
      if (!cola.length) return;
      const lote = cola.slice(0, 20);
      const restantes = [];
      for (let i = 0; i < lote.length; i++) {
        // eslint-disable-next-line no-await-in-loop
        const okResp = await enviarCompartida(lote[i].id, lote[i].red, true);
        if (!okResp) restantes.push(lote[i]);
      }
      guardarCola(cola.slice(20).concat(restantes));
    } finally {
      vaciando.v = false;
    }
  };

  // ── registro con deduplicación de doble disparo ─────────────────
  const dedup = new Map();
  const registrarCompartida = (id, red) => {
    if (!id) return;
    const k = id + '|' + (red || 'otro');
    const ahora = Date.now();
    const prev = dedup.get(k);
    if (prev && ahora - prev < VENTANA_DEDUP) return;
    dedup.set(k, ahora);
    enviarCompartida(id, red);
  };

  document.addEventListener('click', (ev) => {
    const el = ev.target;
    if (!el || !el.closest) return;
    const red = detectarRed(el);
    if (!red) return;
    const id = obtenerIdElemento(el) || obtenerIdPagina();
    registrarCompartida(id, red);
  }, true);

  // ── menú nativo del celular (navigator.share) ───────────────────
  try {
    if (navigator.share && !navigator.share.__vmContado) {
      const original = navigator.share.bind(navigator);
      const envuelto = async (data) => {
        try {
          const id = (data && idDesdeTexto(data.url)) || obtenerIdPagina();
          registrarCompartida(id, 'nativo');
        } catch (e) {}
        return original(data);
      };
      envuelto.__vmContado = true;
      navigator.share = envuelto;
    }
  } catch (e) {}

  // ── badge "🔄 Compartida N veces" en propiedad.html ─────────────
  let badgeEl = null;
  const pintarBadge = (n) => {
    if (typeof n !== 'number' || n < 0) return;
    const cont = document.getElementById('propiedad-contenido');
    if (!cont) return;
    if (!badgeEl || !badgeEl.isConnected) {
      badgeEl = document.createElement('div');
      badgeEl.className = 'vm-badge-compartidas';
      badgeEl.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin:10px 0;' +
        'padding:7px 14px;background:#f0f7f2;border:1px solid #d7e8dc;border-radius:999px;' +
        'font-size:13px;font-weight:600;color:#1a472a;width:fit-content;flex:0 0 auto;max-width:100%';
      const h1 = cont.querySelector('h1');
      if (h1 && h1.parentNode) h1.parentNode.insertBefore(badgeEl, h1.nextSibling);
      else cont.appendChild(badgeEl);
    }
    badgeEl.style.display = 'inline-flex';
    badgeEl.textContent = '🔄 Compartida ' + n + (n === 1 ? ' vez' : ' veces');
  };

  let badgeIntentado = false;
  const cargarBadge = async () => {
    if (badgeIntentado) return;
    const id = obtenerIdPagina();
    if (!id || !document.getElementById('propiedad-contenido')) return;
    badgeIntentado = true;
    try {
      const res = await fetch('/api/propiedades/' + encodeURIComponent(id) + '/compartir', {
        credentials: 'same-origin'
      });
      if (!res.ok) return; // módulo del backend aún no instalado → sin badge
      const d = await res.json().catch(() => null);
      if (d && typeof d.compartidas === 'number') pintarBadge(d.compartidas);
    } catch (e) { /* silencio: la página no debe verse afectada */ }
  };

  // propiedad.js pinta el contenido de forma asíncrona: esperamos al h1
  const iniciarBadge = () => {
    if (!document.getElementById('propiedad-contenido')) return;
    if (document.querySelector('#propiedad-contenido h1')) { cargarBadge(); return; }
    const obs = new MutationObserver(() => {
      if (document.querySelector('#propiedad-contenido h1')) { obs.disconnect(); cargarBadge(); }
    });
    obs.observe(document.getElementById('propiedad-contenido'), { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 20000);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarBadge);
  } else {
    iniciarBadge();
  }

  // Reintento de la cola local al cargar (por si el backend se instaló después)
  setTimeout(() => { vaciarCola(); }, 1500);

  // Manija de depuración/soporte
  window.__vmCompartidas = {
    version: '1.0',
    cola: () => leerCola(),
    forzarVaciar: () => vaciarCola(),
    idPagina: () => obtenerIdPagina()
  };
})();
