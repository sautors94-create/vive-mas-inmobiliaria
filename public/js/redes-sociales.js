/* ═══════════════════════════════════════════════════════════════════
   redes-sociales.js — Vive Más Inmobiliaria
   SUSTITUYE a social-widget.js: muestra nuestras redes sociales
   (Facebook, Instagram y LinkedIn de la empresa) en un panel flotante.
   ───────────────────────────────────────────────────────────────────
   • Crea el panel #vm-redes-panel con los mismos ids y clases de
     siempre, así que tu CSS existente sigue funcionando.
   • Si el HTML de la página YA trae el panel, no lo duplica: solo
     conecta el botón "✕ Cerrar" y el botón flotante "Síguenos".
   • Botón flotante abajo a la IZQUIERDA (para no chocar con el
     chatbot, que suele estar a la derecha).
   • Se abre solo una vez por sesión a los 4 segundos (suave, no
     molesto); después lo controla el visitante.
   • Importante: estos enlaces apuntan a los PERFILES de la empresa
     (facebook.com/1188953474308974, /company/…), NO son enlaces de
     compartir, así que el contador-compartidas.js NO los cuenta.

   INSTALACIÓN (ya aplicada en propiedad.html; opcional en las demás
   páginas si quieres el panel en todo el sitio):
     <script src="../js/redes-sociales.js"></script>
   ═══════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';
  if (window.__vmRedesSocialesLoaded) return;
  window.__vmRedesSocialesLoaded = true;

  const CLAVE_SESION = 'vm_redes_visto';
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

  // ── estilos (solo si la página no trae los suyos; idénticos ids/clases) ──
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
      '#vm-redes-panel .vm-red-link:hover{background:#f0f7f2;color:#1a472a;text-decoration:none}' +
      '#vm-redes-panel .vm-red-icon{width:34px;height:34px;border-radius:50%;display:inline-flex;' +
      'align-items:center;justify-content:center;color:#fff;flex:0 0 auto}' +
      '#vm-redes-cerrar{margin-top:4px;background:none;border:none;color:#6b7280;font-size:12.5px;' +
      'cursor:pointer;padding:6px;border-radius:8px;font-family:inherit}' +
      '#vm-redes-cerrar:hover{background:#f3f4f6;color:#374151}' +
      '#vm-redes-btn{position:fixed;left:16px;bottom:16px;z-index:9600;display:inline-flex;' +
      'align-items:center;gap:8px;background:#1a472a;color:#fff;border:none;border-radius:999px;' +
      'padding:12px 18px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;' +
      'box-shadow:0 8px 20px rgba(26,71,42,.35);transition:filter .12s ease}' +
      '#vm-redes-btn:hover{filter:brightness(1.12)}' +
      '@media (max-width:480px){#vm-redes-panel{left:12px;bottom:76px}#vm-redes-btn{left:12px;bottom:12px}}';
    document.head.appendChild(st);
  };

  const marcarVisto = () => {
    try { sessionStorage.setItem(CLAVE_SESION, '1'); } catch (e) {}
  };
  const yaVisto = () => {
    try { return sessionStorage.getItem(CLAVE_SESION) === '1'; } catch (e) { return false; }
  };

  const iniciar = () => {
    inyectarEstilos();

    // Panel: si la página ya lo trae, se usa; si no, se crea
    let panel = document.getElementById('vm-redes-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'vm-redes-panel';
      panel.innerHTML = HTML_PANEL;
      document.body.appendChild(panel);
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
      if (!panel.classList.contains('abierto')) return;
      if (panel.contains(ev.target) || btn.contains(ev.target) || ev.target === btn) return;
      panel.classList.remove('abierto');
      marcarVisto();
    });

    // Apertura suave una vez por sesión
    if (!yaVisto()) {
      setTimeout(() => {
        if (!panel.classList.contains('abierto')) {
          panel.classList.add('abierto');
          marcarVisto();
        }
      }, DEMORA_APERTURA);
    }

    // Manija de depuración/soporte
    window.__vmRedesSociales = {
      version: '1.0',
      abrir: () => { panel.classList.add('abierto'); marcarVisto(); },
      cerrar: () => { panel.classList.remove('abierto'); marcarVisto(); },
      alternar: () => { panel.classList.toggle('abierto'); },
      visible: () => panel.classList.contains('abierto')
    };
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
