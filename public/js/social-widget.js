/* ═══════════════════════════════════════════════════════════════════
   social-widget.js v2.0 — Vive Más Inmobiliaria
   (gemelo de redes-sociales.js v2.0: mismo código, dos nombres)
   ⚠️ ESTE ARCHIVO REEMPLAZA AL social-widget.js ANTIGUO: al subirlo
   al servidor, TODAS las páginas que ya lo cargan muestran el widget
   nuevo sin tocar un solo HTML. Si una página también cargara
   redes-sociales.js, el segundo script se detecta y no se duplica.
   ───────────────────────────────────────────────────────────────────
   NOVEDADES v2.0:
   1) FUNCIONA EN TODO EL SITIO: no depende de ninguna página; en
      cualquier página que cargue este archivo (o social-widget.js)
      aparece el botón "💚 Síguenos" y su panel de redes.
   2) SIGUE EL TEMA DEL ADMIN: el color del botón sale de la variable
      CSS --primary (la que pisa el selector de temas con vm_tema);
      el verde #1a472a queda SOLO como respaldo cuando no hay tema.
      La sombra y el color del texto se calculan solos y se actualizan
      EN VIVO si el tema cambia sin recargar la página.
   3) ✕ PARA QUITARLO POR COMPLETO: el botón "Síguenos" trae una mini ✕
      en la esquina; al pulsarla el widget desaparece entero durante
      esa sesión (recargando la página vuelve). El "✕ Cerrar" del panel
      sigue igual que siempre: solo cierra el panel.

   Se mantiene de la v1.0:
   • Panel #vm-redes-panel con los mismos ids y clases de siempre
     (tu CSS existente sigue funcionando); si la página ya trae el
     panel, no lo duplica: lo adopta y conecta los botones.
   • Botón abajo a la IZQUIERDA (no choca con el chatbot).
   • Autoapertura suave a los 4 segundos UNA vez por sesión.
   • Los enlaces apuntan a los PERFILES de la empresa, NO son enlaces
     de compartir, así que contador-compartidas.js NO los cuenta.

   INSTALACIÓN (sitio completo, 1 solo paso):
     - Subir ESTE archivo a la carpeta js/ del hosting reemplazando el
       social-widget.js antiguo. No hay que editar ningún HTML.
     - Si alguna página no carga social-widget.js, ahí sí añade:
       <script src="js/redes-sociales.js"></script>
   ═══════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';
  if (window.__vmRedesSocialesLoaded) return;
  window.__vmRedesSocialesLoaded = true;

  const CLAVE_VISTO = 'vm_redes_visto';
  const CLAVE_CERRADO = 'vm_redes_cerrado';
  const DEMORA_APERTURA = 4000; // ms

  // Marcado idéntico al que tenía el sitio (mismos íconos SVG)
  const HTML_PANEL =
    '<a class="vm-red-link" href="https://www.facebook.com/1188953474308974" target="_blank" rel="noopener noreferrer">' +
      '<span class="vm-red-icon" style="background:#1877F2">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94z"></path></svg>' +
      '</span>Facebook</a>' +
    '<a class="vm-red-link" href="https://www.instagram.com/somos_vivemasinmobiliaria/" target="_blank" rel="noopener noreferrer">' +
      '<span class="vm-red-icon" style="background:#E1306C">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2c2.72 0 3.06.01 4.12.06 1.06.05 1.79.22 2.43.47.66.26 1.21.6 1.76 1.15.55.55.9 1.1 1.15 1.76.25.64.42 1.37.47 2.43.05 1.06.06 1.4.06 4.12s-.01 3.06-.06 4.12c-.05 1.06-.22 1.79-.47 2.43a4.9 4.9 0 01-1.15 1.76 4.9 4.9 0 01-1.76 1.15c-.64.25-1.37.42-2.43.47-1.06.05-1.4.06-4.12.06s-3.06-.01-4.12-.06c-1.06-.05-1.79-.22-2.43-.47a4.9 4.9 0 01-1.76-1.15 4.9 4.9 0 01-1.15-1.76c-.25-.64-.42-1.37-.47-2.43C2.01 15.06 2 14.72 2 12s.01-3.06.06-4.12c.05-1.06.22-1.79.47-2.43.26-.66.6-1.21 1.15-1.76A4.9 4.9 0 015.44 2.53c.64-.25 1.37-.42 2.43-.47C8.94 2.01 9.28 2 12 2zm0 1.8c-2.67 0-2.99.01-4.04.06-.87.04-1.34.18-1.65.3-.42.16-.71.35-1.02.66-.31.31-.5.6-.66 1.02-.12.31-.26.78-.3 1.65-.05 1.05-.06 1.37-.06 4.04s.01 2.99.06 4.04c.04.87.18 1.34.3 1.65.16.42.35.71.66 1.02.31.31.6.5 1.02.66.31.12.78.26 1.65.3 1.05.05 1.37.06 4.04.06s2.99-.01 4.04-.06c.87-.04 1.34-.18 1.65-.3.42-.16.71-.35 1.02-.66.31-.31.5-.6.66-1.02.12-.31.26-.78.3-1.65.05-1.05.06-1.37.06-4.04s-.01-2.99-.06-4.04c-.04-.87-.18-1.34-.3-1.65a2.7 2.7 0 00-.66-1.02 2.7 2.7 0 00-1.02-.66c-.31-.12-.78-.26-1.65-.3-1.05-.05-1.37-.06-4.04-.06zm0 3.7a4.5 4.5 0 110 9 4.5 4.5 0 010-9zm0 1.8a2.7 2.7 0 100 5.4 2.7 2.7 0 000-5.4zm4.68-1.98a1.05 1.05 0 110 2.1 1.05 1.05 0 010-2.1z"></path></svg>' +
      '</span>Instagram</a>' +
    '<a class="vm-red-link" href="https://www.linkedin.com/company/somosvivemas/" target="_blank" rel="noopener noreferrer">' +
      '<span class="vm-red-icon" style="background:#0A66C2">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 110-4.14 2.07 2.07 0 010 4.14zM7.12 20.45H3.56V9h3.56v11.45z"></path></svg>' +
      '</span>LinkedIn</a>' +
    '<button id="vm-redes-cerrar" type="button">✕ Cerrar</button>';

  // Mini ✕ que vive dentro del botón flotante (quitar por completo)
  const HTML_X =
    '<span id="vm-redes-btn-x" role="button" tabindex="0"' +
    ' title="Quitar en esta sesión (recargando vuelve)"' +
    ' aria-label="Quitar el widget de redes hasta recargar la página">✕</span>';

  // ── tema del sitio: el botón sigue la variable --primary ──────────
  let observadorTema = null;

  const limpiar = (v) => String(v || '').trim().replace(/!important\s*$/i, '').trim();

  const parsearColor = (txt) => {
    const t = limpiar(txt).toLowerCase();
    if (!t || t === 'transparent' || t === 'currentcolor' || t === 'inherit' ||
        t === 'initial' || t === 'unset') return null;
    let m = t.match(/^#([0-9a-f]{3})$/);
    if (m) {
      const h = m[1];
      return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) };
    }
    m = t.match(/^#([0-9a-f]{6})$/);
    if (m) {
      const h = m[1];
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
    }
    m = t.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      const p = m[1].split(/[,\/\s]+/).filter(Boolean).map(Number);
      if (p.length >= 3 && p.slice(0, 3).every((n) => !isNaN(n))) return { r: p[0], g: p[1], b: p[2] };
    }
    return null;
  };

  const luminancia = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };

  // Lee una variable CSS del :root: primero getComputedStyle (navegadores);
  // como respaldo recorre las hojas de estilo (también funciona en tests).
  const leerVar = (nombre) => {
    try {
      const v = limpiar(getComputedStyle(document.documentElement).getPropertyValue(nombre));
      if (v) return v;
    } catch (e) {}
    try {
      for (const hoja of document.styleSheets) {
        let reglas;
        try { reglas = hoja.cssRules; } catch (e) { continue; }
        for (const regla of reglas) {
          if (!regla || !regla.selectorText || !regla.style) continue;
          const sel = String(regla.selectorText).toLowerCase();
          if (sel === ':root' || sel === 'html' || sel === ':host' || sel === ':host, :root') {
            const v = limpiar(regla.style.getPropertyValue(nombre));
            if (v) return v;
          }
        }
      }
    } catch (e) {}
    return '';
  };

  const sincronizarTema = () => {
    try {
      const c = parsearColor(leerVar('--primary'));
      const raiz = document.documentElement.style;
      if (c) {
        raiz.setProperty('--vmr-sombra', 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',.35)');
        raiz.setProperty('--vmr-texto', luminancia(c) > 0.55 ? '#1f2937' : '#ffffff');
      } else {
        raiz.removeProperty('--vmr-sombra');
        raiz.removeProperty('--vmr-texto');
      }
    } catch (e) {}
  };

  const vigilarTema = () => {
    try {
      let timer = null;
      const reprogramar = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(sincronizarTema, 150);
      };
      observadorTema = new MutationObserver(reprogramar);
      observadorTema.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
      if (document.head) observadorTema.observe(document.head, { childList: true, subtree: true, characterData: true });
      window.addEventListener('pageshow', sincronizarTema);
      window.addEventListener('storage', (ev) => {
        if (!ev || !ev.key || ev.key === 'vm_tema') sincronizarTema();
      });
    } catch (e) {}
  };

  // ── estilos (solo si la página no trae los suyos; mismos ids/clases) ──
  const inyectarEstilos = () => {
    if (document.getElementById('vm-redes-estilos')) return;
    const st = document.createElement('style');
    st.id = 'vm-redes-estilos';
    st.textContent =
      '#vm-redes-panel{position:fixed;left:16px;bottom:84px;z-index:9600;background:#fff;' +
      'border:1px solid #e3ece6;border-radius:16px;box-shadow:0 12px 32px rgba(0,0,0,.18);' +
      'padding:14px;display:none;flex-direction:column;gap:8px;min-width:190px;' +
      'max-width:calc(100vw - 32px);box-sizing:border-box;font-family:inherit}' +
      '#vm-redes-panel.abierto{display:flex}' +
      '#vm-redes-panel .vm-red-link{display:flex;align-items:center;gap:10px;padding:9px 12px;' +
      'border-radius:10px;text-decoration:none;color:#1f2937;font-size:14px;font-weight:600;' +
      'transition:background .12s ease}' +
      '#vm-redes-panel .vm-red-link:hover{background:#f0f7f2;' +
      'background:color-mix(in srgb,var(--primary,#1a472a) 8%,#fff);' +
      'color:var(--primary,#1a472a);text-decoration:none}' +
      '#vm-redes-panel .vm-red-icon{width:34px;height:34px;border-radius:50%;display:inline-flex;' +
      'align-items:center;justify-content:center;color:#fff;flex:0 0 auto}' +
      '#vm-redes-cerrar{margin-top:4px;background:none;border:none;color:#6b7280;font-size:12.5px;' +
      'cursor:pointer;padding:6px;border-radius:8px;font-family:inherit}' +
      '#vm-redes-cerrar:hover{background:#f3f4f6;color:#374151}' +
      '#vm-redes-btn{position:fixed;left:16px;bottom:16px;z-index:9600;display:inline-flex;' +
      'align-items:center;gap:8px;background:var(--primary,#1a472a);color:var(--vmr-texto,#fff);' +
      'border:none;border-radius:999px;padding:12px 18px;font-size:14px;font-weight:700;' +
      'cursor:pointer;font-family:inherit;box-shadow:0 8px 20px var(--vmr-sombra,rgba(26,71,42,.35));' +
      'transition:filter .12s ease}' +
      '#vm-redes-btn:hover{filter:brightness(1.12)}' +
      '#vm-redes-btn-x{position:absolute;top:-7px;right:-7px;width:21px;height:21px;' +
      'border-radius:50%;background:#fff;border:1px solid #d1d5db;color:#4b5563;font-size:11px;' +
      'line-height:1;font-weight:700;display:inline-flex;align-items:center;justify-content:center;' +
      'cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.22);padding:0;font-family:inherit}' +
      '#vm-redes-btn-x:hover{background:#fee2e2;border-color:#fca5a5;color:#b91c1c}' +
      '@media (max-width:480px){#vm-redes-panel{left:12px;bottom:76px}#vm-redes-btn{left:12px;bottom:12px}}';
    document.head.appendChild(st);
  };

  const marcarVisto = () => { try { sessionStorage.setItem(CLAVE_VISTO, '1'); } catch (e) {} };
  const yaVisto = () => { try { return sessionStorage.getItem(CLAVE_VISTO) === '1'; } catch (e) { return false; } };

  const iniciar = () => {
    // Si el visitante lo quitó por completo en esta sesión, no vuelve
    try { if (sessionStorage.getItem(CLAVE_CERRADO) === '1') return; } catch (e) {}

    inyectarEstilos();
    sincronizarTema(); // por si el tema llegó después de los estilos base
    vigilarTema();

    // Panel: si la página ya lo trae, se usa; si no, se crea
    let panel = document.getElementById('vm-redes-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'vm-redes-panel';
      panel.innerHTML = HTML_PANEL;
      document.body.appendChild(panel);
    } else if (!panel.querySelector('#vm-redes-cerrar')) {
      // Panel adoptado sin botón de cierre: se lo ponemos
      const c = document.createElement('button');
      c.id = 'vm-redes-cerrar';
      c.type = 'button';
      c.textContent = '✕ Cerrar';
      panel.appendChild(c);
    }
    // Arranca cerrado (aunque el HTML estático traiga class="abierto");
    // la apertura automática la controla este script.
    panel.classList.remove('abierto');

    // Botón flotante "Síguenos" (por si la página no trae uno propio)
    let btn = document.getElementById('vm-redes-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'vm-redes-btn';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Síguenos en nuestras redes sociales');
      btn.innerHTML = '<span aria-hidden="true">💚</span> Síguenos';
      document.body.appendChild(btn);
    }
    // La mini ✕ vive DENTRO del botón; si el botón era propio de la
    // página y no la traía, se la agregamos igual.
    if (!btn.querySelector('#vm-redes-btn-x')) btn.insertAdjacentHTML('beforeend', HTML_X);

    const quitarTodo = () => {
      try { sessionStorage.setItem(CLAVE_CERRADO, '1'); } catch (e) {}
      try { if (observadorTema) observadorTema.disconnect(); } catch (e) {}
      try { panel.remove(); } catch (e) {}
      try { btn.remove(); } catch (e) {}
    };

    const x = btn.querySelector('#vm-redes-btn-x');
    if (x) {
      x.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation(); // NO alterna el panel: solo quita el widget
        quitarTodo();
      });
      x.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); quitarTodo(); }
      });
    }

    btn.addEventListener('click', () => {
      panel.classList.toggle('abierto');
      if (panel.classList.contains('abierto')) marcarVisto();
    });

    const cerrar = document.getElementById('vm-redes-cerrar');
    if (cerrar) {
      cerrar.addEventListener('click', () => {
        panel.classList.remove('abierto');
        marcarVisto();
      });
    }

    // Clic fuera del panel lo cierra
    document.addEventListener('click', (ev) => {
      if (!panel.isConnected || !btn.isConnected) return;
      if (!panel.classList.contains('abierto')) return;
      if (panel.contains(ev.target) || btn.contains(ev.target) || ev.target === btn) return;
      panel.classList.remove('abierto');
      marcarVisto();
    });

    // Apertura suave una vez por sesión
    if (!yaVisto()) {
      setTimeout(() => {
        if (!panel.isConnected || !btn.isConnected) return; // lo quitaron con la ✕
        if (!panel.classList.contains('abierto')) {
          panel.classList.add('abierto');
          marcarVisto();
        }
      }, DEMORA_APERTURA);
    }

    // Manija de depuración/soporte
    window.__vmRedesSociales = {
      version: '2.0',
      abrir: () => { panel.classList.add('abierto'); marcarVisto(); },
      cerrar: () => { panel.classList.remove('abierto'); marcarVisto(); },
      alternar: () => { panel.classList.toggle('abierto'); },
      visible: () => panel.isConnected && panel.classList.contains('abierto'),
      quitar: quitarTodo,
      refrescarTema: sincronizarTema
    };
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
