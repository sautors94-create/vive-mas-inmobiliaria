// Minimal Lucide icon injector (no dependencies).
// Replaces <span data-lucide="name"></span> with inline SVG.
// Icons included: home, plus-circle, heart, list, message-square, user, dashboard, hourglass, users, palette, star.

(() => {
  const icons = {
    home: {
      viewBox: '0 0 24 24',
      path: 'M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5z'
    },
    'plus-circle': {
      viewBox: '0 0 24 24',
      path: 'M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10ZM12 8v8M8 12h8'
    },
    heart: {
      viewBox: '0 0 24 24',
      path: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z'
    },
    list: {
      viewBox: '0 0 24 24',
      path: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01'
    },
    'message-square': {
      viewBox: '0 0 24 24',
      path: 'M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8z'
    },
    user: {
      viewBox: '0 0 24 24',
      path: 'M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4z'
    },

    dashboard: {
      viewBox: '0 0 24 24',
      path: 'M3 13h8V3H3v10zm10 8h8V11h-8v10zM13 3v8h8V3h-8zM3 21h8v-6H3v6z'
    },
    hourglass: {
      viewBox: '0 0 24 24',
      path: 'M6 2h12v4a6 6 0 0 1-3 5 6 6 0 0 1 3 5v6H6v-4a6 6 0 0 1 3-5 6 6 0 0 1-3-5V2z'
    },
    users: {
      viewBox: '0 0 24 24',
      path: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm11 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'
    },
    palette: {
      viewBox: '0 0 24 24',
      path: 'M12 3a9 9 0 1 0 0 18h2a3 3 0 0 0 0-6h-1a1 1 0 0 1-1-1 4 4 0 0 1 4-4h1a3 3 0 0 0 0-6h-5z'
    },
    star: {
      viewBox: '0 0 24 24',
      path: 'M12 2l3.2 6.5 7.2 1-5.2 5.1 1.2 7.1L12 18.7 5.6 21.8l1.2-7.1L1.6 9.5l7.2-1L12 2z'
    },
    clock: {
      viewBox: '0 0 24 24',
      path: 'M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10ZM12 7v5l3.5 2'
    },
    'x-circle': {
      viewBox: '0 0 24 24',
      path: 'M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10ZM9 9l6 6M15 9l-6 6'
    },
    eye: {
      viewBox: '0 0 24 24',
      path: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
    },
    'bar-chart-2': {
      viewBox: '0 0 24 24',
      path: 'M6 20V10M12 20V4M18 20v-6'
    },
    'share-2': {
      viewBox: '0 0 24 24',
      path: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.6 13.5l6.8-3.9M8.6 16.5l6.8 3.9'
    }
  };

  function inject() {
    document.querySelectorAll('[data-lucide]').forEach(el => {
      const name = el.getAttribute('data-lucide');
      const icon = icons[name];
      if (!icon) return;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', icon.viewBox);
      svg.setAttribute('width', el.getAttribute('width') || '20');
      svg.setAttribute('height', el.getAttribute('height') || '20');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', icon.path);
      svg.appendChild(path);
      el.innerHTML = '';
      el.appendChild(svg);
    });
  }

  window.dsLucide = { inject };
  document.addEventListener('DOMContentLoaded', inject);
})();