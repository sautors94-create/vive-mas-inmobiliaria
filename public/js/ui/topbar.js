// Premium Topbar interactions: avatar dropdown, notifications dropdown, and search.
// Assumes dsLucide is loaded (optional) and that auth.getUser() is available.

(() => {
  function $(sel) { return document.querySelector(sel); }

  function getUserInitials(nombre = '') {
    const parts = (nombre || '').trim().split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] || 'U';
    const b = parts.length > 1 ? parts[1][0] : '';
    return (a + b).toUpperCase();
  }

  function initTopbar() {
    const avatar = $('.ds-avatar');
    if (!avatar) return; // not present on page

    const userSpan = $('#ds-user-name');
    const initialsSpan = $('#ds-user-initials');

    try {
      if (window.auth && auth.getUser) {
        const u = auth.getUser();
        if (u?.nombre) {
          if (userSpan) userSpan.textContent = u.nombre;
          if (initialsSpan) initialsSpan.textContent = getUserInitials(u.nombre);
          const plan = $('#ds-user-plan');
          if (plan) plan.textContent = `Plan ${u.plan || ''}`.trim();
          const av = $('#ds-avatar-bg');
          if (av) av.style.background = 'linear-gradient(135deg,var(--accent-dark),#123b20)';
        }
      }
    } catch (_) {}

    // Dropdown toggles
    const avatarBtn = $('#ds-avatar-btn');
    const notifBtn = $('#ds-notif-btn');

    const avatarMenu = $('#ds-avatar-menu');
    const notifMenu = $('#ds-notif-menu');

    function closeMenus() {
      if (avatarMenu) avatarMenu.classList.remove('open');
      if (notifMenu) notifMenu.classList.remove('open');
    }

    avatarBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!avatarMenu) return;
      notifMenu?.classList.remove('open');
      avatarMenu.classList.toggle('open');
    });

    notifBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenus();
      if (typeof window.mostrarSeccion === 'function') {
        window.mostrarSeccion('inicio');
      } else {
        const inPages = window.location.pathname.includes('/pages/');
        window.location.href = inPages ? 'dashboard.html' : 'pages/dashboard.html';
      }
    });

    document.addEventListener('click', () => closeMenus());

    // Mark all as read (demo/placeholder; uses existing endpoints if present)
    $('#ds-notif-mark-all')?.addEventListener('click', async (e) => {
      e.preventDefault();
      const dot = $('#ds-notif-dot');
      if (dot) dot.style.display = 'none';
      try {
        if (window.api && api.patch) {
          await api.patch('/auth/notificaciones/marcar-leidas', {});
        }
      } catch (_) {}
      closeMenus();
    });

    // Search box (global filter placeholder)
    const searchInput = $('#ds-global-search');
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = (searchInput.value || '').trim();
        if (!q) return;
        // fallback: just show toast if available
        if (window.dsToast) dsToast({ title: 'Búsqueda', message: `Filtrando por: ${q}`, type: 'info' });
      }
    });

    // Initial close
    closeMenus();
  }

  document.addEventListener('DOMContentLoaded', initTopbar);
})();

