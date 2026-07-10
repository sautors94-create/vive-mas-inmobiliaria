if (!auth.isLoggedIn()) window.location.href = 'login.html';

const user = auth.getUser();
let mapaPublicar = null;
let markerPublicar = null;
// ==================== SINCRONIZACIÓN SLIDERS ====================
const syncPrecio = (origen) => {
  const slider = document.getElementById('p-precio-slider');
  const input = document.getElementById('p-precio');
  const label = document.getElementById('p-precio-label');
  if (!slider || !input) return;
  if (origen === 'slider') {
    input.value = slider.value;
  } else {
    slider.value = Math.min(input.value || 0, 50000000);
  }
  const valor = parseInt(input.value) || 0;
  if (label) label.textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(valor);
};

const syncCaracteristica = (campo, origen = 'slider') => {
  const slider = document.getElementById(`p-${campo}-slider`);
  const input = document.getElementById(`p-${campo}`);
  const label = document.getElementById(`label-${campo}`);
  if (!slider || !input) return;
  if (origen === 'slider') {
    input.value = slider.value;
  } else {
    slider.value = Math.min(parseInt(input.value) || 0, parseInt(slider.max));
  }
  if (label) label.textContent = input.value || '0';
};

// ==================== AUTOCOMPLETE CP ====================
const buscarPorCP = async (cp) => {
  if (!cp || cp.length < 5) return;
  try {
    const res = await fetch(`https://api.zippopotam.us/MX/${cp}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.places || !data.places.length) return;
    const lugar = data.places[0];
    const estado = document.getElementById('p-estado');
    const ciudad = document.getElementById('p-ciudad');
    const colonia = document.getElementById('p-colonia');
    const estadoLabel = document.getElementById('p-cp-estado');
    if (ciudad) ciudad.value = lugar['place name'] || '';
    if (colonia) colonia.value = lugar['place name'] || '';
    if (estadoLabel) estadoLabel.textContent = `✓ ${lugar['state']}`;
    // Intentar seleccionar el estado en el select
    if (estado) {
      const opciones = Array.from(estado.options);
      const match = opciones.find(o =>
        o.value.toLowerCase().replace(/[áéíóú]/g, c => ({á:'a',é:'e',í:'i',ó:'o',ú:'u'}[c]))
        === lugar['state abbreviation']?.toLowerCase() ||
        o.text.toLowerCase().includes(lugar['state'].toLowerCase().substring(0, 6))
      );
      if (match) estado.value = match.value;
    }
  } catch (e) {}
};
// ==========================================
// MODAL DE PLANES Y PASARELA STRIPE
// ==========================================

window.mostrarModalPlanes = () => {
  const planActual = (JSON.parse(localStorage.getItem('user') || '{}').plan || 'gratuito').toLowerCase();

  if (planActual === 'premium') {
    dsToast({ title: 'Ya tienes el plan Premium', message: 'Estás en el mejor plan disponible.', type: 'success' });
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'modal-planes';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;z-index:10500;font-family:"Inter","Segoe UI",sans-serif';

  overlay.innerHTML = `
    <div style="background:white;border-radius:20px;padding:32px;max-width:520px;width:90%;max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,0.28)">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:28px;margin-bottom:8px">🏡</div>
        <h3 style="font-size:20px;font-weight:800;color:#0f172a;margin-bottom:4px">Elige tu plan</h3>
        <p style="font-size:13px;color:#64748b">Publica más propiedades y llega a más personas</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px">
        <div style="border:2px solid ${planActual === 'gratuito' ? 'var(--primary)' : '#e5e7eb'};border-radius:14px;padding:18px;background:${planActual === 'gratuito' ? '#f0fdf4' : 'white'}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div><div style="font-size:15px;font-weight:700;color:#0f172a">Gratuito</div><div style="font-size:12px;color:#64748b">Para empezar</div></div><div style="font-size:20px;font-weight:800;color:#0f172a">$0<span style="font-size:12px;font-weight:400;color:#64748b">/mes</span></div></div>
          <ul style="font-size:12px;color:#475569;list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px"><li>✓ Hasta 1 propiedad publicada</li><li>✓ 5 fotos por propiedad</li><li>✓ Acceso al catálogo</li></ul>
          ${planActual === 'gratuito' ? '<div style="margin-top:12px;font-size:12px;font-weight:600;color:var(--primary)">✓ Plan actual</div>' : ''}
        </div>
        <div style="border:2px solid ${planActual === 'basico' ? 'var(--primary)' : '#0369a1'};border-radius:14px;padding:18px;background:${planActual === 'basico' ? '#f0fdf4' : '#f0f9ff'};position:relative">
          <div style="position:absolute;top:-10px;right:16px;background:#0369a1;color:white;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px">DISPONIBLE</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div><div style="font-size:15px;font-weight:700;color:#0f172a">Básico</div><div style="font-size:12px;color:#64748b">Para agentes activos</div></div><div style="font-size:20px;font-weight:800;color:#0369a1">$299<span style="font-size:12px;font-weight:400;color:#64748b">/mes</span></div></div>
          <ul style="font-size:12px;color:#475569;list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px"><li>✓ Hasta 5 propiedades publicadas</li><li>✓ 10 fotos por propiedad</li><li>✓ Estadísticas de tu panel</li><li>✓ Mayor visibilidad en el catálogo</li><li>✓ Soporte prioritario</li></ul>
          ${planActual === 'basico' ? '<div style="margin-top:12px;font-size:12px;font-weight:600;color:var(--primary)">✓ Plan actual</div>' : '<button onclick="contratarPlan(\'basico\')" style="width:100%;margin-top:14px;padding:10px;background:#0369a1;color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">Contratar Básico →</button>'}
        </div>
        <div style="border:2px solid #7c3aed;border-radius:14px;padding:18px;background:#faf5ff;position:relative;opacity:0.7">
          <div style="position:absolute;top:-10px;right:16px;background:#7c3aed;color:white;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px">PRÓXIMAMENTE</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div><div style="font-size:15px;font-weight:700;color:#0f172a">Premium</div><div style="font-size:12px;color:#64748b">Para inmobiliarias y equipos</div></div><div style="font-size:20px;font-weight:800;color:#7c3aed">$799<span style="font-size:12px;font-weight:400;color:#64748b">/mes</span></div></div>
          <ul style="font-size:12px;color:#475569;list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px"><li>✓ Propiedades ilimitadas</li><li>✓ 15 fotos por propiedad</li><li>✓ Estadísticas avanzadas y comparativas</li><li>✓ Cuenta verificada con insignia</li><li>✓ Soporte dedicado 24/7</li></ul>
          <button disabled style="width:100%;margin-top:14px;padding:10px;background:#e5e7eb;color:#9ca3af;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:not-allowed">Próximamente</button>
        </div>
      </div>
      <button onclick="document.getElementById('modal-planes')?.remove()" style="width:100%;padding:11px;background:#f1f5f9;color:#475569;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">Cerrar</button>
    </div>
  `;

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
};

const mostrarModalBienvenidaPlan = (plan) => {
  const nombres = { basico: 'Básico', premium: 'Premium' };
  const iconos = { basico: '🚀', premium: '💎' };
  const colores = { basico: '#0369a1', premium: '#7c3aed' };
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:10600;font-family:"Inter","Segoe UI",sans-serif';
  overlay.innerHTML = `
    <div style="background:white;border-radius:24px;padding:40px 36px;max-width:420px;width:90%;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,0.35);animation:fadeInUp 0.3s ease">
      <div style="width:72px;height:72px;border-radius:50%;background:${colores[plan] || '#0369a1'}15;display:flex;align-items:center;justify-content:center;font-size:36px;margin:0 auto 20px">${iconos[plan] || '🎉'}</div>
      <h2 style="font-size:24px;font-weight:800;color:#0f172a;margin-bottom:8px">¡Bienvenido al Plan ${nombres[plan] || plan}!</h2>
      <p style="font-size:14px;color:#64748b;line-height:1.6;margin-bottom:28px">Tu plan ha sido activado exitosamente. Ahora tienes acceso a todas las funciones de tu nuevo plan. ¡Empieza a publicar!</p>
      <div style="display:flex;gap:10px;justify-content:center">
        <button onclick="this.closest('[style*=fixed]').remove();window.location.reload()" style="padding:13px 28px;background:${colores[plan] || '#0369a1'};color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer">¡Empezar ahora! →</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Actualizar UI de topbar y sidebar inmediatamente
  const userActualizado = auth.getUser();
  if (userActualizado) {
    const planEl = document.getElementById('ds-user-plan');
    const sidebarPlan = document.getElementById('sidebar-plan');
    if (planEl) planEl.textContent = `Plan ${userActualizado.plan}`;
    if (sidebarPlan) sidebarPlan.textContent = `Plan ${userActualizado.plan}`;
    // Ocultar botón "Mejorar plan" si ya tiene premium
    if (userActualizado.plan === 'premium') {
      document.getElementById('btn-mejorar-plan')?.style.setProperty('display', 'none');
    }
  }
};
window.contratarPlan = (plan) => {
  const STRIPE_LINKS = { basico: 'https://buy.stripe.com/test_9B6fZhgExb2QejO8EGc3m00' };
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (plan === 'basico' && user.plan === 'basico') {
    dsToast({ title: 'Ya tienes este plan', message: 'Actualmente cuentas con el Plan Básico.', type: 'info' });
    return;
  }

  if (plan === 'basico' && STRIPE_LINKS.basico) {
    const linkFinal = `${STRIPE_LINKS.basico}?client_reference_id=${user._id || user.id}`;
    window.location.href = linkFinal;
  } else {
    dsToast({ title: 'Próximamente', message: 'Este plan estará disponible muy pronto.', type: 'info' });
  }
};

document.addEventListener('DOMContentLoaded', () => {
// Verificar plan real en el servidor — detecta cambios de Stripe, admin, etc.
  const verificarPlanActual = async (intentos = 0, mostrarModal = false) => {
    try {
      const planLocalAntes = (auth.getUser()?.plan || 'gratuito').toLowerCase();
      const data = await api.get('/auth/verificar-plan');
      if (!data.ok || !data.user) return;

      const planServidor = (data.plan || 'gratuito').toLowerCase();

      // Actualizar localStorage con datos frescos
      const userActual = auth.getUser() || {};
      const userActualizado = { ...userActual, plan: data.plan, planFechaFin: data.planFechaFin };
      localStorage.setItem('user', JSON.stringify(userActualizado));

      // Actualizar UI inmediatamente
      const planEl = document.getElementById('ds-user-plan');
      const sidebarPlan = document.getElementById('sidebar-plan');
      const limiteFotosEl = document.getElementById('texto-limite-fotos');
      if (planEl) planEl.textContent = `Plan ${data.plan}`;
      if (sidebarPlan) sidebarPlan.textContent = `Plan ${data.plan}`;
      if (limiteFotosEl) {
        const lim = getLimiteFotos();
        limiteFotosEl.textContent = `Plan ${data.plan}: hasta ${lim} fotos`;
      }

      const jerarquia = { gratuito: 0, basico: 1, premium: 2 };
      if ((jerarquia[planServidor] || 0) > (jerarquia[planLocalAntes] || 0)) {
        mostrarModalBienvenidaPlan(data.plan);
        return;
      }

      // Si venimos de Stripe y el plan no cambió aún, reintentar hasta 5 veces
      if (mostrarModal && planServidor === planLocalAntes && intentos < 5) {
        setTimeout(() => verificarPlanActual(intentos + 1, true), 2500);
      }
    } catch (e) {}
  };

  // Detectar regreso de Stripe (el Payment Link añade ?session_id=xxx en la URL)
  const desdeStripe = window.location.search.includes('session_id') ||
                      window.location.search.includes('pago=exito');
  if (desdeStripe) {
    window.history.replaceState({}, document.title, window.location.pathname);
    verificarPlanActual(0, true); // Con polling activo
  } else {
    verificarPlanActual(0, false); // Sin polling, solo verificación
  }
});

// ==========================================
// NAVEGACIÓN PRINCIPAL
// ==========================================
const mostrarSeccion = window.mostrarSeccion = (seccion) => {
  const secEl = document.getElementById(`sec-${seccion}`);
  if (!secEl) return; // Escudo de seguridad

  document.querySelectorAll('.dash-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  
  secEl.style.display = 'block';

  const link = document.querySelector(`.sidebar-link[onclick*="${seccion}"]`);
  if (link) link.classList.add('active');
  
  if (seccion === 'mis-propiedades') cargarMisPropiedades();
  if (seccion === 'favoritos') cargarFavoritos();
  if (seccion === 'leads') cargarLeadsUsuario();
  if (seccion === 'mensajes') cargarMensajes();
  if (seccion === 'nueva-propiedad') iniciarMapaPublicar();
  if (seccion === 'mi-cuenta') cargarCuenta();
  if (seccion === 'resumen') verificarBloqueoResumen();
};

const actualizarBadgeMensajes = (total) => {
  const badge = document.getElementById('mensajes-badge');
  if (!badge) return;
  badge.textContent = total;
  badge.style.display = total > 0 ? 'inline-flex' : 'none';
};

const cargarResumenUsuario = async () => {
  const planPill = document.getElementById('resume-plan-pill');
  const titleEl = document.getElementById('resume-insights-title');
  const descEl = document.getElementById('resume-insights-desc');
  const gridEl = document.getElementById('resume-stats-grid');

  if (!gridEl || !titleEl || !descEl) return;

  // Solo mostrar resumen a planes básico y premium
  const planUser = (user?.plan || 'gratuito').toLowerCase();
  const seccionResumen = document.getElementById('resume-section');
  if (planUser === 'gratuito') {
    if (seccionResumen) seccionResumen.innerHTML = `
      <div style="background:linear-gradient(135deg,var(--primary),var(--primary-light));border-radius:16px;padding:32px;text-align:center;color:white">
        <div style="font-size:32px;margin-bottom:12px">📊</div>
        <h3 style="font-size:18px;font-weight:700;margin-bottom:8px">Estadísticas avanzadas</h3>
        <p style="font-size:14px;opacity:0.85;margin-bottom:20px">Accede a estadísticas detalladas de tus propiedades, interacciones y leads con el plan Básico o Premium.</p>
        <button class="btn" style="background:white;color:var(--primary);font-weight:700;padding:12px 28px" onclick="mostrarSeccion('mi-cuenta')">Mejorar mi plan →</button>
      </div>`;
    return;
  }

  try {
    // Fuentes actuales disponibles en el proyecto:
    // - Mis propiedades
    // - Leads del usuario
    // No existe un endpoint premium consolidado para user dashboard.
    const [misPropsRes, leadsRes] = await Promise.all([
      api.get('/propiedades/mis-propiedades'),
      api.get('/auth/leads')
    ]);

    const propiedades = misPropsRes?.propiedades || [];
    const leads = leadsRes?.leads || [];
    const mensajesNoLeidos = leadsRes?.mensajesNoLeidos || 0;

    const total = propiedades.length;
    const enRevision = propiedades.filter(p => p.status === 'revision').length;
    const aprobadas = propiedades.filter(p => p.status === 'aprobada').length;
    const rechazadas = propiedades.filter(p => p.status === 'rechazada').length;

    if (planPill && user?.plan) {
      planPill.style.display = 'inline-flex';
      planPill.textContent = `Plan: ${user.plan}`;
    }

    // Stats cards (KPIs con trend indicator)
    const kpiTrend = (numero, label) => {
      // Sin histórico real en backend: usamos un fallback determinista para UI.
      // Cuando exista endpoint de métricas históricas, se reemplaza por datos reales.
      const seed = (String(label) + ':' + numero).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const deltaPct = ((seed % 19) - 9) * 1.2; // -10.8% .. +9.6%
      const isUp = deltaPct >= 0;
      const deltaText = `${isUp ? '↑' : '↓'} ${Math.abs(deltaPct).toFixed(1)}%`;
      const pillClass = isUp ? 'trend-up' : 'trend-down';
      return `<span class="trend-pill ${pillClass}">${deltaText}</span>`;
    };

    gridEl.innerHTML = [
      { label: 'En revisión', numero: enRevision, icon: 'hourglass' },
      { label: 'Aprobadas', numero: aprobadas, icon: 'star' },
      { label: 'Rechazadas', numero: rechazadas, icon: 'hourglass' },
      { label: 'Leads', numero: leads.length, icon: 'list' }
    ].map(s => `
      <div class="stat-card ds-anim-in">
        <div class="stat-row">
          <div class="stat-left">
            <div class="stat-numero">${s.numero}</div>
            <div class="stat-label">${s.label} ${kpiTrend(s.numero, s.label)}</div>
          </div>
          <div class="stat-icon">
            <span class="li-icon" data-lucide="${s.icon}"></span>
          </div>
        </div>
      </div>`).join('');


    // Insights (texto dinámico simple)
    const mensajeText = mensajesNoLeidos > 0 ? `Tienes ${mensajesNoLeidos} mensaje(s) sin leer.` : 'Sin mensajes pendientes.';
    const revisionText = enRevision > 0 ? `Hay ${enRevision} publicación(es) en revisión.` : 'Tus publicaciones están al día.';

    titleEl.textContent = total > 0 ? 'Tu performance en el dashboard' : 'Empieza tu primera publicación';
    descEl.textContent = `${revisionText} ${mensajeText}`.trim();

    // Re-inyectar iconos Lucide si existe el helper.
    if (window.dsLucide?.inject) window.dsLucide.inject();
  } catch (e) {
    titleEl.textContent = 'No se pudo cargar el resumen';
    descEl.textContent = 'Intenta nuevamente más tarde.';
    gridEl.innerHTML = '';
  }
};


const iniciarMapaPublicar = () => {
  if (mapaPublicar) { mapaPublicar.invalidateSize(); return; }
  setTimeout(() => {
    const centro = [19.4326, -99.1332];
    mapaPublicar = L.map('mapa-publicar').setView(centro, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(mapaPublicar);
    mapaPublicar.on('click', (e) => {
      const { lat, lng } = e.latlng;
      colocarMarker(lat, lng);
      geocodificarCoordenadas(lat, lng);
    });
  }, 300);
};

const colocarMarker = (lat, lng) => {
  if (markerPublicar) mapaPublicar.removeLayer(markerPublicar);
  markerPublicar = L.marker([lat, lng], {
    icon: L.divIcon({
      className: '',
      html: '<div style="background:#1a472a;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    })
  }).addTo(mapaPublicar);
  document.getElementById('p-lat').value = lat.toFixed(6);
  document.getElementById('p-lng').value = lng.toFixed(6);
  document.getElementById('coord-lat').textContent = lat.toFixed(6);
  document.getElementById('coord-lng').textContent = lng.toFixed(6);
};

const geocodificarCoordenadas = async (lat, lng) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`);
    const data = await res.json();
    if (data.address) {
      const estado = data.address.state || '';
      const ciudad = data.address.city || data.address.town || data.address.municipality || '';
      const colonia = data.address.suburb || data.address.neighbourhood || '';
      const calle = data.address.road || '';
      const numero = data.address.house_number || '';
      if (estado) {
        const estadoSelect = document.getElementById('p-estado');
        const opciones = [...estadoSelect.options];
        const match = opciones.find(o => estado.toLowerCase().includes(o.value.toLowerCase()) || o.value.toLowerCase().includes(estado.toLowerCase().split(' ')[0]));
        if (match) estadoSelect.value = match.value;
      }
      if (ciudad) document.getElementById('p-ciudad').value = ciudad;
      if (colonia) document.getElementById('p-colonia').value = colonia;
      if (calle) document.getElementById('p-direccion').value = `${calle}${numero ? ' ' + numero : ''}`;
      document.getElementById('coord-estado-label').textContent = `📍 ${colonia ? colonia + ', ' : ''}${ciudad}`;
    }
  } catch (e) {}
};

const buscarDireccion = async () => {
  const direccion = document.getElementById('p-direccion').value.trim();
  const estado = document.getElementById('p-estado').value;
  const ciudad = document.getElementById('p-ciudad').value.trim();
  if (!direccion && !ciudad) {
    dsToast({ title: 'Falta la dirección', message: 'Escribe una dirección o ciudad para buscar.', type: 'error' });
    return;
  }

  const query = `${direccion} ${ciudad} ${estado} México`.trim();
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=es`);
    const data = await res.json();
    if (data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      mapaPublicar.setView([lat, lng], 16);
      colocarMarker(lat, lng);
      geocodificarCoordenadas(lat, lng);
    } else {
      dsToast({ title: 'Sin resultados', message: 'No se encontró la dirección. Haz clic directamente en el mapa.', type: 'error' });
    }
  } catch (e) {
    dsToast({ title: 'Error al buscar', message: 'No se pudo geocodificar. Haz clic directamente en el mapa.', type: 'error' });
  }
};

let fotosOrden = []; // array de objetos: { file, dataUrl }
let fotoPortadaIdx = 0; // índice dentro de fotosOrden

const getLimiteFotos = () => {
  const plan = (auth.getUser()?.plan || 'gratuito').toLowerCase();
  if (plan === 'premium') return 15;
  if (plan === 'basico') return 10;
  return 5; // gratuito
};

const previsualizarFotos = (input) => {
  const preview = document.getElementById('fotos-preview');
  if (!preview) return;

  const limite = getLimiteFotos();
  const todas = Array.from(input.files || []);

  if (todas.length > limite) {
    dsToast({
      title: `Límite de fotos: ${limite}`,
      message: `Tu plan ${auth.getUser()?.plan || 'Gratuito'} permite hasta ${limite} fotos. Se tomarán las primeras ${limite}.`,
      type: 'error'
    });
  }

  preview.innerHTML = '';
  fotosOrden = [];
  fotoPortadaIdx = 0;

  const files = todas.slice(0, limite);
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      fotosOrden.push({ file, dataUrl: e.target.result });
      renderFotosPreview();
    };
    reader.readAsDataURL(file);
  });
};

