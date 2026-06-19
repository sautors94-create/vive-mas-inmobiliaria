const auth = {
  getToken: () => localStorage.getItem('accessToken'),
  getUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
  isLoggedIn: () => !!localStorage.getItem('accessToken'),
  isAdmin: () => {
    const user = auth.getUser();
    return user && user.role === 'admin';
  },
  save: (accessToken, user) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('user', JSON.stringify(user));
  },
  logout: async () => {
    await api.post('/auth/logout', {});
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    window.location.href = '/';
  }
};

// Toggle mostrar/ocultar contraseña
const togglePassword = (inputId) => {
  const input = document.getElementById(inputId);
  const btn = input.nextElementSibling;
  const icon = btn.querySelector('span');
  if (input.type === 'password') {
    input.type = 'text';
    icon.textContent = '🙈';
  } else {
    input.type = 'password';
    icon.textContent = '👁';
  }
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

document.addEventListener('DOMContentLoaded', actualizarNavbar);  