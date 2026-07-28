const auth = {
  getToken: () => localStorage.getItem('accessToken'),
  getUser: () => {
    const user = localStorage.getItem('user');
    try {
      return user ? JSON.parse(user) : null;
    } catch (e) {
      return null;
    }
  },
  isLoggedIn: () => !!localStorage.getItem('accessToken'),
  isAdmin: () => {
    const user = auth.getUser();
    return user && user.role === 'admin';
  },
  save: (accessToken, user) => {
    user.twoFactorEnabled = user.twoFactorEnabled || false; // ← ÚNICA LÍNEA NUEVA
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('user', JSON.stringify(user));
  },
  logout: async () => {
    try {
      await api.post('/auth/logout', {});
    } catch (e) {
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
  }
};

// ===========================================
// PREMIUM PASSWORD TOGGLE - SVG ICONS
// ===========================================
const togglePassword = (inputId) => {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  const wrapper = input.parentElement;
  const toggleBtn = wrapper.querySelector('.password-toggle');
  const iconSvg = toggleBtn?.querySelector('.password-icon');
  const label = toggleBtn?.querySelector('.sr-only');
  
  if (input.type === 'password') {
    input.type = 'text';
    if (iconSvg) iconSvg.innerHTML = PREMIUM_ICONS.eyeOff;
    if (label) label.textContent = 'Ocultar contraseña';
  } else {
    input.type = 'password';
    if (iconSvg) iconSvg.innerHTML = PREMIUM_ICONS.eye;
    if (label) label.textContent = 'Mostrar contraseña';
  }
};

const PREMIUM_ICONS = {
  eye: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.13 13.13 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.26 13.26 0 0 0 2 12s3 7 10 7a13.12 13.12 0 0 0 5.24-1.56"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
};

const getBasePath = () => {
  return window.location.pathname.includes('/pages/') ? '' : 'pages/';
};

const actualizarNavbar = () => {
  const btnLogin = document.getElementById('btn-login');
  if (!btnLogin) return;
  const user = auth.getUser();
  if (auth.isLoggedIn() && user) {
    btnLogin.textContent = user.nombre.split(' ')[0];
    btnLogin.href = auth.isAdmin()
      ? getBasePath() + 'admin.html'
      : getBasePath() + 'dashboard.html';
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  if (auth.isLoggedIn()) {
    const esPaginaProtegida = window.location.pathname.includes('dashboard') ||
                               window.location.pathname.includes('admin');
    try {
      const data = await api.get('/auth/perfil');
      if (!data || data.error) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        if (esPaginaProtegida) window.location.href = '/';
      } else {
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
      }
    } catch (e) {}
  }

  actualizarNavbar();
});