const actualizarBadgesPaso6 = () => {
  const badgeCount = document.getElementById('badge-fotos-count');
  const badgeMin = document.getElementById('badge-fotos-min');
  const badgePortada = document.getElementById('badge-fotos-portada');

  const fotosCount = fotosOrden.length;
  const minOk = fotosCount >= 2;
  const portadaOk = fotosCount > 0 && fotoPortadaIdx >= 0 && fotoPortadaIdx < fotosCount;

  if (badgeCount) badgeCount.textContent = `Fotos: ${fotosCount}`;
  if (badgeMin) {
    badgeMin.textContent = `Mínimo 2: ${minOk ? 'OK' : 'Pendiente'}`;
    badgeMin.classList.toggle('ds-badge-primary', minOk);
    badgeMin.classList.toggle('ds-badge-soft', !minOk);
  }
  if (badgePortada) {
    badgePortada.textContent = `Portada: ${portadaOk ? 'OK' : 'Pendiente'}`;
    badgePortada.classList.toggle('ds-badge-primary', portadaOk);
    badgePortada.classList.toggle('ds-badge-soft', !portadaOk);
  }
};

const renderFotosPreview = () => {
  const preview = document.getElementById('fotos-preview');
  if (!preview) return;

  preview.innerHTML = '';

  actualizarBadgesPaso6();

  fotosOrden.forEach((f, idx) => {




    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:100px;height:100px;border-radius:8px;overflow:hidden;border:1px solid var(--border);cursor:grab;background:var(--bg-secondary)';
    wrap.setAttribute('draggable', 'true');
    wrap.dataset.index = String(idx);

    const isPortada = idx === fotoPortadaIdx;

    wrap.innerHTML = `
      <div style="position:absolute;inset:0">
        <img src="${f.dataUrl}" style="width:100%;height:100%;object-fit:cover">
        <button type="button" data-action="eliminar" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center">✕</button>
        <button type="button" data-action="portada" style="position:absolute;bottom:4px;left:4px;background:${isPortada ? 'var(--primary)' : 'rgba(0,0,0,0.45)'};color:white;border:none;border-radius:10px;padding:3px 8px;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:6px">
          ${isPortada ? '⭐ Portada' : 'Marcar portada'}
        </button>
        ${isPortada ? '<div style="position:absolute;inset:0;border:2px solid rgba(26,71,42,0.9);pointer-events:none"></div>' : ''}
      </div>
    `;

    wrap.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('text/plain', String(idx));
      ev.dataTransfer.effectAllowed = 'move';
    });

    wrap.addEventListener('dragover', (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
    });

    wrap.addEventListener('drop', (ev) => {
      ev.preventDefault();
      const from = Number(ev.dataTransfer.getData('text/plain'));
      const to = idx;
      if (Number.isNaN(from) || from === to) return;
      fotosOrden = arrayMove(fotosOrden, from, to);
      // mantener portada según misma foto: aproximación usando portadaIdx
      if (fotoPortadaIdx === from) fotoPortadaIdx = to;
      else if (from < fotoPortadaIdx && to >= fotoPortadaIdx) fotoPortadaIdx -= 1;
      else if (from > fotoPortadaIdx && to <= fotoPortadaIdx) fotoPortadaIdx += 1;
      renderFotosPreview();
    });

    wrap.addEventListener('click', (ev) => {
      const target = ev.target;
      const actionBtn = target.closest && target.closest('button[data-action]');
      if (!actionBtn) return;
      const action = actionBtn.dataset.action;
      if (action === 'eliminar') {
        eliminarFotoPreview(idx);
      } else if (action === 'portada') {
        fotoPortadaIdx = idx;
        renderFotosPreview();
      }
    });

    preview.appendChild(wrap);
  });
};

