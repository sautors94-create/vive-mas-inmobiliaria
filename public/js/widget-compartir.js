/* ═══════════════════════════════════════════════════════════════════
   widget-compartir.js v1.2 — Vive Más Inmobiliaria
   BOTÓN ÚNICO "Compartir" que despliega TODAS las opciones:
     WhatsApp · SMS · Correo · Telegram · Facebook · X (Twitter)
     LinkedIn · Reddit · Pinterest · Copiar enlace · Compartir (nativo)
   ───────────────────────────────────────────────────────────────────
   • En la vista pública SOLO se ve el botón "📤 Compartir"; al darle
     clic se despliegan las opciones (se cierran con clic fuera o Esc).
   • El CONTEO de compartidas NO se muestra al público: es información
     del publicador (dashboard) y del admin (panel). El contador sigue
     registrando cada clic normalmente.
   • El botón "Compartir…" solo aparece en celulares (navigator.share).
   • "Copiar enlace" usa el portapapeles moderno con respaldo
     compatible y muestra confirmación "✓ Enlace copiado".

   INSTALACIÓN (ya aplicada en propiedad.html):
     <script src="../js/widget-compartir.js"></script>
     <script src="../js/contador-compartidas.js"></script>
   (widget primero, contador después — ambos en las páginas de detalle)
   ═══════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';
  if (window.__vmWidgetCompartirLoaded) return;
  window.__vmWidgetCompartirLoaded = true;

  // ── URL de la propiedad para compartir ──────────────────────────
  // Prefiere og:url / canonical SOLO si traen el id de la propiedad;
  // si no, usa la URL actual de la página (siempre trae ?id=...).
  const urlParaCompartir = () => {
    const candidatos = [
      document.querySelector('meta[property="og:url"]'),
      document.querySelector('link[rel="canonical"]')
    ];
    for (let i = 0; i < candidatos.length; i++) {
      const m = candidatos[i];
      const v = m && (m.getAttribute('content') || m.getAttribute('href') || '');
      if (v && /[?&#]id=/.test(v)) return v;
    }
    try { return window.location.href.split('#')[0]; } catch (e) { return window.location.href; }
  };

  const tituloParaCompartir = () => {
    const cont = document.getElementById('propiedad-contenido');
    const h1 = cont && cont.querySelector('h1');
    if (h1 && h1.textContent.trim()) return h1.textContent.trim();
    const og = document.querySelector('meta[property="og:title"]');
    if (og && og.getAttribute('content')) return og.getAttribute('content');
    return document.title || 'Propiedad en Vive Más Inmobiliaria';
  };

  // ── estilos (se inyectan una sola vez) ──────────────────────────
  const inyectarEstilos = () => {
    if (document.getElementById('vm-wc-estilos')) return;
    const st = document.createElement('style');
    st.id = 'vm-wc-estilos';
    st.textContent =
      '.vm-wc-panel{margin:14px 0 18px;max-width:100%;box-sizing:border-box}' +
      '.vm-wc-toggle{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;' +
      'border:none;border-radius:999px;background:#1a472a;color:#fff;font-size:14px;' +
      'font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 4px 12px rgba(26,71,42,.25);' +
      'transition:filter .12s ease,transform .12s ease}' +
      '.vm-wc-toggle:hover{filter:brightness(1.12);transform:translateY(-1px)}' +
      '.vm-wc-opciones{margin-top:10px;padding:14px 16px;background:#f8faf8;' +
      'border:1px solid #d7e8dc;border-radius:14px;width:fit-content;max-width:100%}' +
      '.vm-wc-opciones[hidden]{display:none}' +
      '.vm-wc-titulo{font-size:14px;font-weight:700;color:#1a472a;margin:0 0 10px;' +
      'display:flex;align-items:center;gap:6px}' +
      '.vm-wc-fila{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
      '.vm-comp{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:none;' +
      'border-radius:999px;font-size:13px;font-weight:600;color:#fff;cursor:pointer;' +
      'text-decoration:none;line-height:1.2;font-family:inherit;' +
      'transition:transform .12s ease,filter .12s ease}' +
      '.vm-comp:hover{filter:brightness(1.1);transform:translateY(-1px);color:#fff;text-decoration:none}' +
      '.vm-comp:active{transform:translateY(0)}' +
      '.vm-comp .vm-comp-ico{font-size:15px;line-height:1}' +
      '.vm-c-whatsapp{background:#25D366}.vm-c-sms{background:#0ea5e9}' +
      '.vm-c-correo{background:#EA4335}.vm-c-telegram{background:#229ED9}' +
      '.vm-c-facebook{background:#1877F2}.vm-c-x{background:#111111}' +
      '.vm-c-linkedin{background:#0A66C2}.vm-c-reddit{background:#FF4500}' +
      '.vm-c-pinterest{background:#E60023}.vm-c-copiar{background:#4b5563}' +
      '.vm-c-nativo{background:#1a472a}' +
      '.vm-c-copiar.vm-copiado{background:#1a472a}' +
      '@media (max-width:480px){.vm-comp{padding:8px 11px;font-size:12px}}';
    document.head.appendChild(st);
  };

  // ── portapapeles con respaldo compatible ────────────────────────
  const copiarAlPortapapeles = async (texto) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(texto);
        return true;
      }
    } catch (e) { /* seguimos con el respaldo */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok2 = document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok2;
    } catch (e) { return false; }
  };

  // ── construcción del panel ──────────────────────────────────────
  let panelEl = null;

  const construirPanel = () => {
    if (panelEl) return;
    inyectarEstilos();

    const url = urlParaCompartir();
    const titulo = tituloParaCompartir();
    const u = encodeURIComponent(url);
    const t = encodeURIComponent(titulo);
    const textoUnaLinea = encodeURIComponent(titulo + ' ' + url);
    const textoConSalto = encodeURIComponent(titulo + '\n\n' + url);

    // [clase de color, ícono, nombre, href, abreEnPestañaNueva]
    const enlaces = [
      ['whatsapp', '💬', 'WhatsApp', 'https://wa.me/?text=' + textoUnaLinea, true],
      ['sms', '📱', 'SMS', 'sms:?&body=' + textoConSalto, false],
      ['correo', '✉️', 'Correo', 'mailto:?subject=' + t + '&body=' + textoConSalto, false],
      ['telegram', '✈️', 'Telegram', 'https://t.me/share/url?url=' + u + '&text=' + t, true],
      ['facebook', '👍', 'Facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + u, true],
      ['x', '🐦', 'X (Twitter)', 'https://twitter.com/intent/tweet?url=' + u + '&text=' + t, true],
      ['linkedin', '💼', 'LinkedIn', 'https://www.linkedin.com/sharing/share-offsite/?url=' + u, true],
      ['reddit', '👽', 'Reddit', 'https://www.reddit.com/submit?url=' + u + '&title=' + t, true],
      ['pinterest', '📌', 'Pinterest', 'https://pinterest.com/pin/create/button/?url=' + u + '&description=' + t, true]
    ];

    panelEl = document.createElement('div');
    panelEl.className = 'vm-wc-panel';
    panelEl.id = 'vm-wc-panel';

    // BOTÓN ÚNICO visible en la página pública
    const btnToggle = document.createElement('button');
    btnToggle.type = 'button';
    btnToggle.className = 'vm-wc-toggle';
    btnToggle.title = 'Mostrar todas las opciones para compartir';
    btnToggle.setAttribute('aria-expanded', 'false');
    btnToggle.setAttribute('aria-controls', 'vm-wc-opciones');
    const icoToggle = document.createElement('span');
    icoToggle.className = 'vm-comp-ico';
    icoToggle.textContent = '📤';
    btnToggle.appendChild(icoToggle);
    btnToggle.appendChild(document.createTextNode('Compartir'));
    panelEl.appendChild(btnToggle);

    // Opciones desplegables (ocultas hasta dar clic en Compartir)
    const opciones = document.createElement('div');
    opciones.className = 'vm-wc-opciones';
    opciones.id = 'vm-wc-opciones';
    opciones.hidden = true;
    panelEl.appendChild(opciones);

    const desplegar = (abrir) => {
      opciones.hidden = !abrir;
      btnToggle.setAttribute('aria-expanded', String(abrir));
    };

    btnToggle.addEventListener('click', () => {
      desplegar(opciones.hidden); // alterna: si estaba cerrado, abre
    });

    // Cerrar con clic fuera del panel o con la tecla Escape
    document.addEventListener('click', (ev) => {
      if (opciones.hidden) return;
      if (panelEl.contains(ev.target)) return;
      desplegar(false);
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !opciones.hidden) desplegar(false);
    });

    const tit = document.createElement('div');
    tit.className = 'vm-wc-titulo';
    tit.textContent = '📤 Comparte esta propiedad';
    opciones.appendChild(tit);

    const fila = document.createElement('div');
    fila.className = 'vm-wc-fila';
    opciones.appendChild(fila);

    enlaces.forEach((def) => {
      const a = document.createElement('a');
      a.className = 'vm-comp vm-c-' + def[0];
      a.href = def[3];
      a.title = 'Compartir por ' + def[2];
      a.setAttribute('aria-label', 'Compartir por ' + def[2]);
      if (def[4]) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      const ico = document.createElement('span');
      ico.className = 'vm-comp-ico';
      ico.textContent = def[1];
      a.appendChild(ico);
      a.appendChild(document.createTextNode(def[2]));
      fila.appendChild(a);
    });

    // Copiar enlace
    const bCopiar = document.createElement('button');
    bCopiar.type = 'button';
    bCopiar.className = 'vm-comp vm-c-copiar';
    bCopiar.title = 'Copiar el enlace de la propiedad';
    bCopiar.setAttribute('aria-label', 'Copiar enlace de la propiedad');
    const icoCopiar = document.createElement('span');
    icoCopiar.className = 'vm-comp-ico';
    icoCopiar.textContent = '🔗';
    bCopiar.appendChild(icoCopiar);
    bCopiar.appendChild(document.createTextNode('Copiar enlace'));
    const htmlOriginal = bCopiar.innerHTML;
    bCopiar.addEventListener('click', async () => {
      const ok2 = await copiarAlPortapapeles(titulo + ' — ' + url);
      bCopiar.classList.add('vm-copiado');
      bCopiar.textContent = ok2 ? '✓ Enlace copiado' : '✗ No se pudo copiar';
      setTimeout(() => {
        bCopiar.classList.remove('vm-copiado');
        bCopiar.innerHTML = htmlOriginal;
      }, 2000);
    });
    fila.appendChild(bCopiar);

    // Menú nativo del celular (solo si el navegador lo soporta)
    try {
      if (navigator.share) {
        const bNat = document.createElement('button');
        bNat.type = 'button';
        bNat.className = 'vm-comp vm-c-nativo';
        bNat.title = 'Más opciones para compartir';
        bNat.setAttribute('aria-label', 'Compartir con otras aplicaciones');
        const icoNat = document.createElement('span');
        icoNat.className = 'vm-comp-ico';
        icoNat.textContent = '📤';
        bNat.appendChild(icoNat);
        bNat.appendChild(document.createTextNode('Compartir…'));
        bNat.addEventListener('click', () => {
          try {
            navigator.share({ title: titulo, text: titulo, url: url }).catch(() => {});
          } catch (e) { /* el usuario canceló o no está disponible */ }
        });
        fila.appendChild(bNat);
      }
    } catch (e) { /* navegadores sin navigator.share */ }
  };

  // ── colocación: después del título (y del badge, si ya existe) ──
  // IMPORTANTE: se inserta dentro del PADRE REAL del h1. En producción
  // el h1 puede venir anidado (p. ej. <div id="propiedad-contenido">
  // <div class="encabezado"><h1>…</h1></div>…), y hacer
  // cont.insertBefore(_, h1.nextSibling) lanza NotFoundError porque el
  // nodo de referencia no es hijo directo del contenedor (bug visto en
  // somosvivemas.com). Misma técnica que usa pintarBadge del contador.
  const colocarPanel = () => {
    try {
      const cont = document.getElementById('propiedad-contenido');
      if (!cont || !panelEl) return;
      const h1 = cont.querySelector('h1');
      if (!h1 || !h1.parentNode) return;
      const padre = h1.parentNode;
      if (panelEl.isConnected && panelEl.parentNode === padre) return;
      const badge = cont.querySelector('.vm-badge-compartidas');
      const ref = (badge && badge.parentNode === padre) ? badge.nextSibling : h1.nextSibling;
      padre.insertBefore(panelEl, ref);
    } catch (e) {
      // Última red de seguridad: el panel al final del contenedor,
      // sin romper nunca la página.
      try {
        const cont = document.getElementById('propiedad-contenido');
        if (cont && panelEl && !panelEl.isConnected) cont.appendChild(panelEl);
      } catch (e2) { /* silencio total */ }
    }
  };

  const arrancar = () => {
    const cont = document.getElementById('propiedad-contenido');
    if (!cont || !cont.querySelector('h1')) return false;
    construirPanel();
    colocarPanel();
    // Si propiedad.js vuelve a renderizar el contenido, el panel se
    // vuelve a insertar solo (nunca se duplica: es un único nodo).
    if (!arrancar._obs) {
      arrancar._obs = new MutationObserver(() => {
        if (panelEl && !panelEl.isConnected && cont.querySelector('h1')) colocarPanel();
      });
      arrancar._obs.observe(cont, { childList: true, subtree: true });
    }
    return true;
  };

  // En propiedad.js el contenido se pinta asíncrono: esperamos al h1
  const esperarH1 = () => {
    const cont = document.getElementById('propiedad-contenido');
    if (!cont) return; // catálogo u otra página: aquí no va el panel
    const obs = new MutationObserver(() => { if (arrancar()) obs.disconnect(); });
    obs.observe(cont, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 20000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { if (!arrancar()) esperarH1(); });
  } else {
    if (!arrancar()) esperarH1();
  }

  // Manija de depuración/soporte
  window.__vmWidgetCompartir = {
    version: '1.2',
    url: () => urlParaCompartir(),
    titulo: () => tituloParaCompartir(),
    visible: () => !!(panelEl && panelEl.isConnected)
  };
})();
