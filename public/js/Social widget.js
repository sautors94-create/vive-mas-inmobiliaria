// ==========================================
// Widget flotante de redes sociales — Vive Más Inmobiliaria
// ==========================================
// Se auto-inyecta en cualquier página que lo cargue (mismo patrón que
// chatbot.js). Botón flotante abajo a la izquierda (el chatbot ya ocupa
// la derecha), con ícono para expandir Facebook/Instagram/LinkedIn y un
// botón para cerrarlo del todo. Si el usuario lo cierra, no vuelve a
// aparecer durante esa sesión de navegación (sessionStorage).

(function () {
  const REDES = [
    {
      nombre: 'Facebook',
      url: 'https://www.facebook.com/1188953474308974',
      color: '#1877F2',
      icono: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94z"/></svg>'
    },
    {
      nombre: 'Instagram',
      url: 'https://www.instagram.com/somos_vivemasinmobiliaria/',
      color: '#E1306C',
      icono: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2c2.72 0 3.06.01 4.12.06 1.06.05 1.79.22 2.43.47.66.26 1.21.6 1.76 1.15.55.55.9 1.1 1.15 1.76.25.64.42 1.37.47 2.43.05 1.06.06 1.4.06 4.12s-.01 3.06-.06 4.12c-.05 1.06-.22 1.79-.47 2.43a4.9 4.9 0 01-1.15 1.76 4.9 4.9 0 01-1.76 1.15c-.64.25-1.37.42-2.43.47-1.06.05-1.4.06-4.12.06s-3.06-.01-4.12-.06c-1.06-.05-1.79-.22-2.43-.47a4.9 4.9 0 01-1.76-1.15 4.9 4.9 0 01-1.15-1.76c-.25-.64-.42-1.37-.47-2.43C2.01 15.06 2 14.72 2 12s.01-3.06.06-4.12c.05-1.06.22-1.79.47-2.43.26-.66.6-1.21 1.15-1.76A4.9 4.9 0 015.44 2.53c.64-.25 1.37-.42 2.43-.47C8.94 2.01 9.28 2 12 2zm0 1.8c-2.67 0-2.99.01-4.04.06-.87.04-1.34.18-1.65.3-.42.16-.71.35-1.02.66-.31.31-.5.6-.66 1.02-.12.31-.26.78-.3 1.65-.05 1.05-.06 1.37-.06 4.04s.01 2.99.06 4.04c.04.87.18 1.34.3 1.65.16.42.35.71.66 1.02.31.31.6.5 1.02.66.31.12.78.26 1.65.3 1.05.05 1.37.06 4.04.06s2.99-.01 4.04-.06c.87-.04 1.34-.18 1.65-.3.42-.16.71-.35 1.02-.66.31-.31.5-.6.66-1.02.12-.31.26-.78.3-1.65.05-1.05.06-1.37.06-4.04s-.01-2.99-.06-4.04c-.04-.87-.18-1.34-.3-1.65a2.7 2.7 0 00-.66-1.02 2.7 2.7 0 00-1.02-.66c-.31-.12-.78-.26-1.65-.3-1.05-.05-1.37-.06-4.04-.06zm0 3.7a4.5 4.5 0 110 9 4.5 4.5 0 010-9zm0 1.8a2.7 2.7 0 100 5.4 2.7 2.7 0 000-5.4zm4.68-1.98a1.05 1.05 0 110 2.1 1.05 1.05 0 010-2.1z"/></svg>'
    },
    {
      nombre: 'LinkedIn',
      url: 'https://www.linkedin.com/company/somosvivemas/',
      color: '#0A66C2',
      icono: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 110-4.14 2.07 2.07 0 010 4.14zM7.12 20.45H3.56V9h3.56v11.45z"/></svg>'
    }
  ];

  if (sessionStorage.getItem('vm_redes_cerrado') === '1') return;

  const style = document.createElement('style');
  style.textContent = `
    #vm-redes-widget { position: fixed; bottom: 24px; left: 20px; z-index: 9997; font-family: Inter, sans-serif; }
    #vm-redes-fab {
      width: 52px; height: 52px; border-radius: 50%;
      background: var(--primary, #1a472a); color: #fff; border: none;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; transition: transform 0.2s;
    }
    #vm-redes-fab:hover { transform: scale(1.06); }
    #vm-redes-panel {
      position: absolute; bottom: 62px; left: 0;
      background: #fff; border-radius: 16px; padding: 10px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.18);
      display: none; flex-direction: column; gap: 8px;
      min-width: 190px;
    }
    #vm-redes-panel.abierto { display: flex; }
    .vm-red-link {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px; border-radius: 10px; text-decoration: none;
      color: #1a1a2e; font-size: 13px; font-weight: 600;
      transition: background 0.15s;
    }
    .vm-red-link:hover { background: #f8f9fa; }
    .vm-red-icon {
      width: 30px; height: 30px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: #fff; flex-shrink: 0;
    }
    #vm-redes-cerrar {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      margin-top: 2px; padding: 6px; border-radius: 10px;
      background: none; border: none; color: #9ca3af; font-size: 11px; cursor: pointer;
    }
    #vm-redes-cerrar:hover { color: #6b7280; }
  `;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.id = 'vm-redes-widget';
  wrap.innerHTML = `
    <div id="vm-redes-panel">
      ${REDES.map(r => `
        <a class="vm-red-link" href="${r.url}" target="_blank" rel="noopener noreferrer">
          <span class="vm-red-icon" style="background:${r.color}">${r.icono}</span>
          ${r.nombre}
        </a>`).join('')}
      <button id="vm-redes-cerrar">✕ Cerrar</button>
    </div>
    <button id="vm-redes-fab" aria-label="Nuestras redes sociales">🔗</button>
  `;
  document.body.appendChild(wrap);

  const panel = wrap.querySelector('#vm-redes-panel');
  wrap.querySelector('#vm-redes-fab').addEventListener('click', () => {
    panel.classList.toggle('abierto');
  });
  wrap.querySelector('#vm-redes-cerrar').addEventListener('click', () => {
    sessionStorage.setItem('vm_redes_cerrado', '1');
    wrap.remove();
  });
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) panel.classList.remove('abierto');
  });
})();