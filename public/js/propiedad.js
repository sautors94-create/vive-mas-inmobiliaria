(() => {
  'use strict';

  // ==========================================
  // VALIDACIÓN DE URL
  // ==========================================
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id || !/^[a-fA-F0-9]{24}$/.test(id)) {
    window.location.replace('catalogo.html');
    throw new Error('Redirigiendo: ID de propiedad inválido.');
  }

  let favoritoActivo = false;

  // ==========================================
  // SEGURIDAD: Escapar HTML para prevenir XSS
  // ==========================================
  const escapeHTML = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // ==========================================
  // SEGURIDAD: Validar URLs de imágenes
  // ==========================================
  const esUrlValida = (url) => {
    if (typeof url !== 'string' || !url.trim()) return false;
    try {
      const u = new URL(url, window.location.origin);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  };

  // ==========================================
  // SEGURIDAD: Validar tipo de mensaje
  // ==========================================
  const normalizarTipoMensaje = (tipo) => {
    return tipo === 'success' ? 'success' : 'error';
  };

  // ==========================================
  // SEGURIDAD: Mostrar mensajes de forma segura
  // ==========================================
  const mostrarMsg = (mensaje, tipo = 'error') => {
    const msgEl = document.getElementById('contacto-msg');
    if (!msgEl) return;
    const tipoSeguro = normalizarTipoMensaje(tipo);
    msgEl.innerHTML = `<div class="alert alert-${tipoSeguro}">${escapeHTML(mensaje)}</div>`;
    msgEl.style.display = 'block';
    setTimeout(() => { msgEl.style.display = 'none'; }, 3500);
  };

  // ==========================================
  // SEGURIDAD: Comprobar autenticación
  // ==========================================
  const usuarioEstaAutenticado = () => {
    try {
      return typeof auth !== 'undefined' && typeof auth.isLoggedIn === 'function' && auth.isLoggedIn();
    } catch (error) {
      console.error('Error comprobando autenticación:', error);
      return false;
    }
  };

  // ==========================================
  // SEO DINÁMICO DE LA PROPIEDAD
  // ==========================================
  const actualizarSEOPropiedad = (p, imagenSegura, fotosValidas) => {
    if (!p) return;

    const propiedadId = p._id ? String(p._id) : id;
    const url = `${window.location.origin}/pages/propiedad.html?id=${encodeURIComponent(propiedadId)}`;
    const tituloSeguro = `${p.titulo || 'Propiedad'} — Vive Más Inmobiliaria`;

    const ubicacion = [p.ubicacion?.colonia, p.ubicacion?.ciudad, p.ubicacion?.estado].filter(Boolean).join(', ');
    const operacion = p.operacion === 'renta' ? 'en renta' : 'en venta';
    
    const descripcionBase = p.descripcion ? String(p.descripcion).replace(/\s+/g, ' ').trim() : '';
    let descripcion = `${p.titulo || 'Propiedad inmobiliaria'} ${operacion}${ubicacion ? ` en ${ubicacion}` : ''}. ${descripcionBase || 'Conoce todos los detalles de esta propiedad en Vive Más Inmobiliaria.'}`;

    if (descripcion.length > 155) {
      descripcion = descripcion.slice(0, 155);
      const ultimoEspacio = descripcion.lastIndexOf(' ');
      if (ultimoEspacio > 100) descripcion = descripcion.slice(0, ultimoEspacio);
      descripcion += '…';
    }

    document.title = tituloSeguro;

    const canonical = document.getElementById('canonical-url');
    if (canonical) canonical.href = url;

    const metaDescription = document.getElementById('seo-description');
    if (metaDescription) metaDescription.setAttribute('content', descripcion);

    const ogTitle = document.getElementById('og-title');
    if (ogTitle) ogTitle.setAttribute('content', tituloSeguro);

    const ogDescription = document.getElementById('og-description');
    if (ogDescription) ogDescription.setAttribute('content', descripcion);

    const ogUrl = document.getElementById('og-url');
    if (ogUrl) ogUrl.setAttribute('content', url);

    const ogImage = document.getElementById('og-image');
    if (ogImage && imagenSegura) ogImage.setAttribute('content', imagenSegura);

    const twTitle = document.getElementById('twitter-title');
    if (twTitle) twTitle.setAttribute('content', tituloSeguro);

    const twDesc = document.getElementById('twitter-description');
    if (twDesc) twDesc.setAttribute('content', descripcion);

    const twImage = document.getElementById('twitter-image');
    if (twImage && imagenSegura) twImage.setAttribute('content', imagenSegura);

    const schemaExistente = document.getElementById('property-schema');
    if (schemaExistente) schemaExistente.remove();

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'RealEstateListing',
      'url': url,
      'name': p.titulo || 'Propiedad inmobiliaria',
      'description': descripcion,
      'image': Array.isArray(fotosValidas) ? fotosValidas : [],
      'datePosted': p.createdAt || undefined,
      'offers': { '@type': 'Offer', 'price': p.precio, 'priceCurrency': 'MXN', 'url': url, 'availability': 'https://schema.org/InStock' }
    };

    if (p.ubicacion) {
      schema.contentLocation = {
        '@type': 'Place',
        'address': { '@type': 'PostalAddress', 'addressLocality': p.ubicacion.ciudad || '', 'addressRegion': p.ubicacion.estado || '', 'addressCountry': 'MX' }
      };
    }

    Object.keys(schema).forEach((key) => { if (schema[key] === undefined) delete schema[key]; });

    const script = document.createElement('script');
    script.id = 'property-schema';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  };

  // ==========================================
  // FAVORITOS: Revisar estado
  // ==========================================
  const revisarFavorito = async (propiedadId) => {
    if (!usuarioEstaAutenticado()) return false;
    try {
      if (typeof api === 'undefined' || typeof api.get !== 'function') return false;
      const data = await api.get('/favoritos');
      if (!data?.ok || !Array.isArray(data.favoritos)) return false;
      return data.favoritos.some((f) => String(f?.propiedad?._id) === String(propiedadId));
    } catch (error) {
      console.error('Error revisando favorito:', error);
      return false;
    }
  };

  // ==========================================
  // FAVORITOS: Actualizar botón
  // ==========================================
  const actualizarBotonFavorito = () => {
    const btn = document.getElementById('btn-favorito');
    if (!btn) return;
    if (favoritoActivo) {
      btn.textContent = '💔 Eliminar de favoritos';
      btn.classList.remove('btn-outline');
      btn.classList.add('btn-danger');
    } else {
      btn.textContent = '❤️ Guardar en favoritos';
      btn.classList.remove('btn-danger');
      btn.classList.add('btn-outline');
    }
  };

  // ==========================================
  // CARGAR PROPIEDAD
  // ==========================================
  const cargarPropiedad = async () => {
    const contenido = document.getElementById('propiedad-contenido');
    if (!contenido) { console.error('No existe #propiedad-contenido'); return; }

    if (typeof api === 'undefined' || typeof api.get !== 'function') {
      contenido.innerHTML = `<div style="text-align:center;padding:100px 24px"><div style="font-size:64px;margin-bottom:24px">⚠️</div><h2 style="margin-bottom:12px">No se pudo cargar la propiedad</h2><p style="color:var(--text-light);margin-bottom:24px">El servicio no está disponible en este momento.</p><a href="catalogo.html" class="btn btn-primary">Volver al catálogo</a></div>`;
      return;
    }

    let data;
    try {
      data = await api.get(`/propiedades/${encodeURIComponent(id)}`);
    } catch (error) {
      console.error('Error cargando propiedad:', error);
      contenido.innerHTML = `<div style="text-align:center;padding:100px 24px"><div style="font-size:64px;margin-bottom:24px">📡</div><h2 style="margin-bottom:12px">No se pudo cargar la propiedad</h2><p style="color:var(--text-light);margin-bottom:24px">Comprueba tu conexión a internet e inténtalo nuevamente.</p><a href="catalogo.html" class="btn btn-primary">Volver al catálogo</a></div>`;
      return;
    }

    if (!data?.ok || !data?.propiedad) {
      contenido.innerHTML = `<div style="text-align:center;padding:100px 24px"><div style="font-size:64px;margin-bottom:24px">🏚️</div><h2 style="margin-bottom:12px">Propiedad no encontrada</h2><p style="color:var(--text-light);margin-bottom:24px">Esta propiedad no está disponible.</p><a href="catalogo.html" class="btn btn-primary">Ver catálogo</a></div>`;
      return;
    }

    const p = data.propiedad;
    const ubicacion = p.ubicacion || {};
    const caract = p.caracteristicas || {};
    const propietario = p.propietario || {};

    const fotosValidas = Array.isArray(p.fotos) ? p.fotos.filter(esUrlValida) : [];
    const imagenSegura = fotosValidas[0] || null;

    const latPublica = Number(ubicacion.latPublica);
    const lngPublica = Number(ubicacion.lngPublica);
    const tieneCoordsPublicas = Number.isFinite(latPublica) && Number.isFinite(lngPublica);

    actualizarSEOPropiedad(p, imagenSegura, fotosValidas);

    const galeriaHTML = fotosValidas.length > 0
      ? `<div class="propiedad-galeria"><div class="galeria-main"><img src="${escapeHTML(fotosValidas[0])}" alt="${escapeHTML(p.titulo || 'Propiedad')}"></div>${fotosValidas[1] ? `<div class="galeria-thumb"><img src="${escapeHTML(fotosValidas[1])}" alt="Foto 2"></div>` : '<div class="galeria-thumb" style="background:var(--bg-secondary)"></div>'}${fotosValidas[2] ? `<div class="galeria-thumb"><img src="${escapeHTML(fotosValidas[2])}" alt="Foto 3"></div>` : '<div class="galeria-thumb" style="background:var(--bg-secondary)"></div>'}</div>`
      : `<div class="propiedad-galeria"><div class="galeria-vacia">Sin fotografías disponibles</div></div>`;

    let comparadorActivo = false;
    try {
      if (typeof comparadorTieneId === 'function') comparadorActivo = comparadorTieneId(p._id);
    } catch (error) { console.error('Error comprobando comparador:', error); }

    contenido.innerHTML = `
      <div class="container" style="padding-top:32px;padding-bottom:80px">
        <div style="margin-bottom:16px"><a href="catalogo.html" style="color:var(--text-light);text-decoration:none;font-size:14px">← Volver al catálogo</a></div>
        ${galeriaHTML}
        <div class="propiedad-layout">
          <div class="propiedad-info">
            <div style="display:flex;gap:8px;margin-bottom:16px">
              <span class="tag tag-${escapeHTML(p.operacion)}">${escapeHTML(p.operacion)}</span>
              <span class="tag tag-${escapeHTML(p.tipo)}">${escapeHTML(p.tipo)}</span>
            </div>
            <h1 class="propiedad-info">${escapeHTML(p.titulo)}</h1>
            <div class="propiedad-ubicacion">📍 ${ubicacion.colonia ? escapeHTML(ubicacion.colonia) + ', ' : ''}${escapeHTML(ubicacion.ciudad)}, ${escapeHTML(ubicacion.estado)}</div>
            <div class="propiedad-precio-grande">${typeof formatPrecio === 'function' ? formatPrecio(p.precio) : escapeHTML(p.precio)}</div>
            <div class="propiedad-operacion">Precio de ${p.operacion === 'renta' ? 'renta mensual' : 'venta'}</div>
            
            <label data-comparador-id="${escapeHTML(p._id)}" class="comparador-check${comparadorActivo ? ' activo' : ''}" style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:6px 14px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;width:fit-content">
              <input type="checkbox" id="checkbox-comparador" ${comparadorActivo ? 'checked' : ''} style="cursor:pointer">
              ⚖️ Agregar a comparación
            </label>

            <div class="caracteristicas-grid">
              ${caract.recamaras ? `<div class="caract-item"><div class="caract-valor">${escapeHTML(caract.recamaras)}</div><div class="caract-label">Recámaras</div></div>` : ''}
              ${caract.banos ? `<div class="caract-item"><div class="caract-valor">${escapeHTML(caract.banos)}</div><div class="caract-label">Baños completos</div></div>` : ''}
              ${caract.mediosBanos ? `<div class="caract-item"><div class="caract-valor">${escapeHTML(caract.mediosBanos)}</div><div class="caract-label">Medios baños</div></div>` : ''}
              ${caract.estacionamientos ? `<div class="caract-item"><div class="caract-valor">${escapeHTML(caract.estacionamientos)}</div><div class="caract-label">Estacion.</div></div>` : ''}
              ${caract.m2 ? `<div class="caract-item"><div class="caract-valor">${escapeHTML(caract.m2)}</div><div class="caract-label">m²</div></div>` : ''}
            </div>

            ${p.operacion === 'venta' && Array.isArray(p.creditosAceptados) && p.creditosAceptados.length > 0 ? `
            <div class="creditos-block" style="margin-top:18px">
              <div class="creditos-titulo" style="font-size:15px;font-weight:700;margin-bottom:8px">💳 Financiamiento aceptado</div>
              <div style="display:flex;flex-wrap:wrap;gap:8px">
                ${p.creditosAceptados.map((c) => `<span style="padding:6px 14px;border-radius:20px;background:var(--primary-light, #e6f2ea);color:var(--primary, #1a472a);font-size:12.5px;font-weight:600">${escapeHTML(c)}</span>`).join('')}
              </div>
            </div>` : ''}

            <div class="descripcion-titulo">Descripción</div>
            <div class="descripcion-texto">${escapeHTML(p.descripcion)}</div>

            ${tieneCoordsPublicas ? `
            <div class="mapa-titulo">Ubicación</div>
            <div id="mapa"></div>
            <div class="mapa-nota">🔒 Zona aproximada de la propiedad.</div>
            <div class="mapa-acciones">
              <a class="btn btn-outline mapa-btn" id="link-google-maps" href="#" target="_blank" rel="noopener noreferrer">📍 Ver en Google Maps</a>
              <a class="btn btn-outline mapa-btn" id="link-waze" href="#" target="_blank" rel="noopener noreferrer">🧭 Ver en Waze</a>
            </div>` : ''}
          </div>

          <div>
            <div class="contacto-card">
              <h3>¿Te interesa esta propiedad?</h3>
              <p style="font-size:13px;color:var(--text-light)">Contacta directamente al propietario</p>
              ${propietario.nombre ? `<div class="propietario-info"><div class="propietario-avatar">${escapeHTML(String(propietario.nombre).charAt(0))}</div><div><div class="propietario-nombre">${escapeHTML(propietario.nombre)}</div><div class="propietario-telefono">Propietario verificado ✓</div></div></div>` : ''}
              
              <div id="contacto-form">
                <p style="font-size:13px;color:var(--text-light);margin-bottom:12px">Envía un mensaje al propietario. Tus datos están protegidos.</p>
                <textarea class="mensaje-input" id="mensaje-texto" placeholder="Hola, me interesa esta propiedad. ¿Podría darme más información?"></textarea>
                <button id="btn-enviar-mensaje" class="btn btn-primary" style="width:100%;padding:14px">Enviar mensaje</button>
                <button id="btn-favorito" class="btn btn-outline" style="width:100%;padding:12px;margin-top:8px">❤️ Guardar en favoritos</button>
                <div id="favorito-login-hint" class="favorito-login-hint" aria-live="polite">Inicia sesión para guardar esta propiedad en favoritos.</div>
                <button id="btn-reportar" class="btn btn-outline" style="width:100%;padding:10px;margin-top:8px;font-size:12.5px;color:#6b7280;border-color:#e5e7eb">🚩 Reportar publicación</button>
                <div style="display:flex;align-items:center;gap:6px;margin-top:12px;padding:10px;background:var(--bg-secondary);border-radius:8px">
                  <span style="font-size:16px">🔒</span>
                  <span style="font-size:11px;color:var(--text-light)">Tus datos y los del propietario están protegidos. La comunicación es a través de Vive Más.</span>
                </div>
                ${!usuarioEstaAutenticado() ? `<p style="font-size:12px;color:var(--text-light);margin-top:10px">Para guardar favoritos y contactar propietarios necesitas una cuenta.</p><a href="#" id="link-login-favorito" class="btn btn-outline" style="width:100%;padding:10px;margin-top:8px;text-align:center;display:block">Iniciar sesión</a>` : ''}
              </div>
              <div id="contacto-msg" style="display:none;margin-top:12px"></div>
            </div>
          </div>
        </div>
      </div>`;

    // EVENTOS
    document.getElementById('btn-enviar-mensaje')?.addEventListener('click', () => enviarMensaje(p._id));
    document.getElementById('btn-favorito')?.addEventListener('click', () => toggleFavorito(p._id));
    
    document.getElementById('btn-reportar')?.addEventListener('click', () => {
      if (usuarioEstaAutenticado()) {
        if (typeof mostrarModalReporte === 'function') mostrarModalReporte({ tipo: 'propiedad', propiedadId: p._id });
        else mostrarMsg('No se pudo abrir el formulario de reporte.');
      } else alert('Inicia sesión para reportar esta publicación.');
    });

    document.getElementById('checkbox-comparador')?.addEventListener('change', (event) => {
      if (typeof comparadorToggle === 'function') { try { comparadorToggle(p._id, event); } catch (e) { console.error(e); } }
    });

    document.getElementById('link-login-favorito')?.addEventListener('click', (event) => {
      event.preventDefault();
      try { localStorage.setItem('redireccion_favorito', window.location.href); } catch (e) {}
      window.location.href = 'login.html';
    });

    if (usuarioEstaAutenticado()) {
      favoritoActivo = await revisarFavorito(p._id);
      actualizarBotonFavorito();
    }

    // LINKS DE MAPAS
    if (tieneCoordsPublicas) {
      const coordenadas = `${latPublica},${lngPublica}`;
      const googleMaps = document.getElementById('link-google-maps');
      const waze = document.getElementById('link-waze');
      if (googleMaps) googleMaps.href = `https://www.google.com/maps?q=${encodeURIComponent(coordenadas)}&z=16`;
      if (waze) waze.href = `https://waze.com/ul?ll=${encodeURIComponent(coordenadas)}&navigate=no`;
    }

    // MAPA LEAFLET
    if (tieneCoordsPublicas) {
      setTimeout(() => {
        if (typeof L === 'undefined' || typeof L.map !== 'function') {
          const mapaEl = document.getElementById('mapa');
          if (mapaEl) mapaEl.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-light)">No se pudo cargar el mapa.</div>';
          return;
        }
        try {
          const mapa = L.map('mapa').setView([latPublica, lngPublica], 15);
          L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 20 }).addTo(mapa);
          L.circle([latPublica, lngPublica], { radius: 100, color: 'var(--primary, #1a472a)', weight: 2, fillColor: 'var(--primary, #1a472a)', fillOpacity: 0.12 }).addTo(mapa).bindPopup(`${escapeHTML(p.titulo || 'Propiedad')} — zona aproximada`);
          setTimeout(() => { try { mapa.setZoom(16); } catch (e) {} }, 50);
        } catch (error) {
          console.error('Error inicializando mapa:', error);
          const mapaEl = document.getElementById('mapa');
          if (mapaEl) mapaEl.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-light)">No se pudo cargar el mapa.</div>';
        }
      }, 100);
    }
  };

  // ==========================================
  // ENVIAR MENSAJE
  // ==========================================
  const enviarMensaje = async (propiedadId) => {
    if (!usuarioEstaAutenticado()) { mostrarMsg('Necesitas iniciar sesión para enviar mensajes.'); return; }
    const textarea = document.getElementById('mensaje-texto');
    const texto = textarea?.value?.trim() || '';
    if (!texto) { mostrarMsg('Escribe un mensaje.'); return; }
    if (typeof api === 'undefined' || typeof api.post !== 'function') { mostrarMsg('El servicio de mensajes no está disponible.'); return; }

    try {
      const data = await api.post(`/mensajes/${encodeURIComponent(propiedadId)}`, { mensaje: texto });
      if (data?.ok) { mostrarMsg('¡Mensaje enviado! El propietario te contactará pronto.', 'success'); if (textarea) textarea.value = ''; }
      else mostrarMsg(data?.error || 'Error al enviar el mensaje.');
    } catch (error) { console.error('Error enviando mensaje:', error); mostrarMsg('No se pudo enviar el mensaje. Comprueba tu conexión e inténtalo nuevamente.'); }
  };

  // ==========================================
  // TOGGLE FAVORITO
  // ==========================================
  const toggleFavorito = async (propiedadId) => {
    if (!usuarioEstaAutenticado()) {
      const btn = document.getElementById('btn-favorito');
      const hint = document.getElementById('favorito-login-hint');
      if (btn) { btn.title = 'Primero inicia sesión para guardar favoritos'; btn.classList.remove('favorito-shake'); void btn.offsetWidth; btn.classList.add('favorito-shake'); }
      if (hint) { hint.classList.add('is-visible'); clearTimeout(Number(hint.dataset.timeoutId || 0)); hint.dataset.timeoutId = String(setTimeout(() => hint.classList.remove('is-visible'), 4500)); }
      mostrarMsg('Primero inicia sesión para guardar favoritos.');
      return;
    }
    if (typeof api === 'undefined') { mostrarMsg('El servicio de favoritos no está disponible.'); return; }

    let data;
    try {
      if (favoritoActivo) {
        if (typeof api.delete !== 'function') { mostrarMsg('No se pudo conectar con el servicio de favoritos.'); return; }
        data = await api.delete(`/favoritos/${encodeURIComponent(propiedadId)}`);
        if (data?.ok) { favoritoActivo = false; actualizarBotonFavorito(); mostrarMsg('Eliminado de favoritos.', 'success'); }
        else mostrarMsg(data?.error || 'No se pudo eliminar de favoritos.');
        return;
      }
      if (typeof api.post !== 'function') { mostrarMsg('No se pudo conectar con el servicio de favoritos.'); return; }
      data = await api.post(`/favoritos/${encodeURIComponent(propiedadId)}`, {});
      if (data?.ok) { favoritoActivo = true; actualizarBotonFavorito(); mostrarMsg('❤️ Agregado a favoritos', 'success'); }
      else if (data?.error === 'Ya está en tus favoritos') { favoritoActivo = true; actualizarBotonFavorito(); mostrarMsg('Esta propiedad ya estaba en tus favoritos.', 'success'); }
      else mostrarMsg(data?.error || 'Error al guardar favorito.');
    } catch (error) { console.error('Error modificando favorito:', error); mostrarMsg('No se pudo actualizar favoritos. Comprueba tu conexión e inténtalo nuevamente.'); }
  };

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================
  document.addEventListener('DOMContentLoaded', async () => {
    try { if (typeof actualizarNavbar === 'function') actualizarNavbar(); } catch (error) { console.error('Error actualizando navbar:', error); }
    await cargarPropiedad();
  });

})();