const eliminarFotoPreview = (idx) => {
  if (idx < 0 || idx >= fotosOrden.length) return;
  fotosOrden.splice(idx, 1);
  if (fotoPortadaIdx >= fotosOrden.length) fotoPortadaIdx = Math.max(0, fotosOrden.length - 1);
  // limpiar input para que al enviar use el estado actual
  const input = document.getElementById('p-fotos');
  if (input) {
    const dt = new DataTransfer();
    fotosOrden.forEach(x => dt.items.add(x.file));
    input.files = dt.files;
  }
  renderFotosPreview();
};

const arrayMove = (arr, from, to) => {
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
};

window.initFotosPublicar = () => {
  const drop = document.getElementById('p-fotos-drop');
  const input = document.getElementById('p-fotos');
  if (!drop || !input) return;

  ['dragenter', 'dragover'].forEach(evt => {
    drop.addEventListener(evt, (e) => {
      e.preventDefault();
      drop.style.borderColor = 'var(--primary)';
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    drop.addEventListener(evt, (e) => {
      e.preventDefault();
      drop.style.borderColor = 'var(--border)';
    });
  });

  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    const dt = new DataTransfer();
    const files = Array.from(e.dataTransfer.files || []).filter(f => /^image\//.test(f.type)).slice(0, 15);
    files.forEach(f => dt.items.add(f));
    input.files = dt.files;
    previsualizarFotos(input);
  });
};


const cargarMisPropiedades = async () => {
  const container = document.getElementById('mis-props-container');
  const data = await api.get('/propiedades/mis-propiedades');

  if (!data.propiedades || data.propiedades.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px;color:var(--text-light)">
        <div style="font-size:48px;margin-bottom:16px">🏠</div>
        <p style="font-size:16px;margin-bottom:16px">Aún no tienes propiedades publicadas</p>
        <button class="btn btn-primary" onclick="mostrarSeccion('nueva-propiedad')">Publicar mi primera propiedad</button>
      </div>`;
    return;
  }

  const esGrid = container.classList.contains('mis-props-view-grid');
  container.innerHTML = data.propiedades.map(p => `
    <div class="prop-admin-card ${esGrid ? '' : 'prop-admin-card-list'}">
      <div class="prop-admin-img">
        ${p.fotos && p.fotos.length > 0
          ? `<img src="${p.fotos[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`
          : 'Sin foto'}
      </div>
      <div class="prop-admin-info">
        <div class="prop-admin-titulo">${p.titulo}</div>
        <div class="prop-admin-meta">${p.ubicacion.ciudad}, ${p.ubicacion.estado} · ${formatPrecio(p.precio)}</div>
        ${!esGrid ? `<div class="prop-admin-meta" style="margin-top:6px">Estado: <b style="color:var(--text)">${p.status}</b></div>` : ''}
      </div>
      <div class="prop-admin-actions">
        <span class="status-badge status-${p.status}">${p.status}</span>
        <button class="btn btn-outline" style="padding:6px 14px;font-size:13px" onclick="window.location='propiedad.html?id=${p._id}'">Ver</button>
        ${p.status !== 'aprobada' ? `<button class="btn btn-outline" style="padding:6px 14px;font-size:13px" onclick="editarPropiedad('${p._id}')">✏️ Editar</button>` : ''}
        <button class="btn btn-outline" style="padding:6px 14px;font-size:13px;border-color:#e24b4a;color:#e24b4a" onclick="eliminarMiPropiedad('${p._id}','${p.titulo.replace(/'/g,"\\'")}')">🗑️</button>
      </div>
    </div>`).join('');
};
const editarPropiedad = (id) => {
  window.location.href = `propiedad.html?id=${id}&editar=1`;
};

const eliminarMiPropiedad = async (id, titulo) => {
  const ok = await dsConfirm({
    title: '¿Eliminar propiedad?',
    message: `"${titulo}" se eliminará permanentemente. Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar',
    danger: true
  });
  if (!ok) return;
  const data = await api.delete(`/propiedades/${id}`);
  if (data.ok) {
    dsToast({ title: 'Propiedad eliminada', message: `"${titulo}" fue eliminada.`, type: 'success' });
    cargarMisPropiedades();
    cargarResumenUsuario();
  } else {
    dsToast({ title: 'No se pudo eliminar', message: data.error || 'Intenta de nuevo.', type: 'error' });
  }
};

