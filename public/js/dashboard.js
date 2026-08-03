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
// Normaliza texto ignorando acentos y mayúsculas para comparar estados
const normalizarTexto = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

// Devuelve el option que coincida con el texto (ignora el option placeholder vacío)
const seleccionarEstadoPorTexto = (select, texto) => {
  if (!select || !texto) return;
  const norm = normalizarTexto(texto);
  const opciones = Array.from(select.options).filter(o => o.value && o.value.trim() !== '');
  // Coincidencia exacta o parcial (primeras palabras)
  const match = opciones.find(o =>
    normalizarTexto(o.text) === norm ||
    normalizarTexto(o.value) === norm ||
    normalizarTexto(o.text).includes(norm) ||
    norm.includes(normalizarTexto(o.text))
  );
  if (match) select.value = match.value;
};

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
    // Intentar seleccionar el estado en el select (solo si aún no está seleccionado)
    if (estado && !estado.value) {
      seleccionarEstadoPorTexto(estado, lugar['state'] || lugar['state abbreviation']);
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
        
        <!-- PLAN GRATUITO -->
        <div style="border:2px solid ${planActual === 'gratuito' ? 'var(--primary)' : '#e5e7eb'};border-radius:14px;padding:18px;background:${planActual === 'gratuito' ? '#f0fdf4' : 'white'}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div><div style="font-size:15px;font-weight:700;color:#0f172a">Gratuito</div><div style="font-size:12px;color:#64748b">Para empezar</div></div><div style="font-size:20px;font-weight:800;color:#0f172a">$0<span style="font-size:12px;font-weight:400;color:#64748b">/siempre</span></div></div>
          <ul style="font-size:12px;color:#475569;list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px"><li>✓ Hasta 3 propiedades publicadas</li><li>✓ 5 fotos por propiedad</li><li>✓ Acceso al catálogo</li></ul>
          ${planActual === 'gratuito' ? '<div style="margin-top:12px;font-size:12px;font-weight:600;color:var(--primary)">✓ Plan actual</div>' : ''}
        </div>

        <!-- PLAN BÁSICO -->
        <div style="border:2px solid ${planActual === 'basico' ? 'var(--primary)' : '#0369a1'};border-radius:14px;padding:18px;background:${planActual === 'basico' ? '#f0fdf4' : '#f0f9ff'};position:relative">
          <div style="position:absolute;top:-10px;right:16px;background:#0369a1;color:white;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px">DISPONIBLE</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div><div style="font-size:15px;font-weight:700;color:#0f172a">Básico</div><div style="font-size:12px;color:#64748b">Para agentes activos</div></div><div style="font-size:20px;font-weight:800;color:#0369a1">$99<span style="font-size:12px;font-weight:400;color:#64748b">/mes</span></div></div>
          <ul style="font-size:12px;color:#475569;list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px"><li>✓ Hasta 15 propiedades publicadas</li><li>✓ 10 fotos por propiedad</li><li>✓ Estadísticas de tu panel</li><li>✓ Mayor visibilidad en el catálogo</li><li>✓ Soporte prioritario</li></ul>
          ${planActual === 'basico' ? '<div style="margin-top:12px;font-size:12px;font-weight:600;color:var(--primary)">✓ Plan actual</div>' : `
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
            <button onclick="contratarPlan('basico', 'mensual')" style="width:100%;padding:10px;background:#0369a1;color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">Contratar Mensual →</button>
            <button onclick="contratarPlan('basico', 'anual')" style="width:100%;padding:10px;background:white;color:#0369a1;border:2px solid #0369a1;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">⚡ Anual: $999 (1 mes gratis)</button>
          </div>`}
        </div>

        <!-- PLAN PREMIUM -->
        <div style="border:2px solid #7c3aed;border-radius:14px;padding:18px;background:#faf5ff;position:relative;opacity:0.7">
          <div style="position:absolute;top:-10px;right:16px;background:#7c3aed;color:white;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px">PRÓXIMAMENTE</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div><div style="font-size:15px;font-weight:700;color:#0f172a">Premium</div><div style="font-size:12px;color:#64748b">Para inmobiliarias y equipos</div></div><div style="font-size:20px;font-weight:800;color:#7c3aed">Próx.<span style="font-size:12px;font-weight:400;color:#64748b"></span></div></div>
          <ul style="font-size:12px;color:#475569;list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px"><li>✓ Propiedades ilimitadas</li><li>✓ 15 fotos por propiedad</li><li>✓ Estadísticas avanzadas y comparativas</li><li>✓ Cuenta verificada con insignia</li><li>✓ Soporte dedicado 24/7</li></ul>
          <button onclick="listaEsperaPremium()" style="width:100%;margin-top:14px;padding:10px;background:#e5e7eb;color:#9ca3af;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:not-allowed">Próximamente</button>
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
window.contratarPlan = (plan, periodo = 'mensual') => {
  const STRIPE_LINKS = { 
    basico_mensual: 'https://buy.stripe.com/test_9B6fZhgExb2QejO8EGc3m00', 
    basico_anual: 'https://buy.stripe.com/test_dRmfZh1JDc6U2B6cUWc3m01' // LINK REAL ANUAL
  };
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (plan === 'basico' && user.plan === 'basico') {
    return dsToast({ title: 'Ya tienes este plan', message: 'Actualmente cuentas con el Plan Básico.', type: 'info' });
  }

  const linkStripe = STRIPE_LINKS[`${plan}_${periodo}`];
  if (linkStripe) {
    window.location.href = `${linkStripe}?client_reference_id=${user._id || user.id}`;
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

    // Actualizar localStorage con datos frescos (TODOS los campos nuevos)
    const userActual = auth.getUser() || {};
    const userActualizado = { 
      ...userActual, 
      plan: data.plan, 
      planFechaFin: data.planFechaFin,
      planFechaInicio: data.planFechaInicio || null,
      planPeriodo: data.planPeriodo || 'mensual',
      planCancelado: data.planCancelado || false,
      cargoRecurrenteAutorizado: data.cargoRecurrenteAutorizado || false
    };
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
  if (seccion === 'resumen') cargarResumenUsuario();
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
  const wrapper = document.getElementById('resumen-ejecutivo-wrapper');

  // ESCUDO DE SEGURIDAD: Esperar a que el usuario exista
  if (!gridEl || !titleEl || !descEl || !user) return;

  const planUser = (user.plan || 'gratuito').toLowerCase();
  const isBasicoPlus = user.role === 'basico_plus';
  const esPremium = planUser === 'premium' || isBasicoPlus;

  // 1. GRATUITO: Difuminar, limpiar esqueletos y salir
  if (planUser === 'gratuito' && !isBasicoPlus) {
    if (wrapper) wrapper.classList.add('is-locked');
    titleEl.textContent = 'Métricas de rendimiento';
    descEl.textContent = 'Desbloquea estadísticas detalladas y métricas avanzadas con un plan de pago.';
    gridEl.innerHTML = '';
    return; 
  } else {
    if (wrapper) wrapper.classList.remove('is-locked');
  }

  try {
    const [misPropsRes, leadsRes] = await Promise.all([
      api.get('/propiedades/mis-propiedades'),
      api.get('/auth/leads')
    ]);

    const propiedades = misPropsRes?.propiedades || [];
    const leads = leadsRes?.leads || [];
    const mensajesNoLeidos = leadsRes?.mensajesNoLeidos || 0;

    const aprobadas = propiedades.filter(p => p.status === 'aprobada').length;
    const enRevision = propiedades.filter(p => p.status === 'revision').length;
    const rechazadas = propiedades.filter(p => p.status === 'rechazada').length;

    if (planPill) {
      planPill.style.display = 'inline-flex';
      planPill.textContent = isBasicoPlus ? 'Básico Plus' : `Plan: ${user.plan}`;
    }

    const kpisBase = [
      { key: 'activas', label: 'Publicaciones activas', numero: aprobadas, icon: 'home', emoji: '🏠' },
      { key: 'leads', label: 'Leads recibidos', numero: leads.length, icon: 'message-square', emoji: '💬' },
      { key: 'tasa', label: 'Tasa de conversión', numero: '0.0%', icon: 'bar-chart-2', emoji: '📊' },
      { key: 'revision', label: 'En revisión', numero: enRevision, icon: 'clock', emoji: '⏳' }
    ];

    const kpisExtra = [
      { key: 'rechazadas', label: 'Rechazadas', numero: rechazadas, icon: 'x-circle', emoji: '❌' },
      { key: 'visualizaciones', label: 'Visualizaciones', numero: 0, icon: 'eye', emoji: '👁️' },
      { key: 'favoritos', label: 'Favoritos', numero: 0, icon: 'heart', emoji: '❤️' },
      { key: 'compartidas', label: 'Compartidas', numero: 0, icon: 'share-2', emoji: '🔄' }
    ];

    const todosKpis = [...kpisBase, ...kpisExtra];

    gridEl.innerHTML = todosKpis.map((s, index) => {
      const esBase = index < 4;
      const esClicable = esBase || esPremium;
      const estaBloqueado = !esClicable;
      
      return `
        <div class="stat-card ds-anim-in" style="${estaBloqueado ? 'position:relative;overflow:hidden;cursor:default;opacity:0.8;' : 'cursor:pointer;'}" onclick="${esClicable ? `mostrarDetalleKpi('${s.key}', '${s.label}')` : `bloquearKpiBasico()`}" title="${estaBloqueado ? 'Disponible en Premium' : 'Ver detalle'}">
          ${estaBloqueado ? '<div style="position:absolute;inset:0;background:rgba(255,255,255,0.4);z-index:2;pointer-events:none"></div>' : ''}
          <div class="stat-row">
            <div class="stat-left">
              <div class="stat-numero">${s.numero}</div>
              <div class="stat-label">${s.label} ${estaBloqueado ? '🔒' : ''}</div>
            </div>
          </div>
        </div>`;
    }).join('');

    const mensajeText = mensajesNoLeidos > 0 ? `Tienes ${mensajesNoLeidos} mensaje(s) sin leer.` : 'Sin mensajes pendientes.';
    const revisionText = enRevision > 0 ? `Hay ${enRevision} publicación(es) en revisión.` : 'Tus publicaciones están al día.';

    titleEl.textContent = aprobadas > 0 ? 'Tu performance en el dashboard' : 'Empieza tu primera publicación';
    descEl.textContent = `${revisionText} ${mensajeText}`.trim();

    if (window.dsLucide?.inject) window.dsLucide.inject();

    const containerResumen = document.getElementById('mis-props-container-resumen');
    if (containerResumen) {
      if (!propiedades.length) {
        containerResumen.innerHTML = `
          <div style="text-align:center;padding:40px;color:var(--text-light)">
            <p style="font-size:15px;margin-bottom:16px">Aún no tienes propiedades publicadas</p>
            <button class="btn btn-primary" onclick="mostrarSeccion('nueva-propiedad')">Publicar mi primera propiedad</button>
          </div>`;
      } else {
        containerResumen.innerHTML = propiedades.map(p => `
          <div class="prop-admin-card">
            <div class="prop-admin-img">
              ${p.fotos && p.fotos.length > 0
                ? `<img src="${p.fotos[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`
                : 'Sin foto'}
            </div>
            <div class="prop-admin-info">
              <div class="prop-admin-titulo">${p.titulo}</div>
              <div class="prop-admin-meta">${p.ubicacion?.ciudad || ''}, ${p.ubicacion?.estado || ''} · ${typeof formatPrecio === 'function' ? formatPrecio(p.precio) : '$' + p.precio}</div>
            </div>
            <div class="prop-admin-actions">
              <span class="status-badge status-${p.status}">${p.status}</span>
              <button class="btn btn-outline" style="padding:6px 14px;font-size:13px" onclick="window.location='propiedad.html?id=${p._id}'">Ver</button>
            </div>
          </div>`).join('');
      }
    }

  } catch (e) {
    titleEl.textContent = 'No se pudo cargar el resumen';
    descEl.textContent = 'Intenta nuevamente más tarde.';
    gridEl.innerHTML = '';
  }
};

// ==========================================
// FUNCIONES DE INTERACCIÓN DE LOS KPIs
// ==========================================

// Si es Básico e intenta ver detalle
const bloquearKpiBasico = () => {
  dsToast({ 
    title: 'Función exclusiva de Premium', 
    message: 'Mejora tu plan para ver el desglose detallado de tus indicadores y métricas avanzadas.', 
    type: 'info',
    duration: 4000 
  });
};

// Si es Premium/Plus, muestra el detalle en un modal
const mostrarDetalleKpi = (key, label) => {
  // Obtener datos guardados en el DOM temporalmente o hacer fetch específico
  dsToast({ title: `Detalle de: ${label}`, message: `Aquí se desplegará la tabla detallada de ${label} (Próximamente se conectará con la BD de métricas).`, type: 'success' });
};


const iniciarMapaPublicar = () => {
  if (mapaPublicar) { mapaPublicar.invalidateSize(); return; }
  setTimeout(() => {
    const centro = [19.4326, -99.1332];
mapaPublicar = L.map('mapa-publicar').setView(centro, 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
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
      // Solo autocompletar el estado si aún no se ha seleccionado uno (evita borrar el que eligió el usuario)
      const estadoSelect = document.getElementById('p-estado');
      if (estado && estadoSelect && !estadoSelect.value) {
        seleccionarEstadoPorTexto(estadoSelect, estado);
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


const escapeHtmlLocal = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ==========================================
// MIS PROPIEDADES — WORKSPACE DE PUBLICACIONES
// ==========================================
let misPropsData = [];
let misPropsFiltradas = [];
const LIMITE_PLAN_MIS_PROPS = { gratuito: 3, basico: 15, basico_plus: Infinity, premium: Infinity };

const hacetiempo = (fecha) => {
  if (!fecha) return '';
  const diffMs = Date.now() - new Date(fecha).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'justo ahora';
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const dias = Math.floor(hrs / 24);
  if (dias < 30) return `hace ${dias} día${dias === 1 ? '' : 's'}`;
  const meses = Math.floor(dias / 30);
  return `hace ${meses} mes${meses === 1 ? '' : 'es'}`;
};

const mpwStatusLabel = { revision: 'En revisión', aprobada: 'Activa', rechazada: 'Rechazada', pausada: 'Pausada', bloqueada: 'Bloqueada' };

const cargarMisPropiedades = async () => {
  const container = document.getElementById('mis-props-container');
  if (!container) return;
  container.innerHTML = `<div class="mpw-skeleton">${'<div class="mpw-skeleton-card"><div class="mpw-skeleton-line" style="height:120px;border-radius:10px"></div><div class="mpw-skeleton-line" style="width:70%"></div><div class="mpw-skeleton-line" style="width:40%"></div></div>'.repeat(3)}</div>`;
  try {
    const data = await api.get('/propiedades/mis-propiedades');
    misPropsData = data.propiedades || [];
    renderMisPropsWorkspace();
  } catch (error) {
    container.innerHTML = `<div class="loading" style="color:red">Error al cargar tus propiedades.</div>`;
  }
};

const renderMisPropsWorkspace = () => {
  const user = (typeof auth !== 'undefined' && auth.getUser) ? (auth.getUser() || {}) : {};
  const isBasicoPlus = user.role === 'basico_plus';
  const plan = isBasicoPlus ? 'basico_plus' : (user.plan || 'gratuito');
  const planLabel = isBasicoPlus ? 'Básico Plus' : plan;
  const limite = LIMITE_PLAN_MIS_PROPS[plan] ?? 3;
  const total = misPropsData.length;
  const activas = misPropsData.filter(p => p.status === 'aprobada').length;
  const revision = misPropsData.filter(p => p.status === 'revision').length;
  const pausadas = misPropsData.filter(p => p.status === 'pausada').length;
  const rechazadas = misPropsData.filter(p => p.status === 'rechazada').length;
  const nuevasSemana = misPropsData.filter(p => p.createdAt && (Date.now() - new Date(p.createdAt).getTime()) < 7 * 86400000).length;
  const sinActividad40d = misPropsData.filter(p => p.status === 'aprobada' && p.updatedAt && (Date.now() - new Date(p.updatedAt).getTime()) > 40 * 86400000);

  const barra = document.getElementById('mpw-plan-bar-fill');
  const barraLabel = document.getElementById('mpw-plan-bar-label');
  if (barra) {
    const pct = limite === Infinity ? 0 : Math.min(100, Math.round((total / limite) * 100));
    barra.style.width = limite === Infinity ? '100%' : `${pct}%`;
    barra.classList.toggle('mpw-bar-warn', limite !== Infinity && pct >= 80);
  }
  if (barraLabel) {
    barraLabel.textContent = limite === Infinity
      ? `Plan ${planLabel} · publicaciones ilimitadas · ${total} publicadas`
      : `Plan ${planLabel} · ${total} de ${limite} publicaciones usadas`;
  }

  const health = document.getElementById('mpw-health');
  if (health) {
    let nivel = 'good', titulo = 'Todo en orden', desc = 'Tus publicaciones están al día.';
    if (total === 0) {
      nivel = 'warn'; titulo = 'Aún no tienes publicaciones'; desc = 'Publica tu primera propiedad para empezar a recibir clientes.';
    } else if (rechazadas > 0 || sinActividad40d.length > 0) {
      nivel = 'warn';
      const partes = [];
      if (rechazadas > 0) partes.push(`${rechazadas} propiedad${rechazadas === 1 ? '' : 'es'} rechazada${rechazadas === 1 ? '' : 's'} pendiente${rechazadas === 1 ? '' : 's'} de corregir`);
      if (sinActividad40d.length > 0) partes.push(`${sinActividad40d.length} activa${sinActividad40d.length === 1 ? '' : 's'} sin cambios hace más de 40 días`);
      titulo = 'Necesita atención';
      desc = partes.join(' · ');
    } else if (activas > 0) {
      titulo = 'Buen ritmo'; desc = `${activas} propiedad${activas === 1 ? '' : 'es'} activa${activas === 1 ? '' : 's'} en el catálogo público.`;
    }
    health.className = `mpw-health mpw-health-${nivel}`;
    health.innerHTML = `<div class="mpw-health-icon">${nivel === 'warn' ? '⚠️' : '✓'}</div><div><div class="mpw-health-title">${titulo}</div><div class="mpw-health-desc">${desc}</div></div>`;
  }

  const totalVistas = misPropsData.reduce((sum, p) => sum + (p.vistas || 0), 0);
  const totalLeads = misPropsData.reduce((sum, p) => sum + (p.leadsCount || 0), 0);
  const conversion = totalVistas > 0 ? ((totalLeads / totalVistas) * 100).toFixed(1) : null;

  const kpis = document.getElementById('mpw-kpis');
  if (kpis) {
    kpis.innerHTML = [
      { label: 'Activas', num: activas, delta: nuevasSemana > 0 ? `+${nuevasSemana} esta semana` : null },
      { label: 'En revisión', num: revision, delta: null },
      { label: 'Pausadas', num: pausadas, delta: null },
      { label: 'Rechazadas', num: rechazadas, delta: null, warn: rechazadas > 0 },
      { label: 'Vistas totales', num: totalVistas, delta: null },
      { label: 'Leads (conversaciones)', num: totalLeads, delta: conversion !== null ? `${conversion}% conversión` : null },
    ].map(k => `<div class="mpw-kpi-card"><div class="mpw-kpi-num">${k.num}</div><div class="mpw-kpi-label">${k.label}</div>${k.delta ? `<div class="mpw-kpi-delta up">${k.delta}</div>` : ''}${k.warn ? '<div class="mpw-kpi-delta down">Revisar motivo</div>' : ''}</div>`).join('');
  }

  const insightsWrap = document.getElementById('mpw-insights');
  if (insightsWrap) {
    const insights = [];
    if (limite !== Infinity && total >= limite) {
      insights.push({ icon: '📈', text: `Alcanzaste el límite de tu plan ${planLabel} (${total}/${limite}). Sube de plan para publicar más propiedades.` });
    } else if (limite !== Infinity && total >= limite * 0.8) {
      insights.push({ icon: '📈', text: `Estás cerca del límite de tu plan: ${total} de ${limite} publicaciones usadas.` });
    }
    if (sinActividad40d.length > 0) {
      insights.push({ icon: '🕐', text: `${sinActividad40d.length} propiedad${sinActividad40d.length === 1 ? '' : 'es'} activa${sinActividad40d.length === 1 ? '' : 's'} sin actualizarse hace más de 40 días. Actualizar fotos o precio puede ayudar a que se vean más recientes.` });
    }
    if (rechazadas > 0) {
      insights.push({ icon: '✏️', text: `Tienes ${rechazadas} propiedad${rechazadas === 1 ? '' : 'es'} rechazada${rechazadas === 1 ? '' : 's'}. Revisa el motivo y corrígela${rechazadas === 1 ? '' : 'n'} para volver a enviarla${rechazadas === 1 ? '' : 's'} a revisión.` });
    }
    const activasConVistas = misPropsData.filter(p => p.status === 'aprobada' && p.vistas > 0);
    if (activasConVistas.length > 1) {
      const promedioVistas = activasConVistas.reduce((s, p) => s + p.vistas, 0) / activasConVistas.length;
      const top = activasConVistas.reduce((a, b) => (b.vistas > a.vistas ? b : a));
      if (top.vistas > promedioVistas * 1.3) {
        const pct = Math.round((top.vistas / promedioVistas - 1) * 100);
        insights.push({ icon: '👁️', text: `"${escapeHtmlLocal(top.titulo)}" recibió ${top.vistas} vistas, ${pct}% más que el promedio de tus otras publicaciones activas.` });
      }
    }
    const activasSinVistas = misPropsData.filter(p => p.status === 'aprobada' && !p.vistas && p.createdAt && (Date.now() - new Date(p.createdAt).getTime()) > 7 * 86400000);
    if (activasSinVistas.length > 0) {
      insights.push({ icon: '📉', text: `${activasSinVistas.length} propiedad${activasSinVistas.length === 1 ? '' : 'es'} activa${activasSinVistas.length === 1 ? '' : 's'} sin vistas después de más de una semana publicada${activasSinVistas.length === 1 ? '' : 's'}. Revisar título, fotos o precio puede ayudar.` });
    }
    insightsWrap.style.display = insights.length ? '' : 'none';
    insightsWrap.innerHTML = insights.map(i => `<div class="mpw-insight-card"><span class="mpw-insight-icon">${i.icon}</span><span>${i.text}</span></div>`).join('');
  }

  const feed = document.getElementById('mpw-feed-list');
  if (feed) {
    const eventos = misPropsData.map(p => ({
      fecha: p.updatedAt || p.createdAt,
      texto: p.status === 'rechazada' ? `"${escapeHtmlLocal(p.titulo)}" fue rechazada` :
             p.status === 'pausada' ? `"${escapeHtmlLocal(p.titulo)}" está pausada` :
             p.status === 'aprobada' ? `"${escapeHtmlLocal(p.titulo)}" está activa` :
             `"${escapeHtmlLocal(p.titulo)}" en revisión`,
    })).filter(e => e.fecha).sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 8);
    feed.innerHTML = eventos.length
      ? eventos.map(e => `<div class="mpw-feed-item"><span class="mpw-feed-dot"></span><div><div class="mpw-feed-text">${e.texto}</div><div class="mpw-feed-time">${hacetiempo(e.fecha)}</div></div></div>`).join('')
      : '<div class="mpw-feed-empty">Sin actividad todavía.</div>';
  }

  poblarFiltrosCiudadMisProps();
  aplicarFiltrosMisProps();
};

const poblarFiltrosCiudadMisProps = () => {
  const sel = document.getElementById('mpw-filtro-ciudad');
  if (!sel) return;
  const actual = sel.value;
  const ciudades = [...new Set(misPropsData.map(p => p.ubicacion?.ciudad).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Todas las ciudades</option>' + ciudades.map(c => `<option value="${c}">${c}</option>`).join('');
  if (ciudades.includes(actual)) sel.value = actual;
};

window.aplicarFiltrosMisProps = () => {
  const q = (document.getElementById('mpw-filtro-buscar')?.value || '').toLowerCase().trim();
  const estado = document.getElementById('mpw-filtro-estado')?.value || '';
  const tipo = document.getElementById('mpw-filtro-tipo')?.value || '';
  const operacion = document.getElementById('mpw-filtro-operacion')?.value || '';
  const ciudad = document.getElementById('mpw-filtro-ciudad')?.value || '';

  misPropsFiltradas = misPropsData.filter(p => {
    if (q && !(p.titulo || '').toLowerCase().includes(q)) return false;
    if (estado && p.status !== estado) return false;
    if (tipo && p.tipo !== tipo) return false;
    if (operacion && p.operacion !== operacion) return false;
    if (ciudad && p.ubicacion?.ciudad !== ciudad) return false;
    return true;
  });

  renderChipsFiltrosMisProps({ q, estado, tipo, operacion, ciudad });
  renderizarMisProps();
};

const renderChipsFiltrosMisProps = (f) => {
  const wrap = document.getElementById('mpw-filtros-activos');
  if (!wrap) return;
  const chips = [];
  if (f.q) chips.push(`Búsqueda: "${f.q}"`);
  if (f.estado) chips.push(mpwStatusLabel[f.estado] || f.estado);
  if (f.tipo) chips.push(f.tipo);
  if (f.operacion) chips.push(f.operacion);
  if (f.ciudad) chips.push(f.ciudad);
  wrap.innerHTML = chips.length
    ? chips.map(c => `<span class="mpw-chip">${c}</span>`).join('') + `<button type="button" class="mpw-chip mpw-chip-clear" onclick="limpiarFiltrosMisProps()">✕ Limpiar todo</button>`
    : '';
};

window.limpiarFiltrosMisProps = () => {
  ['mpw-filtro-buscar', 'mpw-filtro-estado', 'mpw-filtro-tipo', 'mpw-filtro-operacion', 'mpw-filtro-ciudad'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  window.aplicarFiltrosMisProps();
};

window.cambiarVistaMisProps = (vista) => {
  const container = document.getElementById('mis-props-container');
  const btnGrid = document.getElementById('view-grid-btn');
  const btnLista = document.getElementById('view-list-btn');
  if (!container) return;
  btnGrid?.classList.toggle('active', vista === 'grid');
  btnLista?.classList.toggle('active', vista === 'tabla');
  container.dataset.vista = vista;
  renderizarMisProps();
};

const renderizarMisProps = () => {
  const container = document.getElementById('mis-props-container');
  if (!container) return;
  const vista = container.dataset.vista || 'grid';

  if (misPropsData.length === 0) {
    container.innerHTML = `
      <div class="mpw-empty">
        <div class="mpw-empty-icon">🏡</div>
        <p class="mpw-empty-title">Aún no tienes publicaciones</p>
        <p class="mpw-empty-desc">Publica tu primera propiedad para empezar a recibir clientes.</p>
        <button class="btn btn-primary" onclick="mostrarSeccion('nueva-propiedad')">Publicar mi primera propiedad</button>
      </div>`;
    return;
  }
  if (misPropsFiltradas.length === 0) {
    container.innerHTML = `<div class="mpw-empty"><div class="mpw-empty-icon">🔍</div><p class="mpw-empty-title">Sin resultados</p><p class="mpw-empty-desc">Ningún resultado coincide con estos filtros.</p><button class="btn btn-outline" onclick="limpiarFiltrosMisProps()">Limpiar filtros</button></div>`;
    return;
  }

  container.innerHTML = vista === 'tabla' ? renderTablaMisProps(misPropsFiltradas) : misPropsFiltradas.map(p => cardMisProps(p)).join('');
};

const accionesMisProps = (p) => `
  ${p.status !== 'aprobada' && (p.status !== 'rechazada' || p.permiteEdicion !== false) ? `<button class="btn btn-outline" onclick="editarPropiedad('${p._id}')">Editar</button>` : ''}
  ${p.status === 'aprobada' ? `<button class="btn btn-outline" onclick="pausarMiPropiedad('${p._id}')">⏸️ Pausar</button>` : ''}
  ${p.status === 'pausada' ? `<button class="btn btn-primary" onclick="reactivarMiPropiedad('${p._id}')">▶️ Reactivar</button>` : ''}
  <button class="btn btn-outline btn-del-prop" onclick="eliminarMiPropiedad('${p._id}','${(p.titulo || '').replace(/'/g, "\\'")}')">🗑️</button>`;

const cardMisProps = (p) => `
    <div class="prop-admin-card">
      <div class="prop-admin-img" onclick="abrirDrawerMiPropiedad('${p._id}')" style="cursor:pointer">
        ${p.fotos && p.fotos.length > 0
          ? `<img src="${p.fotos[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`
          : 'Sin foto'}
      </div>
      <div class="prop-admin-info">
        <div class="prop-admin-titulo" title="${p.titulo}" onclick="abrirDrawerMiPropiedad('${p._id}')" style="cursor:pointer">${p.titulo}</div>
        <div class="prop-admin-meta">${p.ubicacion?.ciudad || ''}, ${p.ubicacion?.estado || ''} · ${formatPrecio(p.precio)}</div>
        ${(p.vistas || p.leadsCount) ? `<div class="prop-admin-meta" style="margin-top:4px">👁️ ${p.vistas || 0} vistas · 💬 ${p.leadsCount || 0} leads</div>` : ''}
        ${p.status === 'rechazada' ? `
          <div style="margin-top:8px;padding:10px 12px;background:#fdecea;border:1px solid #f5c2c0;border-radius:10px;font-size:12px;color:#7a2a27">
            <b>Motivo de rechazo:</b> ${p.motivo_rechazo ? escapeHtmlLocal(p.motivo_rechazo) : 'No especificado.'}
            ${p.permiteEdicion === false ? '<div style="margin-top:4px">Esta propiedad no se puede editar. Solo puedes eliminarla.</div>' : ''}
          </div>` : ''}
        ${p.status === 'pausada' ? `
          <div style="margin-top:8px;padding:10px 12px;background:#fff8e1;border:1px solid #f5d98a;border-radius:10px;font-size:12px;color:#7a5c00">
            Pausada por ti. No aparece en el catálogo público. Al reactivarla, pasará de nuevo por revisión del admin antes de publicarse.
          </div>` : ''}
      </div>
      <div class="prop-admin-actions">
        <span class="status-badge status-${p.status}">${mpwStatusLabel[p.status] || p.status}</span>
        <button class="btn btn-outline" onclick="window.location='propiedad.html?id=${p._id}'">Ver</button>
        ${accionesMisProps(p)}
      </div>
    </div>`;

const renderTablaMisProps = (lista) => `
  <table class="mpw-table">
    <thead><tr><th></th><th>Propiedad</th><th>Ciudad</th><th>Precio</th><th>Estado</th><th>Vistas</th><th>Leads</th><th>Actualizada</th><th></th></tr></thead>
    <tbody>
      ${lista.map(p => `
        <tr class="mpw-table-row" onclick="abrirDrawerMiPropiedad('${p._id}')">
          <td class="mpw-table-thumb">${p.fotos && p.fotos.length > 0 ? `<img src="${p.fotos[0]}">` : '<div class="mpw-table-noimg"></div>'}</td>
          <td class="mpw-table-titulo">${escapeHtmlLocal(p.titulo)}</td>
          <td>${escapeHtmlLocal(p.ubicacion?.ciudad || '—')}</td>
          <td>${formatPrecio(p.precio)}</td>
          <td><span class="status-badge status-${p.status}">${mpwStatusLabel[p.status] || p.status}</span></td>
          <td>${p.vistas || 0}</td>
          <td>${p.leadsCount || 0}</td>
          <td class="mpw-table-time">${hacetiempo(p.updatedAt || p.createdAt)}</td>
          <td class="mpw-table-actions" onclick="event.stopPropagation()">
            <button class="btn btn-outline" style="padding:6px 10px;font-size:12px" onclick="window.location='propiedad.html?id=${p._id}'">Ver</button>
            ${accionesMisProps(p)}
          </td>
        </tr>`).join('')}
    </tbody>
  </table>`;

// Drawer de detalle
window.abrirDrawerMiPropiedad = (id) => {
  const p = misPropsData.find(x => x._id === id);
  if (!p) return;
  let drawer = document.getElementById('mpw-drawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'mpw-drawer';
    document.body.appendChild(drawer);
  }
  drawer.innerHTML = `
    <div class="mpw-drawer-overlay" onclick="cerrarDrawerMiPropiedad()"></div>
    <div class="mpw-drawer-panel">
      <div class="mpw-drawer-head">
        ${p.fotos && p.fotos.length > 0 ? `<img src="${p.fotos[0]}" class="mpw-drawer-img">` : ''}
        <button class="mpw-drawer-close" onclick="cerrarDrawerMiPropiedad()">✕</button>
        <div class="mpw-drawer-headtext">
          <div class="mpw-drawer-titulo">${escapeHtmlLocal(p.titulo)}</div>
          <span class="status-badge status-${p.status}">${mpwStatusLabel[p.status] || p.status}</span>
        </div>
      </div>
      <div class="mpw-drawer-tabs">
        <button type="button" class="mpw-drawer-tab active" data-tab="resumen" onclick="mpwDrawerTab('resumen')">Resumen</button>
        <button type="button" class="mpw-drawer-tab" data-tab="actividad" onclick="mpwDrawerTab('actividad')">Actividad</button>
        <button type="button" class="mpw-drawer-tab" data-tab="rendimiento" onclick="mpwDrawerTab('rendimiento')">Rendimiento</button>
        <button type="button" class="mpw-drawer-tab" data-tab="config" onclick="mpwDrawerTab('config')">Configuración</button>
      </div>
      <div class="mpw-drawer-panel-content" data-tab-content="resumen">
        <div class="mpw-drawer-row"><span>Precio</span><b>${formatPrecio(p.precio)}</b></div>
        <div class="mpw-drawer-row"><span>Operación</span><b>${escapeHtmlLocal(p.operacion || '—')}</b></div>
        <div class="mpw-drawer-row"><span>Tipo</span><b>${escapeHtmlLocal(p.tipo || '—')}</b></div>
        <div class="mpw-drawer-row"><span>Ubicación</span><b>${escapeHtmlLocal(p.ubicacion?.ciudad || '')}, ${escapeHtmlLocal(p.ubicacion?.estado || '')}</b></div>
        ${p.caracteristicas ? `<div class="mpw-drawer-row"><span>Recámaras / Baños / m²</span><b>${p.caracteristicas.recamaras || 0} / ${p.caracteristicas.banos || 0} / ${p.caracteristicas.m2 || 0}</b></div>` : ''}
        <div class="mpw-drawer-desc">${escapeHtmlLocal(p.descripcion || '')}</div>
        ${p.status === 'rechazada' && p.motivo_rechazo ? `<div class="mpw-drawer-alert">Motivo de rechazo: ${escapeHtmlLocal(p.motivo_rechazo)}</div>` : ''}
      </div>
      <div class="mpw-drawer-panel-content" data-tab-content="actividad" style="display:none">
        <div class="mpw-drawer-row"><span>Publicada</span><b>${p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-MX') : '—'}</b></div>
        <div class="mpw-drawer-row"><span>Última actualización</span><b>${p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('es-MX') : '—'}</b></div>
        <div class="mpw-drawer-row"><span>Estado actual</span><b>${mpwStatusLabel[p.status] || p.status}</b></div>
      </div>
      <div class="mpw-drawer-panel-content" data-tab-content="rendimiento" style="display:none">
        <div class="mpw-drawer-row"><span>Vistas</span><b>${p.vistas || 0}</b></div>
        <div class="mpw-drawer-row"><span>Leads (conversaciones)</span><b>${p.leadsCount || 0}</b></div>
        <div class="mpw-drawer-row"><span>Conversión</span><b>${p.vistas ? ((p.leadsCount || 0) / p.vistas * 100).toFixed(1) + '%' : '—'}</b></div>
      </div>
      <div class="mpw-drawer-panel-content" data-tab-content="config" style="display:none">
        <div class="mpw-drawer-actions">
          <button class="btn btn-outline" onclick="window.location='propiedad.html?id=${p._id}'">Ver publicación</button>
          ${accionesMisProps(p)}
        </div>
      </div>
    </div>`;
  drawer.classList.add('mpw-drawer-open');
};
window.mpwDrawerTab = (tab) => {
  document.querySelectorAll('.mpw-drawer-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.mpw-drawer-panel-content').forEach(c => c.style.display = c.dataset.tabContent === tab ? '' : 'none');
};
window.cerrarDrawerMiPropiedad = () => {
  document.getElementById('mpw-drawer')?.classList.remove('mpw-drawer-open');
};

const pausarMiPropiedad = async (id) => {
  const ok = await dsConfirm({
    title: '¿Pausar esta propiedad?',
    message: 'Dejará de aparecer en el catálogo público de inmediato. Podrás reactivarla cuando quieras.',
    confirmText: 'Sí, pausar'
  });
  if (!ok) return;
  const data = await api.patch(`/propiedades/${id}/pausar`);
  if (data.ok) {
    dsToast({ title: 'Propiedad pausada', message: data.mensaje, type: 'success' });
    cargarMisPropiedades();
  } else {
    dsToast({ title: 'No se pudo pausar', message: data.error || 'Intenta de nuevo.', type: 'error' });
  }
};

const reactivarMiPropiedad = async (id) => {
  const ok = await dsConfirm({
    title: '¿Reactivar esta propiedad?',
    message: 'Se enviará a revisión del admin antes de volver a publicarse en el catálogo.',
    confirmText: 'Sí, reactivar'
  });
  if (!ok) return;
  const data = await api.patch(`/propiedades/${id}/reactivar`);
  if (data.ok) {
    dsToast({ title: 'Enviada a revisión', message: data.mensaje, type: 'success' });
    cargarMisPropiedades();
  } else {
    dsToast({ title: 'No se pudo reactivar', message: data.error || 'Intenta de nuevo.', type: 'error' });
  }
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

// ==========================================
// MÓDULO DE MENSAJERÍA P2P
// ==========================================
let conversacionActiva = null;
let todasLasConversaciones = [];

const cargarMensajes = async () => {
  const lista = document.getElementById('msg-conversaciones');
  if (!lista) return;
  lista.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-light)">Cargando...</div>';
  try {
    const data = await api.get('/mensajes');
    if (!data.ok) { lista.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-light)">Error al cargar</div>'; return; }
    todasLasConversaciones = data.conversaciones || [];
    renderConversaciones(todasLasConversaciones);
    const user = auth.getUser();
    const esGratuito = (user?.plan || 'gratuito').toLowerCase() === 'gratuito';
    const banner = document.getElementById('msg-restriccion-banner');
    if (banner) banner.style.display = esGratuito ? 'block' : 'none';
  } catch (e) {
    lista.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-light)">Error de conexión</div>';
  }
};

const renderConversaciones = (convs) => {
  const lista = document.getElementById('msg-conversaciones');
  if (!lista) return;
  if (convs.length === 0) {
    lista.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--text-light)"><div style="font-size:36px;margin-bottom:10px;opacity:0.5">💬</div><div style="font-size:14px;font-weight:600;margin-bottom:4px;color:var(--text)">Sin conversaciones</div><div style="font-size:12px">Los mensajes aparecerán cuando contactes a alguien o te contacten</div></div>';
    return;
  }
  lista.innerHTML = convs.map(c => {
    const activa = conversacionActiva === c.conversacionId;
    const inicial = (c.otroUsuario?.nombre || '?')[0].toUpperCase();
    const propFoto = c.propiedad?.fotos?.[0];
    const hora = new Date(c.ultimoMensajeFecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const noLeidos = c.noLeidos > 0 ? `<span style="background:var(--primary);color:white;font-size:11px;font-weight:700;padding:1px 7px;border-radius:10px;min-width:20px;text-align:center">${c.noLeidos}</span>` : '';
    return `
      <div onclick="abrirConversacion('${c.conversacionId}')" style="display:flex;gap:10px;padding:12px;border-radius:10px;cursor:pointer;transition:background 0.15s;align-items:flex-start;${activa ? 'background:rgba(26,71,42,0.12);' : ''}" onmouseover="if(!${activa})this.style.background='rgba(255,255,255,0.04)'" onmouseout="if(!${activa})this.style.background='transparent'">
        <div style="width:40px;height:40px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;flex-shrink:0">${inicial}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
            <span style="font-size:13px;font-weight:${c.noLeidos > 0 ? '700' : '500'};color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.otroUsuario?.nombre || 'Usuario'}</span>
            <span style="font-size:11px;color:var(--text-light);flex-shrink:0;margin-left:8px">${hora}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            ${propFoto ? `<img src="${propFoto}" style="width:28px;height:28px;border-radius:5px;object-fit:cover;flex-shrink:0">` : ''}
            <span style="font-size:12px;color:var(--text-light);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">${c.ultimoMensaje || ''}</span>
            ${noLeidos}
          </div>
        </div>
      </div>`;
  }).join('');
};

const filtrarConversaciones = (texto) => {
  const t = texto.toLowerCase().trim();
  if (!t) { renderConversaciones(todasLasConversaciones); return; }
  renderConversaciones(todasLasConversaciones.filter(c =>
    (c.otroUsuario?.nombre || '').toLowerCase().includes(t) ||
    (c.ultimoMensaje || '').toLowerCase().includes(t)
  ));
};

const abrirConversacion = async (convId) => {
  conversacionActiva = convId;
  renderConversaciones(todasLasConversaciones);
  document.getElementById('msg-vacio').style.display = 'none';
  document.getElementById('msg-chat-header').style.display = 'block';
  document.getElementById('msg-chat-mensajes').style.display = 'flex';
  document.getElementById('msg-chat-input-wrap').style.display = 'block';
  document.getElementById('msg-limite-alcanzado').style.display = 'none';
  const contenedor = document.getElementById('msg-chat-mensajes');
  contenedor.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-light)">Cargando mensajes...</div>';
  try {
    const data = await api.get(`/mensajes/conversacion/${convId}`);
    if (!data.ok) { contenedor.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-light)">Error</div>'; return; }
    const msgs = data.mensajes || [];
    const ultima = msgs[msgs.length - 1];
    const otroUser = msgs.length > 0 ? (ultima.remitente._id.toString() === auth.getUser()._id ? ultima.destinatario : ultima.remitente) : null;
    document.getElementById('msg-chat-nombre').textContent = otroUser?.nombre || 'Usuario';
    const propEl = document.getElementById('msg-chat-propiedad');
    if (ultima?.propiedad) {
      propEl.textContent = '🏠 ' + ultima.propiedad.titulo;
      propEl.style.display = 'block';
      propEl.onclick = () => window.open(ultima.propiedad._id ? (window.location.pathname.includes('/pages/') ? `propiedad.html?id=${ultima.propiedad._id}` : `pages/propiedad.html?id=${ultima.propiedad._id}`) : '#');
    } else { propEl.style.display = 'none'; }
    verificarLimiteRespuestas(msgs);
    renderMensajesChat(msgs);
    setTimeout(() => { contenedor.scrollTop = contenedor.scrollHeight; }, 100);
    actualizarBadgeMensajes(todasLasConversaciones.reduce((s, c) => s + (c.noLeidos || 0), 0));
  } catch (e) {
    contenedor.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-light)">Error de conexión</div>';
  }
};

const renderMensajesChat = (msgs) => {
  const contenedor = document.getElementById('msg-chat-mensajes');
  const userId = auth.getUser()._id;
  if (msgs.length === 0) { contenedor.innerHTML = '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-light);font-size:13px">No hay mensajes aún</div>'; return; }
  let html = '', fechaAnt = '';
  const palabrasRiesgo = ['clabe','banco','santander','bbva','bancomer','deposita','transferir','whatsapp','telegram','spei'];
  msgs.forEach(m => {
    const fechaMsg = new Date(m.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
    if (fechaMsg !== fechaAnt) { html += `<div style="text-align:center;font-size:11px;color:var(--text-light);padding:8px 0">${fechaMsg}</div>`; fechaAnt = fechaMsg; }
    const esMio = m.remitente._id.toString() === userId;
    const hora = new Date(m.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    let texto = m.mensaje.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    if (m.riesgoFlags?.length) palabrasRiesgo.forEach(p => { texto = texto.replace(new RegExp(`(${p})`,'gi'), '<span style="background:rgba(239,68,68,0.15);color:#fca5a5;padding:0 2px;border-radius:3px;font-weight:600">$1</span>'); });
    html += `<div style="display:flex;flex-direction:column;${esMio ? 'align-items:flex-end' : 'align-items:flex-start'}">
      <div style="font-size:11px;color:var(--text-light);margin-bottom:2px;margin-${esMio?'right':'left'}:4px">${esMio?'Tú':m.remitente.nombre} · ${hora}</div>
      <div class="chat-bubble ${esMio?'sent':'received'}">${texto}</div>
      ${m.riesgo&&m.riesgo!=='bajo'?`<div style="font-size:10px;color:#fca5a5;margin-top:2px;margin-${esMio?'right':'left'}:4px">⚠️ ${m.riesgo}</div>`:''}
    </div>`;
  });
  contenedor.innerHTML = html;
};

const enviarMensajeChat = async () => {
  const input = document.getElementById('msg-input');
  const texto = input.value.trim();
  if (!texto || !conversacionActiva) return;
  const btn = document.getElementById('msg-btn-enviar');
  btn.disabled = true; btn.textContent = '...';
  try {
    const conv = todasLasConversaciones.find(c => c.conversacionId === conversacionActiva);
    if (!conv) throw new Error('Conversación no encontrada');
    const data = await api.post('/mensajes', { mensaje: texto, destinatarioId: conv.otroUsuario._id, propiedadId: conv.propiedad?._id || null });
    if (!data.ok) {
      if (data.limiteAlcanzado) {
        document.getElementById('msg-limite-alcanzado').style.display = 'block';
        document.getElementById('msg-chat-input-wrap').style.display = 'none';
      }
      dsToast({ title: 'Error', message: data.error || 'No se pudo enviar', type: 'error' }); return;
    }
    input.value = ''; input.style.height = 'auto';
    await abrirConversacion(conversacionActiva);
    const idx = todasLasConversaciones.findIndex(c => c.conversacionId === conversacionActiva);
    if (idx > 0) { const [m] = todasLasConversaciones.splice(idx, 1); todasLasConversaciones.unshift({ ...m, ultimoMensaje: texto, ultimoMensajeFecha: new Date() }); renderConversaciones(todasLasConversaciones); }
  } catch (e) { dsToast({ title: 'Error', message: 'No se pudo enviar', type: 'error' }); }
  finally { btn.disabled = false; btn.textContent = 'Enviar'; input.focus(); }
};

const verificarLimiteRespuestas = (msgs) => {
  const user = auth.getUser();
  if ((user?.plan || 'gratuito').toLowerCase() !== 'gratuito') { document.getElementById('msg-limite-alcanzado').style.display = 'none'; document.getElementById('msg-chat-input-wrap').style.display = 'block'; return; }
  const misRespuestas = msgs.filter(m => m.remitente._id.toString() === user._id).length;
  if (misRespuestas >= 1) { document.getElementById('msg-limite-alcanzado').style.display = 'block'; document.getElementById('msg-chat-input-wrap').style.display = 'none'; }
  else { document.getElementById('msg-limite-alcanzado').style.display = 'none'; document.getElementById('msg-chat-input-wrap').style.display = 'block'; }
};

const autoResizeTextarea = (el) => { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 100) + 'px'; };


const cargarLeadsUsuario = async () => {
  const lista = document.getElementById('leads-usuario-lista');
  const data = await api.get('/auth/leads');
  if (data.ok) actualizarBadgeMensajes(data.mensajesNoLeidos || 0);
  if (!data.leads || data.leads.length === 0) { lista.innerHTML = '<div class="loading">No tienes leads registrados aún.</div>'; return; }
  lista.innerHTML = data.leads.map(lead => {
    const esSoporte = lead.tipo === 'soporte';
    const badgeTipo = esSoporte ? `<span class="status-badge" style="background:#eff6ff;color:#1d4ed8">🎧 Soporte</span>` : `<span class="status-badge" style="background:#f0fdf4;color:#166534">🏠 Servicio</span>`;
    return `<div class="mensaje-card"><div class="mensaje-header"><span class="mensaje-de">${lead.folio || 'Lead'} · ${lead.servicio || 'Servicio no especificado'}</span><div style="display:flex;gap:6px;align-items:center">${badgeTipo}<span class="status-badge status-${lead.status}">${lead.status}</span></div></div><div class="mensaje-texto">${lead.nombre} · ${lead.telefono}${lead.email ? ' · ' + lead.email : ''}</div><div class="mensaje-propiedad">${new Date(lead.createdAt).toLocaleDateString('es-MX')}${lead.ciudad ? ' · ' + lead.ciudad : ''}</div></div>`;
  }).join('');
};

const renderKycCuenta = (u) => {
  const kyc = u.kyc || { status: 'pendiente' };

  if (kyc.status === 'aprobado') {
    return `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:16px;padding:20px 24px;margin-bottom:24px">
        <h3 style="font-size:15px;color:#166534;margin-bottom:4px">🪪 Identidad verificada ✓</h3>
        <p style="font-size:13px;color:#166534">Tu cuenta cuenta con la insignia de verificado. Esto genera más confianza con otros usuarios.</p>
      </div>`;
  }

  if (kyc.status === 'en_revision') {
    return `
      <div style="background:#fff8e1;border:1px solid #f5d98a;border-radius:16px;padding:20px 24px;margin-bottom:24px">
        <h3 style="font-size:15px;color:#7a5c00;margin-bottom:4px">🪪 Verificación en revisión</h3>
        <p style="font-size:13px;color:#7a5c00">Recibimos tus documentos. Un administrador los revisará pronto.</p>
      </div>`;
  }

  const motivoRechazo = kyc.status === 'rechazado' && kyc.motivoRechazo
    ? `<div style="margin-bottom:14px;padding:10px 12px;background:#fdecea;border:1px solid #f5c2c0;border-radius:10px;font-size:12px;color:#7a2a27"><b>Motivo del rechazo anterior:</b> ${escapeHtmlLocal(kyc.motivoRechazo)}</div>`
    : '';

  return `
    <div style="background:var(--bg-secondary);border-radius:16px;padding:24px;border:1px solid var(--border);margin-bottom:24px">
      <h3 style="font-size:16px;margin-bottom:6px;font-family:'Bricolage Grotesque',sans-serif">🪪 Verificación de identidad (KYC)</h3>
      <p style="font-size:13px;color:var(--text-light);margin-bottom:16px">Verifica tu identidad con tu INE para obtener la insignia de verificado y generar más confianza al publicar o responder mensajes.</p>
      ${motivoRechazo}
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:16px">
        <div class="form-grupo"><label>RFC</label><input type="text" id="kyc-rfc" class="form-input" value="${u.rfc || ''}" placeholder="Tu RFC" maxlength="13"></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:16px">
        <div class="form-grupo"><label>INE (frente)</label><input type="file" id="kyc-ine-frente" accept="image/*" class="form-input"></div>
        <div class="form-grupo"><label>INE (reverso)</label><input type="file" id="kyc-ine-reverso" accept="image/*" class="form-input"></div>
      </div>
      <button class="btn btn-primary" style="padding:10px 24px;font-size:14px" onclick="enviarKyc()">Enviar a verificación</button>
      <div id="kyc-msg" style="display:none;margin-top:12px"></div>
    </div>`;
};

const enviarKyc = async () => {
  const rfc = document.getElementById('kyc-rfc').value.trim();
  const frente = document.getElementById('kyc-ine-frente').files[0];
  const reverso = document.getElementById('kyc-ine-reverso').files[0];
  const msgEl = document.getElementById('kyc-msg');

  if (!rfc) { dsToast({ title: 'Falta el RFC', message: 'Escribe tu RFC para continuar.', type: 'error' }); return; }
  if (!frente || !reverso) { dsToast({ title: 'Faltan documentos', message: 'Sube la foto del frente y el reverso de tu INE.', type: 'error' }); return; }

  const formData = new FormData();
  formData.append('rfc', rfc);
  formData.append('ineFrente', frente);
  formData.append('ineReverso', reverso);

  const data = await api.postForm('/auth/kyc', formData);
  if (data.ok) {
    dsToast({ title: 'Documentos enviados', message: data.mensaje || 'Tu verificación está en revisión.', type: 'success' });
    user.kyc = { status: 'en_revision' };
    user.rfc = rfc;
    localStorage.setItem('user', JSON.stringify(user));
    const box = document.getElementById('kyc-cuenta-box');
    if (box) box.innerHTML = renderKycCuenta(user);
  } else {
    if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#c62828'; msgEl.textContent = data.error || 'No se pudo enviar la verificación.'; }
    dsToast({ title: 'No se pudo enviar', message: data.error || 'Intenta de nuevo.', type: 'error' });
  }
};

const cargarCuenta = () => {
  const info = document.getElementById('cuenta-info');
  if (!user) return;

  const planUser = (user.plan || 'gratuito').toLowerCase();
  const tienePlanPago = planUser === 'basico' || planUser === 'premium';
  const planCancelado = user.planCancelado === true;
  const planPeriodo = user.planPeriodo || 'mensual';
  const planFechaFin = user.planFechaFin ? new Date(user.planFechaFin) : null;
  const planFechaInicio = user.planFechaInicio ? new Date(user.planFechaInicio) : null;
  const cargoRecurrenteAutorizado = user.cargoRecurrenteAutorizado === true;

  // Calcular días restantes
  let diasRestantes = null;
  let fechaFinTexto = 'No disponible';
  if (planFechaFin && planFechaFin > new Date()) {
    diasRestantes = Math.ceil((planFechaFin - new Date()) / (1000 * 60 * 60 * 24));
    fechaFinTexto = planFechaFin.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // Etiqueta de periodo
  const periodoLabel = planPeriodo === 'anual' ? 'Anual' : 'Mensual';
  const periodoIcon = planPeriodo === 'anual' ? '📅' : '🗓️';

  // Sección de gestión de plan (solo si tiene plan de pago)
  let planManagementHTML = '';
  if (tienePlanPago) {
    const estadoPlanColor = planCancelado ? '#dc2626' : '#16a34a';
    const estadoPlanTexto = planCancelado ? 'Cancelado (vigente hasta la fecha de término)' : 'Activo';
    const estadoPlanIcon = planCancelado ? '⏳' : '✅';

    planManagementHTML = `
      <div style="background:var(--bg-secondary);border-radius:16px;padding:24px;border:1px solid var(--border);margin-bottom:24px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px">
          <div>
            <h3 style="font-size:16px;margin-bottom:4px;font-family:'Bricolage Grotesque',sans-serif">📋 Gestión de suscripción</h3>
            <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
              <span style="display:inline-flex;align-items:center;gap:4px;background:${estadoPlanColor}18;color:${estadoPlanColor};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600">
                ${estadoPlanIcon} ${estadoPlanTexto}
              </span>
              <span style="font-size:13px;color:var(--text-light)">${periodoIcon} Plan ${user.plan} · ${periodoLabel}</span>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:20px">
          <div style="background:var(--bg);border-radius:10px;padding:14px;border:1px solid var(--border)">
            <div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Inicio</div>
            <div style="font-size:14px;font-weight:600">${planFechaInicio ? planFechaInicio.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</div>
          </div>
          <div style="background:var(--bg);border-radius:10px;padding:14px;border:1px solid var(--border)">
            <div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Vigencia hasta</div>
            <div style="font-size:14px;font-weight:600">${fechaFinTexto}</div>
          </div>
          <div style="background:var(--bg);border-radius:10px;padding:14px;border:1px solid var(--border)">
            <div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Días restantes</div>
            <div style="font-size:14px;font-weight:600;color:${diasRestantes !== null && diasRestantes <= 7 ? '#dc2626' : 'var(--text)'}">${diasRestantes !== null ? diasRestantes + ' días' : 'N/A'}</div>
          </div>
          <div style="background:var(--bg);border-radius:10px;padding:14px;border:1px solid var(--border)">
            <div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Periodo</div>
            <div style="font-size:14px;font-weight:600">${periodoLabel}</div>
          </div>
        </div>

        ${planCancelado ? `
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;margin-bottom:16px">
            <div style="font-size:13px;font-weight:600;color:#991b1b;margin-bottom:4px">⚠️ Suscripción cancelada</div>
            <div style="font-size:12px;color:#7f1d1d;line-height:1.6">
              Tu plan se mantiene activo hasta el <b>${fechaFinTexto}</b>. Después de esa fecha, tu cuenta regresará al plan Gratuito automáticamente. No se realizarán cargos adicionales. Puedes reactivar tu suscripción en cualquier momento antes de la fecha de vencimiento.
            </div>
            <button class="btn btn-primary" style="margin-top:12px;padding:9px 20px;font-size:13px" onclick="reactivarSuscripcion()">
              🔄 Reactivar suscripción
            </button>
          </div>
        ` : `
          ${planPeriodo === 'mensual' && !cargoRecurrenteAutorizado ? `
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;margin-bottom:16px">
              <div style="font-size:13px;font-weight:600;color:#92400e;margin-bottom:4px">⚡ Cargo recurrente no autorizado</div>
              <div style="font-size:12px;color:#78350f;line-height:1.6">
                Tu plan mensual requiere autorización de cargo recurrente para renovarse automáticamente. Sin esta autorización, tu plan no se renovará al final del periodo y pasarás al plan Gratuito.
              </div>
              <button class="btn btn-primary" style="margin-top:12px;padding:9px 20px;font-size:13px;background:#92400e" onclick="mostrarModalAutorizacionCargo()">
                Autorizar cargo recurrente
              </button>
            </div>
          ` : planPeriodo === 'mensual' && cargoRecurrenteAutorizado ? `
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;margin-bottom:16px">
              <div style="font-size:13px;color:#166534;line-height:1.6">
                ✅ Cargo recurrente autorizado. Tu plan se renovará automáticamente el <b>${fechaFinTexto}</b>. Recibirás notificación mínimo 10 días hábiles antes del cargo.
              </div>
              <button class="btn btn-outline" style="margin-top:10px;padding:7px 16px;font-size:12px;border-color:#dc2626;color:#dc2626" onclick="mostrarModalRevocarCargo()">
                Revocar autorización de cargo recurrente
              </button>
            </div>
          ` : ''}

          <button class="btn btn-outline" style="padding:10px 24px;font-size:14px;border-color:#dc2626;color:#dc2626" onclick="mostrarModalCancelarPlan()">
            Cancelar suscripción
          </button>
        `}

        <div style="margin-top:28px;padding-top:24px;border-top:1px solid var(--border)">
          <div style="font-weight:700;font-size:15px;color:#dc2626;margin-bottom:6px">Zona de peligro</div>
          <div style="font-size:13px;color:var(--text-light);margin-bottom:14px;line-height:1.6">
            Al eliminar tu cuenta se borrará tu perfil de forma permanente y tus publicaciones dejarán de estar disponibles en el catálogo. Esta acción no se puede deshacer.
          </div>
          <button class="btn btn-outline" style="border-color:#dc2626;color:#dc2626;padding:10px 20px;font-size:13px" onclick="mostrarModalEliminarCuenta()">Eliminar mi cuenta</button>
        </div>
      </div>
    `;
  }

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
      <div class="form-grupo">
        <label>Plan actual</label>
        <div style="display:flex;align-items:center;gap:10px">
          <input type="text" class="form-input" value="${user.plan}" disabled style="flex:1">
          ${!tienePlanPago ? `<button class="btn btn-primary" style="padding:10px 18px;font-size:13px;white-space:nowrap" onclick="mostrarModalPlanes()">Mejorar plan</button>` : ''}
        </div>
      </div>
    </div>

    ${planManagementHTML}

    <div id="kyc-cuenta-box">${renderKycCuenta(user)}</div>

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
        ${tienePlanPago && planPeriodo === 'mensual' && cargoRecurrenteAutorizado ? `
          <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer">
            <div><div style="font-size:14px;font-weight:500">Recordatorio de cargo recurrente</div><div style="font-size:12px;color:var(--text-light)">Aviso mínimo 10 días hábiles antes de cada cargo a tu tarjeta</div></div>
            <input type="checkbox" id="notif-cargo-recurrente" ${user.notificaciones?.cargoRecurrente !== false ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary);cursor:pointer">
          </label>
        ` : ''}
      </div>
      <button class="btn btn-primary" style="margin-top:20px;padding:10px 24px;font-size:14px" onclick="guardarNotificaciones()">Guardar preferencias</button>
      <div id="notif-msg" style="display:none;margin-top:12px"></div>
    </div>
        <div style="margin-top:28px;padding-top:24px;border-top:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
        <div style="width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;background:${!!user.twoFactorEnabled ? '#f0fdf4' : 'var(--bg-secondary)'}">🛡️</div>
        <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:16px;font-family:'Bricolage Grotesque',sans-serif">Autenticación en dos pasos</div><div style="font-size:13px;color:var(--text-light);margin-top:2px">Código adicional al iniciar sesión (opcional)</div></div>
        <span style="font-size:12px;padding:4px 10px;border-radius:6px;font-weight:600;white-space:nowrap;background:${!!user.twoFactorEnabled ? '#f0fdf4' : 'var(--bg-secondary)'};color:${!!user.twoFactorEnabled ? '#16a34a' : 'var(--text-light)'};border:1px solid ${!!user.twoFactorEnabled ? '#bbf7d0' : 'var(--border)'}">${!!user.twoFactorEnabled ? 'Activa' : 'Inactiva'}</span>
      </div>
      <div style="padding:14px 16px;border-radius:10px;border:1px solid var(--border);margin-bottom:16px;font-size:13px;color:var(--text-light);line-height:1.6">${!!user.twoFactorEnabled ? 'Tu cuenta tiene autenticación en dos pasos activada. Cada vez que inicies sesión se te pedirá un código de Google Authenticator.' : 'Activa la autenticación en dos pasos para añadir una capa extra de seguridad a tu cuenta. Es completamente opcional y puedes desactivarla cuando quieras.'}</div>
      <div id="accion-2fa">${!!user.twoFactorEnabled ? '<button class="btn btn-outline" style="width:100%;padding:12px;font-size:14px" onclick="window._2faDesactivar()">Desactivar autenticación en dos pasos</button>' : '<a href="configurar-2fa.html" class="btn btn-primary" style="width:100%;padding:12px;font-size:14px;text-align:center;display:block;text-decoration:none">Activar autenticación en dos pasos</a>'}</div>
    </div>
    <button class="btn btn-outline" onclick="auth.logout()">Cerrar sesión</button>
  `;
};

// ==========================================
// MODAL GENÉRICO DE CONFIRMACIÓN (cancelar/reactivar plan, cargo recurrente, eliminar cuenta)
// ==========================================
let _confirmacionCuentaCallback = null;
let _confirmacionCuentaRequierePassword = false;

const mostrarModalConfirmarCuenta = ({ titulo, mensaje, requierePassword = false, textoBoton = 'Confirmar', colorBoton = null, onConfirmar }) => {
  document.getElementById('mcc-titulo').textContent = titulo;
  document.getElementById('mcc-mensaje').innerHTML = mensaje;
  document.getElementById('mcc-password-wrap').style.display = requierePassword ? 'block' : 'none';
  document.getElementById('mcc-password').value = '';
  document.getElementById('mcc-error').style.display = 'none';
  const btn = document.getElementById('mcc-confirmar');
  btn.textContent = textoBoton;
  btn.style.background = colorBoton || '';
  btn.style.borderColor = colorBoton || '';
  _confirmacionCuentaCallback = onConfirmar;
  _confirmacionCuentaRequierePassword = requierePassword;
  document.getElementById('modal-confirmar-cuenta').style.display = 'flex';
};

window.cerrarModalConfirmarCuenta = () => {
  document.getElementById('modal-confirmar-cuenta').style.display = 'none';
  _confirmacionCuentaCallback = null;
};

window.ejecutarConfirmacionCuenta = async () => {
  if (!_confirmacionCuentaCallback) return;
  const errorEl = document.getElementById('mcc-error');
  errorEl.style.display = 'none';
  const password = document.getElementById('mcc-password').value;
  if (_confirmacionCuentaRequierePassword && !password) {
    errorEl.textContent = 'Ingresa tu contraseña para continuar.';
    errorEl.style.display = 'block';
    return;
  }
  const btn = document.getElementById('mcc-confirmar');
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Procesando...';
  const resultado = await _confirmacionCuentaCallback(password);
  btn.disabled = false;
  btn.textContent = textoOriginal;
  if (resultado && resultado.error) {
    errorEl.textContent = resultado.error;
    errorEl.style.display = 'block';
  } else {
    window.cerrarModalConfirmarCuenta();
  }
};

window.mostrarModalCancelarPlan = () => {
  mostrarModalConfirmarCuenta({
    titulo: 'Cancelar suscripción',
    mensaje: 'Tu plan se mantendrá activo hasta la fecha de vencimiento. Después de esa fecha, tu cuenta regresará al plan Gratuito automáticamente. No se realizarán más cargos. ¿Deseas continuar?',
    textoBoton: 'Sí, cancelar suscripción',
    colorBoton: '#dc2626',
    onConfirmar: async () => {
      const data = await api.post('/auth/cancelar-suscripcion', {});
      if (data.ok) { dsToast({ title: 'Suscripción cancelada', message: 'Se mantendrá activa hasta la fecha de vencimiento.', type: 'info' }); cargarCuenta(); return {}; }
      return { error: data.error || 'No se pudo cancelar.' };
    }
  });
};

window.reactivarSuscripcion = () => {
  mostrarModalConfirmarCuenta({
    titulo: 'Reactivar suscripción',
    mensaje: 'Tu plan seguirá renovándose normalmente. ¿Deseas reactivarla?',
    textoBoton: 'Sí, reactivar',
    onConfirmar: async () => {
      const data = await api.post('/auth/reactivar-suscripcion', {});
      if (data.ok) { dsToast({ title: 'Suscripción reactivada', message: 'Tu plan seguirá renovándose normalmente.', type: 'success' }); cargarCuenta(); return {}; }
      return { error: data.error || 'No se pudo reactivar.' };
    }
  });
};

window.mostrarModalAutorizacionCargo = () => {
  mostrarModalConfirmarCuenta({
    titulo: 'Autorizar cargo recurrente',
    mensaje: 'Al autorizar, tu plan se renovará automáticamente al final de cada periodo. Recibirás una notificación mínimo 10 días hábiles antes de cada cargo. Puedes revocar esta autorización cuando quieras.',
    textoBoton: 'Sí, autorizar',
    onConfirmar: async () => {
      const data = await api.post('/auth/autorizar-cargo-recurrente', {});
      if (data.ok) { dsToast({ title: 'Cargo recurrente autorizado', message: 'Tu plan se renovará automáticamente.', type: 'success' }); cargarCuenta(); return {}; }
      return { error: data.error || 'No se pudo autorizar.' };
    }
  });
};

window.mostrarModalRevocarCargo = () => {
  mostrarModalConfirmarCuenta({
    titulo: 'Revocar cargo recurrente',
    mensaje: 'Tu plan no se renovará automáticamente. Al llegar la fecha de vencimiento, tu cuenta pasará al plan Gratuito. ¿Deseas continuar?',
    textoBoton: 'Sí, revocar',
    colorBoton: '#dc2626',
    onConfirmar: async () => {
      const data = await api.post('/auth/revocar-cargo-recurrente', {});
      if (data.ok) { dsToast({ title: 'Cargo recurrente revocado', message: 'Tu plan sigue activo hasta su vencimiento.', type: 'info' }); cargarCuenta(); return {}; }
      return { error: data.error || 'No se pudo revocar.' };
    }
  });
};

window.mostrarModalEliminarCuenta = () => {
  mostrarModalConfirmarCuenta({
    titulo: '⚠️ Eliminar mi cuenta',
    mensaje: 'Esta acción es <b>permanente</b>. Se borrará tu perfil y tus publicaciones dejarán de estar disponibles en el catálogo. Ingresa tu contraseña para confirmar.',
    requierePassword: true,
    textoBoton: 'Eliminar cuenta permanentemente',
    colorBoton: '#dc2626',
    onConfirmar: async (password) => {
      const data = await api.delete('/auth/cuenta', { password });
      if (data.ok) {
        dsToast({ title: 'Cuenta eliminada', message: 'Tu cuenta fue eliminada permanentemente.', type: 'info' });
        setTimeout(() => { auth.logout(); }, 1200);
        return {};
      }
      return { error: data.error || 'No se pudo eliminar la cuenta.' };
    }
  });
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
window.contratarPlan = (plan, periodo = 'mensual') => {
  const STRIPE_LINKS = { 
    basico_mensual: 'https://buy.stripe.com/test_9B6fZhgExb2QejO8EGc3m00', 
    basico_anual: 'https://buy.stripe.com/test_dRmfZh1JDc6U2B6cUWc3m01'
  };
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (plan === 'basico' && user.plan === 'basico') {
    return dsToast({ title: 'Ya tienes este plan', message: 'Actualmente cuentas con el Plan Básico.', type: 'info' });
  }

  // Si es mensual, mostrar aviso de que el cargo recurrente se autoriza DESPUÉS
  // (conforme a la ley: la autorización debe ser un acto separado y explícito,
  //  no un checkbox oculto en la compra)
  if (plan === 'basico' && periodo === 'mensual') {
    const overlay = document.createElement('div');
    overlay.id = 'modal-previo-mensual';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:10600;font-family:"Inter","Segoe UI",sans-serif';
    overlay.innerHTML = `
      <div style="background:white;border-radius:20px;padding:28px;max-width:440px;width:90%;box-shadow:0 32px 80px rgba(0,0,0,0.35)">
        <div style="font-size:36px;text-align:center;margin-bottom:12px">🛒</div>
        <h2 style="font-size:18px;font-weight:800;color:#0f172a;text-align:center;margin-bottom:8px">Plan Básico Mensual — $99 MXN</h2>
        <p style="font-size:13px;color:#64748b;text-align:center;line-height:1.6;margin-bottom:20px">
          Estás a punto de realizar un <b>pago único de $99 MXN</b> por tu primer mes. <br><br>
          <span style="color:#dc2626;font-weight:600">Este pago NO activa el cargo recurrente automáticamente.</span> Después de tu compra, podrás autorizar la renovación automática desde tu panel de cuenta, con todos los detalles y protecciones que exige la ley.
        </p>
        <div style="display:flex;gap:10px">
          <button onclick="document.getElementById('modal-previo-mensual')?.remove()" style="flex:1;padding:12px;background:#f1f5f9;color:#475569;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer">Cancelar</button>
          <button onclick="document.getElementById('modal-previo-mensual')?.remove(); window.location.href='${STRIPE_LINKS.basico_mensual}?client_reference_id=${user._id || user.id}'" style="flex:1;padding:12px;background:#0369a1;color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer">Pagar $99 MXN</button>
        </div>
      </div>
    `;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    return;
  }

  // Plan anual: va directo a Stripe (pago único, no es recurrente)
  const linkStripe = STRIPE_LINKS[`${plan}_${periodo}`];
  if (linkStripe) {
    window.location.href = `${linkStripe}?client_reference_id=${user._id || user.id}`;
  } else {
    dsToast({ title: 'Próximamente', message: 'Este plan estará disponible muy pronto.', type: 'info' });
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

// Forzar carga del resumen al entrar al dashboard
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    cargarResumenUsuario();
  }, 300);
});
window._2faDesactivar = () => {
  if (document.getElementById('confirm-2fa-off')) return;
  const accion = document.getElementById('accion-2fa');
  if (!accion) return;
  accion.innerHTML =
    '<div id="confirm-2fa-off" style="padding:14px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;margin-bottom:12px">' +
      '<div style="font-size:14px;font-weight:600;color:#991b1b;margin-bottom:4px">¿Desactivar autenticación en dos pasos?</div>' +
      '<div style="font-size:13px;color:#b91c1c;line-height:1.5;margin-bottom:12px">Tu cuenta quedará menos protegida. Podrás volver a activarla cuando quieras.</div>' +
      '<div style="margin-bottom:12px">' +
        '<label style="font-size:13px;font-weight:500;color:#374151;display:block;margin-bottom:4px">Ingresa tu contraseña para confirmar:</label>' +
        '<input type="password" id="ds-2fa-password-input" class="form-input" placeholder="Tu contraseña" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;box-sizing:border-box" autocomplete="current-password">' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:10px">' +
      '<button class="btn btn-outline" style="flex:1;padding:12px;font-size:14px" onclick="window._2faRender()">Cancelar</button>' +
      '<button class="btn" id="btn-2fa-confirm-off" style="flex:1;padding:12px;font-size:14px;background:#dc2626;color:#fff;border:none;border-radius:8px;cursor:pointer" onclick="window._2faConfirmarDesactivar()">Sí, desactivar</button>' +
    '</div>';
};

window._2faConfirmarDesactivar = async () => {
  const btn = document.getElementById('btn-2fa-confirm-off');
  if (!btn) return;
  
  // Obtener la contraseña que el usuario escribió
  const passwordInput = document.getElementById('ds-2fa-password-input');
  const password = passwordInput ? passwordInput.value.trim() : '';

  // Validar que no esté vacía
  if (!password) {
    btn.textContent = 'Sí, desactivar';
    btn.disabled = false;
    if (typeof dsToast === 'function') dsToast({ title: 'Contraseña requerida', message: 'Debes escribir tu contraseña para continuar.', type: 'error' });
    return;
  }

  btn.textContent = 'Desactivando...';
  btn.disabled = true;
  try {
    // Enviar la contraseña al backend
    const data = await api.post('/auth/2fa/desactivar', { password: password });
    if (data.ok) {
      const user = auth.getUser();
      if (user) { user.twoFactorEnabled = false; localStorage.setItem('user', JSON.stringify(user)); }
      cargarCuenta();
      if (typeof dsToast === 'function') dsToast({ title: '2FA desactivada', message: 'La autenticación en dos pasos se ha desactivado.', type: 'success' });
    } else {
      btn.textContent = 'Sí, desactivar'; btn.disabled = false;
      if (typeof dsToast === 'function') dsToast({ title: 'Error', message: data.error || 'No se pudo desactivar.', type: 'error' });
    }
  } catch (e) {
    btn.textContent = 'Sí, desactivar'; btn.disabled = false;
    if (typeof dsToast === 'function') dsToast({ title: 'Error de conexión', message: 'Intenta de nuevo.', type: 'error' });
  }
};

window._2faRender = () => { cargarCuenta(); };