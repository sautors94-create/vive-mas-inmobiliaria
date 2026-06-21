// Simple toast system (client-side only)
// Usage: window.dsToast({ title: 'OK', message: '...', type: 'success'|'error'|'info' })

(() => {
  function ensureWrap() {
    let wrap = document.getElementById('ds-toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'ds-toast-wrap';
      wrap.className = 'ds-toast-wrap';
      document.body.appendChild(wrap);
    }
    return wrap;
  }

  function dsToast({ title = 'Notificación', message = '', type = 'info', duration = 3200 } = {}) {
    const wrap = ensureWrap();

    const toast = document.createElement('div');
    toast.className = `ds-toast ${type}`;

    const dot = document.createElement('div');
    dot.className = 'ds-toast-dot';

    const body = document.createElement('div');
    body.style.flex = '1';

    const t = document.createElement('div');
    t.className = 'ds-toast-title';
    t.textContent = title;

    const m = document.createElement('div');
    m.className = 'ds-toast-msg';
    m.textContent = message;

    body.appendChild(t);
    body.appendChild(m);

    toast.appendChild(dot);
    toast.appendChild(body);

    wrap.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'opacity 160ms ease, transform 160ms ease';
      setTimeout(() => toast.remove(), 180);
    }, duration);
  }

  window.dsToast = dsToast;
})();

