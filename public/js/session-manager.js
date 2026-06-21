/**
 * SessionManager - Administra el control de sesión y expiración
 * Muestra advertencia 60 segundos antes del expire del token
 */

class SessionManager {
  constructor(options = {}) {
    this.tokenDuration = options.tokenDuration || 15 * 60 * 1000; // 15 min por defecto
    this.warningTime = options.warningTime || 60 * 1000; // 60 seg antes
    this.checkInterval = options.checkInterval || 1000; // verificar cada seg
    
    this.startTime = null;
    this.timer = null;
    this.warningShown = false;
    this.modal = null;
    
    this.init();
  }
  
  init() {
    // Verificar si ya hay un token válido
    const token = localStorage.getItem('accessToken');
    if (token) {
      this.startSession();
    }
    
    // Escuchar cambios en localStorage (login/logout en otras pestañas)
    window.addEventListener('storage', (e) => {
      if (e.key === 'accessToken') {
        if (e.newValue) {
          this.startSession();
        } else {
          this.stopSession();
        }
      }
    });
  }
  
  startSession() {
    this.stopSession(); // Limpiar cualquier sesión previa
    this.startTime = Date.now();
    this.warningShown = false;
    this.startTimer();
  }
  
  stopSession() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.hideModal();
  }
  
  startTimer() {
    this.timer = setInterval(() => this.checkTime(), this.checkInterval);
  }
  
  checkTime() {
    if (!this.startTime) return;
    
    const elapsed = Date.now() - this.startTime;
    const remaining = this.tokenDuration - elapsed;
    
    // Actualizar temporizador en el modal si está abierto
    if (this.modal && this.modal.style.display === 'flex') {
      const timerDisplay = document.getElementById('session-timer');
      if (timerDisplay) {
        timerDisplay.textContent = this.formatTime(remaining);
      }
    }
    
    // Mostrar advertencia cuando queden 60 segundos
    if (remaining <= this.warningTime && !this.warningShown) {
      this.showWarningModal(remaining);
      this.warningShown = true;
    }
    
    // Si el tiempo expired, forzar logout
    if (remaining <= 0) {
      this.stopSession();
      this.forceLogout();
    }
  }
  
  showWarningModal(remaining) {
    // Crear modal si no existe
    if (!this.modal) {
      this.createModal();
    }
    
    // Actualizar tiempo inicial
    const timerDisplay = document.getElementById('session-timer');
    if (timerDisplay) {
      timerDisplay.textContent = this.formatTime(remaining);
    }
    
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
          <button id="btn-keep-session" class="btn-session btn-keep">Mantener sesión</button>
          <button id="btn-renew-session" class="btn-session btn-renew">Renovar token</button>
          <button id="btn-logout-session" class="btn-session btn-logout">Cerrar sesión</button>
        </div>
      </div>
    `;
    
    // Agregar estilos
    const style = document.createElement('style');
    style.textContent = `
      #session-warning-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }
      .session-modal-content {
        background: white;
        padding: 30px;
        border-radius: 15px;
        text-align: center;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      }
      .session-modal-header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin-bottom: 20px;
      }
      .session-icon {
        font-size: 40px;
      }
      .session-modal-header h3 {
        margin: 0;
        color: #d97706;
        font-size: 24px;
      }
      .session-modal-content p {
        color: #6b7280;
        margin: 10px 0;
      }
      .session-timer {
        font-size: 48px;
        font-weight: bold;
        color: #dc2626;
        margin: 20px 0;
      }
      .session-modal-buttons {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 20px;
      }
      .btn-session {
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      .btn-keep {
        background: #10b981;
        color: white;
      }
      .btn-keep:hover {
        background: #059669;
      }
      .btn-renew {
        background: #3b82f6;
        color: white;
      }
      .btn-renew:hover {
        background: #2563eb;
      }
      .btn-logout {
        background: #ef4444;
        color: white;
      }
      .btn-logout:hover {
        background: #dc2626;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.modal);
    
    // Agregar event listeners
    document.getElementById('btn-keep-session').addEventListener('click', () => this.keepSession());
    document.getElementById('btn-renew-session').addEventListener('click', () => this.renewToken());
    document.getElementById('btn-logout-session').addEventListener('click', () => this.doLogout());
  }
  
  hideModal() {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
  }
  
  keepSession() {
    // Reiniciar temporizador (simplemente reinicia la sesión)
    this.hideModal();
    this.startSession();
  }
  
  async renewToken() {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      
      if (data.ok) {
        // Token renouvelado exitosamente
        this.hideModal();
        this.startSession();
      } else {
        // Si falla el refresh, hacer logout
        this.doLogout();
      }
    } catch (error) {
      console.error('Error renew token:', error);
      this.doLogout();
    }
  }
  
  doLogout() {
    this.hideModal();
    // LLamar al logout del auth
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
    // Forzar logout sin confirmación
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    
    // Mostrar mensaje
    alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
    
    const inPages = window.location.pathname.includes('/pages/');
    window.location.href = inPages ? 'login.html' : 'pages/login.html';
  }
  
  formatTime(ms) {
    if (ms < 0) ms = 0;
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  // Método para iniciar manualmente (para usar desde otras partes)
  manualStart() {
    this.startSession();
  }
}

// Inicializar automáticamente cuando el DOM esté listo
let sessionManager;

document.addEventListener('DOMContentLoaded', () => {
  // Solo iniciar si hay un token
  if (localStorage.getItem('accessToken')) {
    sessionManager = new SessionManager();
  }
});

// Exportar para uso global
window.SessionManager = SessionManager;
window.sessionManager = sessionManager;