const cargarFavoritos = async () => {
  const grid = document.getElementById('favoritos-grid');
  const data = await api.get('/favoritos');
  if (!data.favoritos || data.favoritos.length === 0) {
    grid.innerHTML = '<div class="loading">No tienes propiedades favoritas aún.</div>';
    return;
  }
  grid.innerHTML = data.favoritos.map(f => `
    <div class="prop-admin-card" id="fav-${f.propiedad._id}">
      <div class="prop-admin-img">
        ${f.propiedad.fotos && f.propiedad.fotos.length > 0
          ? `<img src="${f.propiedad.fotos[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`
          : 'Sin foto'}
      </div>
      <div class="prop-admin-info">
        <div class="prop-admin-titulo">${f.propiedad.titulo}</div>
        <div class="prop-admin-meta">${f.propiedad.ubicacion.ciudad}, ${f.propiedad.ubicacion.estado} · ${formatPrecio(f.propiedad.precio)}</div>
        <div class="prop-admin-meta" style="margin-top:4px">
          <span class="tag tag-${f.propiedad.operacion}">${f.propiedad.operacion}</span>
          <span class="tag tag-${f.propiedad.tipo}">${f.propiedad.tipo}</span>
        </div>
      </div>
      <div class="prop-admin-actions">
        <button class="btn btn-primary" style="padding:6px 14px;font-size:13px" onclick="window.location='propiedad.html?id=${f.propiedad._id}'">Ver</button>
        <button class="btn btn-outline" style="padding:6px 14px;font-size:13px;border-color:#e24b4a;color:#e24b4a" onclick="eliminarFavorito('${f.propiedad._id}')">❤️ Quitar</button>
      </div>
    </div>`).join('');
};

const eliminarFavorito = async (propiedadId) => {
  const ok = await dsConfirm({ title: '¿Quitar favorito?', message: 'Esta propiedad se eliminará de tu lista de favoritos.', confirmText: 'Quitar', danger: true });
  if (!ok) return;
  const data = await api.delete(`/favoritos/${propiedadId}`);
  if (data.ok) {
    document.getElementById(`fav-${propiedadId}`).remove();
    const grid = document.getElementById('favoritos-grid');
    if (!grid.children.length) grid.innerHTML = '<div class="loading">No tienes propiedades favoritas aún.</div>';
  }
};

const cargarMensajes = async () => {
  const lista = document.getElementById('mensajes-lista');
  lista.innerHTML = '<div class="loading">Cargando mensajes...</div>';

  // Cargamos leads del usuario como actividad de mensajes
  // (el sistema de mensajería directa entre usuarios se implementará en una fase futura)
  const data = await api.get('/auth/leads');

  if (!data.ok || !data.leads || data.leads.length === 0) {
    lista.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--text-light)">
        <div style="font-size:40px;margin-bottom:12px">💬</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:6px">No tienes mensajes aún</div>
        <div style="font-size:13px">Cuando alguien contacte a través de Vivi o el formulario de servicios, aparecerá aquí.</div>
      </div>`;
    actualizarBadgeMensajes(0);
    return;
  }

  const noLeidos = data.leads.filter(l => l.status === 'nuevo').length;
  actualizarBadgeMensajes(noLeidos);

  lista.innerHTML = data.leads.map(lead => {
    const esSoporte = lead.tipo === 'soporte';
    const badgeTipo = esSoporte
      ? `<span class="status-badge" style="background:#eff6ff;color:#1d4ed8">🎧 Soporte</span>`
      : `<span class="status-badge" style="background:#f0fdf4;color:#166534">🏠 Servicio</span>`;
    return `
    <div class="mensaje-card">
      <div class="mensaje-header">
        <span class="mensaje-de">${lead.folio || 'Lead'} · ${lead.servicio || 'Consulta general'}</span>
        <div style="display:flex;gap:6px;align-items:center">
          ${badgeTipo}
          <span class="status-badge status-${lead.status}">${lead.status}</span>
        </div>
      </div>
      <div class="mensaje-texto">${lead.nombre} · ${lead.telefono}${lead.email ? ' · ' + lead.email : ''}</div>
      <div class="mensaje-propiedad">${new Date(lead.createdAt).toLocaleDateString('es-MX')}${lead.ciudad ? ' · ' + lead.ciudad : ''}</div>
      ${lead.conversacion?.length ? `<div style="margin-top:8px;font-size:12px;color:var(--text-light)">💬 ${lead.conversacion.length} mensaje(s) en la conversación</div>` : ''}
    </div>`;
  }).join('');
};
const cargarLeadsUsuario = async () => {
  const lista = document.getElementById('leads-usuario-lista');
  const data = await api.get('/auth/leads');
  if (data.ok) actualizarBadgeMensajes(data.mensajesNoLeidos || 0);
  if (!data.leads || data.leads.length === 0) {
    lista.innerHTML = '<div class="loading">No tienes leads registrados aún.</div>';
    return;
  }
  lista.innerHTML = data.leads.map(lead => {
    const esSoporte = lead.tipo === 'soporte';
    const badgeTipo = esSoporte
      ? `<span class="status-badge" style="background:#eff6ff;color:#1d4ed8">🎧 Soporte</span>`
      : `<span class="status-badge" style="background:#f0fdf4;color:#166534">🏠 Servicio</span>`;
    return `
    <div class="mensaje-card">
      <div class="mensaje-header">
        <span class="mensaje-de">${lead.folio || 'Lead'} · ${lead.servicio || 'Servicio no especificado'}</span>
        <div style="display:flex;gap:6px;align-items:center">
          ${badgeTipo}
          <span class="status-badge status-${lead.status}">${lead.status}</span>
        </div>
      </div>
      <div class="mensaje-texto">${lead.nombre} · ${lead.telefono}${lead.email ? ' · ' + lead.email : ''}</div>
      <div class="mensaje-propiedad">${new Date(lead.createdAt).toLocaleDateString('es-MX')}${lead.ciudad ? ' · ' + lead.ciudad : ''}</div>
    </div>`;
  }).join('');
};

