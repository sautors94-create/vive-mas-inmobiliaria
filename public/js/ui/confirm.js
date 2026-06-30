// Modal de confirmación estilo SaaS (reemplaza window.confirm())
// Uso: const ok = await dsConfirm({ title: '¿Eliminar?', message: 'Esta acción no se puede deshacer.', danger: true });
// Devuelve una Promise<boolean>

(() => {
  let estilosInyectados = false;

  function inyectarEstilos() {
    if (estilosInyectados) return;
    estilosInyectados = true;
    const style = document.createElement('style');
    style.textContent = `
      .ds-confirm-overlay {
        position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55);
        backdrop-filter: blur(2px); display: flex; align-items: center;
        justify-content: center; z-index: 10500; opacity: 0;
        transition: opacity 160ms ease; font-family: 'Inter', 'Segoe UI', sans-serif;
      }
      .ds-confirm-overlay.active { opacity: 1; }
      .ds-confirm-box {
        background: white; border-radius: 16px; padding: 28px;
        max-width: 400px; width: 90%; box-shadow: 0 24px 60px rgba(0,0,0,0.28);
        transform: translateY(8px) scale(0.98); transition: transform 160ms ease;
      }
      .ds-confirm-overlay.active .ds-confirm-box { transform: translateY(0) scale(1); }
      .ds-confirm-icon {
        width: 44px; height: 44px; border-radius: 12px; display: flex;
        align-items: center; justify-content: center; font-size: 22px; margin-bottom: 14px;
      }
      .ds-confirm-icon.danger { background: #fef2f2; }
      .ds-confirm-icon.warning { background: #fffbeb; }
      .ds-confirm-icon.info { background: #eff6ff; }
      .ds-confirm-title { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
      .ds-confirm-message { font-size: 14px; color: #64748b; line-height: 1.5; margin-bottom: 22px; }
      .ds-confirm-buttons { display: flex; gap: 10px; }
      .ds-confirm-btn {
        flex: 1; padding: 11px 18px; border: none; border-radius: 10px;
        font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;
      }
      .ds-confirm-btn:hover { opacity: 0.88; }
      .ds-confirm-btn-cancel { background: #f1f5f9; color: #475569; }
      .ds-confirm-btn-confirm { background: var(--primary, #1a472a); color: white; }
      .ds-confirm-btn-confirm.danger { background: #dc2626; }
    `;
    document.head.appendChild(style);
  }

  function dsConfirm({ title = '¿Estás seguro?', message = '', confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false } = {}) {
    inyectarEstilos();

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'ds-confirm-overlay';

      const icono = danger ? '⚠️' : 'ℹ️';
      const claseIcono = danger ? 'danger' : 'info';

      overlay.innerHTML = `
        <div class="ds-confirm-box">
          <div class="ds-confirm-icon ${claseIcono}">${icono}</div>
          <div class="ds-confirm-title"></div>
          <div class="ds-confirm-message"></div>
          <div class="ds-confirm-buttons">
            <button class="ds-confirm-btn ds-confirm-btn-cancel">${cancelText}</button>
            <button class="ds-confirm-btn ds-confirm-btn-confirm ${danger ? 'danger' : ''}">${confirmText}</button>
          </div>
        </div>
      `;

      // textContent para evitar inyección de HTML desde mensajes dinámicos
      overlay.querySelector('.ds-confirm-title').textContent = title;
      overlay.querySelector('.ds-confirm-message').textContent = message;

      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('active'));

      const cerrar = (resultado) => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 160);
        resolve(resultado);
      };

      overlay.querySelector('.ds-confirm-btn-cancel').addEventListener('click', () => cerrar(false));
      overlay.querySelector('.ds-confirm-btn-confirm').addEventListener('click', () => cerrar(true));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cerrar(false);
      });

      const onEsc = (e) => {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', onEsc);
          cerrar(false);
        }
      };
      document.addEventListener('keydown', onEsc);
    });
  }

  window.dsConfirm = dsConfirm;
})();