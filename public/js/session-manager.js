/**
 * SessionManager - Avisa al usuario antes de que expire su sesión
 * y le da la opción de renovarla manualmente, en vez de cerrarla
 * de golpe sin avisar bien.
 *
 * Nota: la renovación automática y silenciosa ya ocurre en api.js
 * cada vez que se hace una petición y el token expiró. Este módulo
 * es solo un aviso preventivo para sesiones inactivas (sin peticiones).
 */
class SessionManager {
  constructor(options = {}) {
    this.tokenDuration = options.tokenDuration || 15 * 60 * 1000; // 15 min
    this.warningTime = options.warningTime || 60 * 1000; // avisar 60s antes
    this.checkInterval = options.checkInterval || 1000;

    this.startTime = null;
    this.timer = null;
    this.warningShown = false;
    this.modal = null;

    this.init();
  }

  init() {
    if (localStorage.getItem('accessToken')) {
      this.startSession();
    }

    window.addEventListener('storage', (e) => {
      if (e.key === 'accessToken') {
        if (e.newValue) this.startSession();
        else this.stopSession();
      }
    });
  }

  startSession() {
    this.stopSession();
    this.startTime = Date.now();
    this.warningShown = false;
    this.timer = setInterval(() => this.checkTime(), this.checkInterval);
  }

  stopSession() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.hideModal();
  }

  // Llamar esto cada vez que se confirma actividad real (renovación exitosa)
  resetTimer() {
    this.startTime = Date.now();
    this.warningShown = false;
    this.hideModal();
  }

  async checkTime() {
    if (!this.startTime) return;

    const elapsed = Date.now() - this.startTime;
    const remaining = this.tokenDuration - elapsed;

    if (this.modal && this.modal.style.display === 'flex') {
      const timerDisplay = document.getElementById('session-timer');
      if (timerDisplay) timerDisplay.textContent = this.formatTime(remaining);
    }

    if (remaining <= this.warningTime && !this.warningShown) {
      this.warningShown = true;
      this.showWarningModal(remaining);
    }

    if (remaining <= 0) {
      // Antes de cerrar sesión de golpe, intenta renovar en silencio una vez
      this.stopSession();
      const exito = await this.intentarRenovar();
      if (exito) {
        this.startSession();
      } else {
        this.forceLogout();
      }
    }
  }

  async intentarRenovar() {
    try {
      if (typeof renewTokenAndRetry === 'function') {
        const resultado = await renewTokenAndRetry();
        return !!(resultado && resultado.ok);
      }
    } catch (e) {}
    return false;
  }

  showWarningModal(remaining) {
    if (!this.modal) this.createModal();
    const timerDisplay = document.getElementById('session-timer');
    if (timerDisplay) timerDisplay.textContent = this.formatTime(remaining);
    this.modal.style.display = 'flex';
  }

  createModal() {
    this.modal = document.createElement('div');
    this.modal.id = 'session-warning-modal';
    this.modal.innerHTML = `
      <div class="session-modal-content">
        <div class="session-modal-header">
          <span class="session-icon">⏰</span>
          <h3>Sesión por expirar</h3>
        </div>
        <p>Tu sesión expirará en:</p>
        <div id="session-timer" class="session-timer">00:00</div>
        <p>¿Qué deseas hacer?</p>
        <div class="session-modal-buttons">
          <button id="btn-renew-session" class="btn-session btn-renew">Mantener sesión activa</button>
          <button id="btn-logout-session" class="btn-session btn-logout">Cerrar sesión</button>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #session-warning-modal {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(2px);
        display: none; justify-content: center; align-items: center;
        z-index: 10000; font-family: 'Inter', 'Segoe UI', sans-serif;
      }
      .session-modal-content {
        background: white; padding: 32px; border-radius: 16px; text-align: center;
        max-width: 380px; width: 90%; box-shadow: 0 20px 50px rgba(0,0,0,0.25);
      }
      .session-modal-header { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 16px; }
      .session-icon { font-size: 32px; }
      .session-modal-header h3 { margin: 0; color: #0f172a; font-size: 19px; font-weight: 700; }
      .session-modal-content p { color: #64748b; margin: 8px 0; font-size: 14px; }
      .session-timer { font-size: 40px; font-weight: 800; color: #d97706; margin: 14px 0; }
      .session-modal-buttons { display: flex; flex-direction: column; gap: 10px; margin-top: 18px; }
      .btn-session { padding: 12px 24px; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
      .btn-session:hover { opacity: 0.88; }
      .btn-renew { background: var(--primary, #1a472a); color: white; }
      .btn-logout { background: #f1f5f9; color: #475569; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.modal);

    document.getElementById('btn-renew-session').addEventListener('click', () => this.renovarManual());
    document.getElementById('btn-logout-session').addEventListener('click', () => this.doLogout());
  }

  hideModal() {
    if (this.modal) this.modal.style.display = 'none';
  }

  async renovarManual() {
    const exito = await this.intentarRenovar();
    if (exito) {
      this.hideModal();
      this.startSession();
      if (typeof dsToast === 'function') {
        dsToast({ title: 'Sesión renovada', message: 'Tu sesión sigue activa.', type: 'success' });
      }
    } else {
      this.doLogout();
    }
  }

  doLogout() {
    this.hideModal();
    if (typeof auth !== 'undefined' && auth.logout) {
      auth.logout();
    } else {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      const inPages = window.location.pathname.includes('/pages/');
      window.location.href = inPages ? 'login.html' : 'pages/login.html';
    }
  }

  forceLogout() {
    this.hideModal();
    if (typeof dsToast === 'function') {
      dsToast({ title: 'Sesión expirada', message: 'Por favor inicia sesión nuevamente.', type: 'error' });
    }
    setTimeout(() => this.doLogout(), 1200);
  }

  formatTime(ms) {
    if (ms < 0) ms = 0;
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

let sessionManager;

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('accessToken')) {
    sessionManager = new SessionManager();
  }
});

window.SessionManager = SessionManager;