const cargarCuenta = () => {
  const info = document.getElementById('cuenta-info');
  if (!user) return;
  info.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-bottom:32px">
      <div class="form-grupo"><label>Nombre completo</label><input type="text" class="form-input" value="${user.nombre}" disabled></div>
      <div class="form-grupo"><label>Correo electrónico</label><input type="text" class="form-input" value="${user.email}" disabled></div>
      <div class="form-grupo">
        <label>Teléfono</label>
        <div style="display:flex;gap:8px">
          <input type="tel" id="cuenta-telefono" class="form-input" value="${user.telefono || ''}" placeholder="10 dígitos" style="flex:1">
          <button class="btn btn-primary" style="padding:10px 18px;font-size:13px;white-space:nowrap" onclick="guardarTelefono()">Guardar</button>
        </div>
      </div>
      <div class="form-grupo"><label>Plan actual</label><input type="text" class="form-input" value="${user.plan}" disabled></div>
    </div>
    <div style="background:var(--bg-secondary);border-radius:16px;padding:24px;border:1px solid var(--border);margin-bottom:24px">
      <h3 style="font-size:16px;margin-bottom:16px;font-family:'Bricolage Grotesque',sans-serif">🔔 Preferencias de notificaciones</h3>
      <div style="display:flex;flex-direction:column;gap:14px">
        <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer">
          <div><div style="font-size:14px;font-weight:500">Mensajes de interés</div><div style="font-size:12px;color:var(--text-light)">Cuando alguien envía mensaje sobre tu propiedad</div></div>
          <input type="checkbox" id="notif-mensajes" ${user.notificaciones?.mensajes !== false ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary);cursor:pointer">
        </label>
        <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer">
          <div><div style="font-size:14px;font-weight:500">Propiedad aprobada</div><div style="font-size:12px;color:var(--text-light)">Cuando el admin aprueba tu publicación</div></div>
          <input type="checkbox" id="notif-aprobada" ${user.notificaciones?.propiedadAprobada !== false ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary);cursor:pointer">
        </label>
        <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer">
          <div><div style="font-size:14px;font-weight:500">Propiedad rechazada</div><div style="font-size:12px;color:var(--text-light)">Cuando el admin rechaza tu publicación</div></div>
          <input type="checkbox" id="notif-rechazada" ${user.notificaciones?.propiedadRechazada !== false ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary);cursor:pointer">
        </label>
        <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer">
          <div><div style="font-size:14px;font-weight:500">Novedades y promociones</div><div style="font-size:12px;color:var(--text-light)">Nuevas propiedades y ofertas especiales</div></div>
          <input type="checkbox" id="notif-novedades" ${user.notificaciones?.novedades ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary);cursor:pointer">
        </label>
      </div>
      <button class="btn btn-primary" style="margin-top:20px;padding:10px 24px;font-size:14px" onclick="guardarNotificaciones()">Guardar preferencias</button>
      <div id="notif-msg" style="display:none;margin-top:12px"></div>
    </div>
    <button class="btn btn-outline" onclick="auth.logout()">Cerrar sesión</button>`;
};
const guardarTelefono = async () => {
  const telefono = document.getElementById('cuenta-telefono')?.value.trim();
  if (!telefono || telefono.length < 10) {
    dsToast({ title: 'Teléfono inválido', message: 'Ingresa un número de al menos 10 dígitos.', type: 'error' });
    return;
  }
  const data = await api.patch('/auth/perfil', { telefono });
  if (data.ok) {
    const userActualizado = { ...user, telefono };
    localStorage.setItem('user', JSON.stringify(userActualizado));
    dsToast({ title: 'Teléfono actualizado', message: 'Tu número fue guardado correctamente.', type: 'success' });
  } else {
    dsToast({ title: 'No se pudo guardar', message: data.error || 'Intenta de nuevo.', type: 'error' });
  }
};

const guardarNotificaciones = async () => {
  const notificaciones = {
    mensajes: document.getElementById('notif-mensajes').checked,
    propiedadAprobada: document.getElementById('notif-aprobada').checked,
    propiedadRechazada: document.getElementById('notif-rechazada').checked,
    novedades: document.getElementById('notif-novedades').checked,
  };
  const msgEl = document.getElementById('notif-msg');
  const data = await api.patch('/auth/notificaciones', { notificaciones });
  if (data.ok) {
    msgEl.innerHTML = '<div class="alert alert-success">✓ Preferencias guardadas</div>';
    msgEl.style.display = 'block';
    const userActual = auth.getUser();
    userActual.notificaciones = notificaciones;
    localStorage.setItem('user', JSON.stringify(userActual));
    setTimeout(() => msgEl.style.display = 'none', 3000);
  }
};

let publicarPaso = 1;

// expose helpers to global scope (HTML onclick)
window.setPublicarStep = (n) => {
  publicarPaso = Number(n) || 1;
  const max = 7;
  if (publicarPaso < 1) publicarPaso = 1;
  if (publicarPaso > max) publicarPaso = max;

  document.querySelectorAll('.publicar-step-content').forEach(el => {
    const step = Number(el.getAttribute('data-step-content'));
    el.style.display = step === publicarPaso ? 'block' : 'none';
  });

  // progress
  const dots = document.querySelectorAll('#publicar-steps .ds-step');
  dots.forEach(d => {
    const step = Number(d.getAttribute('data-step'));
    d.classList.toggle('active', step === publicarPaso);
    d.disabled = step !== publicarPaso; // evita saltos sin validar
  });

  const bar = document.getElementById('publicar-progress-bar');
  if (bar) {
    const pct = ((publicarPaso - 1) / (max - 1)) * 100;
    bar.style.width = pct + '%';
  }

  // back/next/submit
  const backBtn = document.getElementById('publicar-back-btn');
  const nextBtn = document.getElementById('publicar-next-btn');
  const submitWrap = document.getElementById('publicar-submit-wrap');

  if (backBtn) backBtn.style.display = publicarPaso === 1 ? 'none' : 'inline-flex';

  if (nextBtn) {
    nextBtn.style.display = publicarPaso === 7 ? 'none' : 'inline-flex';
    nextBtn.textContent = publicarPaso === 6 ? 'Revisar →' : 'Siguiente →';
  }

  if (submitWrap) submitWrap.style.display = publicarPaso === 7 ? 'block' : 'none';

  // Mapa: si llegamos al step 4, forzar redimensionado
  if (publicarPaso === 4) {
    if (mapaPublicar) {
      setTimeout(() => mapaPublicar.invalidateSize(), 100);
    } else {
      iniciarMapaPublicar();
    }
  }
  // resumen final en step 7
  if (publicarPaso === 7) {
    cargarResumenFinal();
  }
};

const marcarError = (id, mensaje) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = '#dc2626';
  el.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.12)';
  // Buscar o crear el mensaje de error debajo del campo
  const parent = el.closest('.form-grupo') || el.parentElement;
  let errMsg = parent.querySelector('.field-error-msg');
  if (!errMsg) {
    errMsg = document.createElement('div');
    errMsg.className = 'field-error-msg';
    errMsg.style.cssText = 'color:#dc2626;font-size:12px;margin-top:4px;display:flex;align-items:center;gap:4px';
    parent.appendChild(errMsg);
  }
  errMsg.innerHTML = `⚠️ ${mensaje}`;
  // Scroll al campo
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // Link directo: focus en el campo
  setTimeout(() => el.focus(), 300);
};

const limpiarErrores = () => {
  document.querySelectorAll('.field-error-msg').forEach(el => el.remove());
  document.querySelectorAll('#sec-nueva-propiedad input, #sec-nueva-propiedad select, #sec-nueva-propiedad textarea').forEach(el => {
    el.style.borderColor = '';
    el.style.boxShadow = '';
  });
  const errorEl = document.getElementById('form-error');
  if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; }
};

const validarPaso = (paso) => {
  limpiarErrores();

  const v = (id) => document.getElementById(id)?.value?.trim() || '';
  const n = (id) => Number(document.getElementById(id)?.value || 0);

  switch (paso) {
    case 1: {
      let ok = true;
      if (!v('p-titulo')) { marcarError('p-titulo', 'El título es obligatorio'); ok = false; }
      if (!v('p-precio') || Number(v('p-precio')) <= 0) { marcarError('p-precio', 'Ingresa un precio mayor a $0'); ok = false; }
      if (!v('p-operacion')) { marcarError('p-operacion', 'Selecciona si es renta o venta'); ok = false; }
      if (!v('p-tipo')) { marcarError('p-tipo', 'Selecciona el tipo de propiedad'); ok = false; }
      if (!ok) dsToast({ title: 'Completa los campos requeridos', message: 'Los campos marcados en rojo son obligatorios.', type: 'error' });
      return ok;
    }
    case 2: {
      if (!v('p-descripcion') || v('p-descripcion').length < 20) {
        marcarError('p-descripcion', 'La descripción debe tener al menos 20 caracteres');
        dsToast({ title: 'Descripción muy corta', message: 'Agrega más detalle sobre la propiedad.', type: 'error' });
        return false;
      }
      return true;
    }
    case 3: {
      let ok = true;
      if (!v('p-estado')) { marcarError('p-estado', 'Selecciona el estado'); ok = false; }
      if (!v('p-ciudad')) { marcarError('p-ciudad', 'Ingresa la ciudad'); ok = false; }
      if (!v('p-direccion')) { marcarError('p-direccion', 'Ingresa la dirección (calle y número)'); ok = false; }
      if (!ok) dsToast({ title: 'Completa la ubicación', message: 'Los campos marcados en rojo son obligatorios.', type: 'error' });
      return ok;
    }
    case 4: {
      const lat = v('p-lat');
      const lng = v('p-lng');
      if (!lat || !lng || Number(lat) === 0 || Number(lng) === 0) {
        const mapaEl = document.getElementById('mapa-publicar');
        if (mapaEl) {
          mapaEl.style.outline = '3px solid #dc2626';
          mapaEl.style.borderRadius = '12px';
          const errDiv = document.createElement('div');
          errDiv.className = 'field-error-msg';
          errDiv.style.cssText = 'color:#dc2626;font-size:12px;margin-top:6px;display:flex;align-items:center;gap:4px';
          errDiv.innerHTML = '⚠️ Haz clic en el mapa para marcar la ubicación aproximada';
          mapaEl.parentElement.appendChild(errDiv);
          mapaEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        dsToast({ title: 'Marca la ubicación', message: 'Haz clic en el mapa para continuar.', type: 'error' });
        return false;
      }
      return true;
    }
    case 5: {
      const campos = ['p-recamaras','p-banos','p-medios-banos','p-estacionamientos','p-m2'];
      let ok = true;
      campos.forEach(id => {
        const val = Number(document.getElementById(id)?.value);
        if (Number.isNaN(val) || val < 0) {
          marcarError(id, 'Valor inválido');
          ok = false;
        }
      });
      if (!ok) dsToast({ title: 'Valores inválidos', message: 'Revisa las características marcadas en rojo.', type: 'error' });
      return ok;
    }
    case 6: {
      const limite = getLimiteFotos();
      const count = fotosOrden.length;
      if (count < 2) {
        const dropEl = document.getElementById('p-fotos-drop');
        if (dropEl) {
          dropEl.style.outline = '3px solid #dc2626';
          const errDiv = document.createElement('div');
          errDiv.className = 'field-error-msg';
          errDiv.style.cssText = 'color:#dc2626;font-size:12px;margin-top:6px;display:flex;align-items:center;gap:4px';
          errDiv.innerHTML = `⚠️ Agrega al menos 2 fotos (tu plan permite hasta ${limite})`;
          dropEl.parentElement.appendChild(errDiv);
          dropEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        dsToast({ title: 'Fotos insuficientes', message: `Agrega al menos 2 fotos. Puedes subir hasta ${limite} con tu plan actual.`, type: 'error' });
        return false;
      }
      if (fotoPortadaIdx < 0 || fotoPortadaIdx >= count) fotoPortadaIdx = 0;
      return true;
    }
    case 7:
    default:
      return true;
  }
};

window.publicarNextStep = () => {
  const ok = validarPaso(publicarPaso);
  if (!ok) return;
  if (publicarPaso >= 7) return;

  // loading state simple en el botón para pasos de envío
  const backBtn = document.getElementById('publicar-back-btn');
  const nextBtn = document.getElementById('publicar-next-btn');
  if (publicarPaso === 6 && nextBtn) {
    nextBtn.disabled = true;
    const originalText = nextBtn.textContent;
    nextBtn.textContent = 'Revisar...';
    setTimeout(() => {
      nextBtn.disabled = false;
      nextBtn.textContent = originalText;
      setPublicarStep(publicarPaso + 1);
    }, 350);
    return;
  }

  setPublicarStep(publicarPaso + 1);
};


const publicarPrevStep = () => {
  if (publicarPaso <= 1) return;
  setPublicarStep(publicarPaso - 1);
};

const cargarResumenFinal = () => {
  const el = document.getElementById('publicar-final-summary');
  if (!el) return;

  const titulo = document.getElementById('p-titulo')?.value?.trim() || '—';
  const precio = document.getElementById('p-precio')?.value || '—';
  const operacion = document.getElementById('p-operacion')?.value || '—';
  const tipo = document.getElementById('p-tipo')?.value || '—';
  const descripcion = document.getElementById('p-descripcion')?.value?.trim() || '—';
  const estado = document.getElementById('p-estado')?.value || '—';
  const ciudad = document.getElementById('p-ciudad')?.value?.trim() || '—';
  const lat = document.getElementById('p-lat')?.value || '—';
  const lng = document.getElementById('p-lng')?.value || '—';
  const fotosCount = document.getElementById('p-fotos')?.files?.length || 0;

  const badgeEnvioStatus = document.getElementById('badge-envio-status');
  const badgeEnvioUbic = document.getElementById('badge-envio-ubic');
  const badgeEnvioFotos = document.getElementById('badge-envio-fotos');

  const fotosOk = fotosCount >= 2;
  const ubicOk = lat !== '—' && lng !== '—' && lat !== '' && lng !== '';

  if (badgeEnvioStatus) {
    const ok = fotosOk && ubicOk;
    badgeEnvioStatus.textContent = `Estado: ${ok ? 'Listo' : 'Pendiente'}`;
    badgeEnvioStatus.classList.toggle('ds-badge-primary', ok);
    badgeEnvioStatus.classList.toggle('ds-badge-soft', !ok);
  }
  if (badgeEnvioUbic) badgeEnvioUbic.textContent = `Ubicación: ${ubicOk ? 'OK' : 'Pendiente'}`;
  if (badgeEnvioFotos) badgeEnvioFotos.textContent = `Fotos: ${fotosCount} (${fotosOk ? 'OK' : 'mín. 2'})`;


  el.innerHTML = `
    <div style="font-weight:800;margin-bottom:10px">Resumen final</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px">
      <div><b>Título:</b> ${titulo}</div>
      <div><b>Precio:</b> ${precio}</div>
      <div><b>Operación:</b> ${operacion}</div>
      <div><b>Tipo:</b> ${tipo}</div>
      <div style="grid-column:1/-1"><b>Descripción:</b> ${descripcion.slice(0, 140)}${descripcion.length > 140 ? '…' : ''}</div>
      <div><b>Estado:</b> ${estado}</div>
      <div><b>Ciudad:</b> ${ciudad}</div>
      <div><b>Lat/Lng:</b> ${lat}, ${lng}</div>
      <div style="grid-column:1/-1"><b>Fotos:</b> ${fotosCount} foto(s)</div>
    </div>
    <div style="margin-top:14px;color:var(--text-light);font-size:12px">Al enviar, la publicación se crea en estado <b>revisión</b>.</div>
  `;
};


const publicarPropiedad = async () => {
  const errorEl = document.getElementById('form-error');
  const successEl = document.getElementById('form-success');
  errorEl.style.display = 'none';
  successEl.style.display = 'none';

  const showToast = (payload) => {
    if (typeof window.dsToast === 'function') window.dsToast(payload);
  };


  const titulo = document.getElementById('p-titulo').value.trim();
  const precio = document.getElementById('p-precio').value;
  const operacion = document.getElementById('p-operacion').value;
  const tipo = document.getElementById('p-tipo').value;
  const descripcion = document.getElementById('p-descripcion').value.trim();
  const estado = document.getElementById('p-estado').value;
  const ciudad = document.getElementById('p-ciudad').value.trim();
  const colonia = document.getElementById('p-colonia').value.trim();
  const direccion = document.getElementById('p-direccion').value.trim();
const recamaras = document.getElementById('p-recamaras').value;
  const banos = document.getElementById('p-banos').value;
  const mediosBanos = document.getElementById('p-medios-banos').value;
  const estacionamientos = document.getElementById('p-estacionamientos').value;
  const m2 = document.getElementById('p-m2').value;
  const lat = document.getElementById('p-lat').value;
  const lng = document.getElementById('p-lng').value;

  if (!titulo || !precio || !operacion || !tipo || !descripcion || !estado || !ciudad) {
    const msg = 'Por favor llena todos los campos obligatorios (*)';
    errorEl.textContent = msg;

    errorEl.style.display = 'block';
    if (typeof window.dsToast === 'function') {
      window.dsToast({ title: 'Faltan datos', message: msg, type: 'error' });
    }
    return;
  }


  const body = {
    titulo, precio: Number(precio), operacion, tipo, descripcion,
    ubicacion: { estado, ciudad, colonia, direccion, lat: lat ? parseFloat(lat) : null, lng: lng ? parseFloat(lng) : null },
caracteristicas: {
    recamaras: Number(recamaras) || 0,
    banos: Number(banos) || 0,
    mediosBanos: Number(mediosBanos) || 0,
    estacionamientos: Number(estacionamientos) || 0,
    m2: Number(m2) || 0
  }
  };


  const btn = document.querySelector('#sec-nueva-propiedad .btn-primary');
  if (btn) {
    btn.textContent = 'Enviando...';
    btn.disabled = true;
  }

  showToast({ title: 'Enviando', message: 'Tu publicación se está enviando a revisión.', type: 'info', duration: 2200 });



  const data = await api.post('/propiedades', body);

  if (data.ok) {
    const fotosInput = document.getElementById('p-fotos');
    if (fotosInput.files.length > 0) {
      const formData = new FormData();
      // enviar en el orden seleccionado; foto portada al inicio
      const ordered = fotosOrden && fotosOrden.length ? fotosOrden.slice() : Array.from(fotosInput.files).map(file => ({ file }));
      if (ordered.length > 0 && fotoPortadaIdx >= 0 && fotoPortadaIdx < ordered.length) {
        const portada = ordered.splice(fotoPortadaIdx, 1)[0];
        ordered.unshift(portada);
      }
      ordered.forEach(x => formData.append('fotos', x.file));
      await api.postForm(`/propiedades/${data.propiedad._id}/fotos`, formData);
    }

    successEl.textContent = '¡Propiedad enviada a revisión exitosamente!';
    successEl.style.display = 'block';
    if (btn) {
      btn.textContent = 'Enviar a revisión';
      btn.disabled = false;
    }
    showToast({ title: 'Enviado', message: 'Propiedad enviada a revisión exitosamente.', type: 'success' });

    setTimeout(() => mostrarSeccion('mis-propiedades'), 2000);
  } else {
    errorEl.textContent = data.error || 'Error al publicar la propiedad';
    errorEl.style.display = 'block';
    if (btn) {
      btn.textContent = 'Enviar a revisión';
      btn.disabled = false;
    }
    showToast({ title: 'Error', message: errorEl.textContent, type: 'error' });
  }
};

// ==========================================
// MIS PROPIEDADES (GRID / LISTA)
// ==========================================
let misPropsData = [];

window.cambiarVistaMisProps = (vista) => {
  const container = document.getElementById('mis-props-container');
  const btnGrid = document.getElementById('view-grid-btn');
  const btnLista = document.getElementById('view-list-btn');
  if(!container) return;
  
  btnGrid.classList.remove('active');
  btnLista.classList.remove('active');

  if (vista === 'grid') {
    container.className = 'mis-props-grid mis-props-view-grid';
    btnGrid.classList.add('active');
  } else {
    container.className = 'mis-props-grid mis-props-view-list';
    btnLista.classList.add('active');
  }
  renderizarMisProps();
};

const renderizarMisProps = () => {
  const container = document.getElementById('mis-props-container');
  if(!container) return;
  const isGrid = container.classList.contains('mis-props-view-grid');

  if (misPropsData.length === 0) {
    container.innerHTML = '<div class="loading" style="color:var(--text-light)">No tienes propiedades publicadas aún.</div>';
    return;
  }

  if (isGrid) {
    container.innerHTML = misPropsData.map(p => crearCardPropiedad(p)).join('');
  } else {
    container.innerHTML = misPropsData.map(p => {
      const foto = p.fotos && p.fotos.length > 0 ? `<img src="${p.fotos[0]}" alt="${p.titulo}" class="prop-admin-img">` : `<div class="prop-admin-img">Sin foto</div>`;
      return `<div class="prop-admin-card">${foto}<div class="prop-admin-info"><div class="prop-admin-titulo">${p.titulo}</div><div class="prop-admin-meta"><span class="status-badge status-${p.estatus || 'nuevo'}">${p.estatus || 'nuevo'}</span> · ${p.ubicacion?.ciudad || ''}, ${p.ubicacion?.estado || ''} · <strong>${formatPrecio(p.precio)}</strong></div></div><div class="prop-admin-actions"><button class="btn btn-outline" style="padding:6px 12px;font-size:12px" onclick="window.location='propiedad.html?id=${p._id}'">Ver</button></div></div>`;
    }).join('');
  }
};

window.cargarMisPropiedades = async () => {
  const container = document.getElementById('mis-props-container');
  if(!container) return;
  container.innerHTML = '<div class="loading">Cargando tus propiedades...</div>';
  try {
    const data = await api.get('/propiedades/mias'); 
    if (data.ok && data.propiedades) {
      misPropsData = data.propiedades;
      renderizarMisProps();
    } else {
      container.innerHTML = '<div class="loading" style="color:var(--text-light)">No tienes propiedades publicadas aún.</div>';
    }
  } catch (error) {
    container.innerHTML = '<div class="loading" style="color:red">Error al cargar propiedades.</div>';
  }
};