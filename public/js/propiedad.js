const params = new URLSearchParams(window.location.search);
const id = params.get('id');

if (!id) window.location.href = 'catalogo.html';

let favoritoActivo = false;

document.addEventListener('DOMContentLoaded', async () => {
  actualizarNavbar();
  await cargarPropiedad();
});

const mostrarMsg = (html) => {
  const msgEl = document.getElementById('contacto-msg');
  if (!msgEl) return;
  msgEl.innerHTML = html;
  msgEl.style.display = 'block';
  setTimeout(() => { msgEl.style.display = 'none'; }, 3500);
};

const revisarFavorito = async (propiedadId) => {
  if (!auth.isLoggedIn()) return false;
  const data = await api.get('/favoritos');
  if (!data?.ok || !Array.isArray(data.favoritos)) return false;
  return data.favoritos.some((f) => String(f.propiedad?._id) === String(propiedadId));
};

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

const cargarPropiedad = async () => {
  const contenido = document.getElementById('propiedad-contenido');
  const data = await api.get(`/propiedades/${id}`);

  if (!data.ok) {
    contenido.innerHTML = `
      <div style="text-align:center;padding:100px 24px">
        <div style="font-size:64px;margin-bottom:24px">🏚️</div>
        <h2 style="margin-bottom:12px">Propiedad no encontrada</h2>
        <p style="color:var(--text-light);margin-bottom:24px">Esta propiedad no está disponible.</p>
        <a href="catalogo.html" class="btn btn-primary">Ver catálogo</a>
      </div>`;
    return;
  }

  const p = data.propiedad;
  document.title = `${p.titulo} — Vive Más Inmobiliaria`;

  const galeriaHTML = p.fotos && p.fotos.length > 0
    ? `<div class="propiedad-galeria">
        <div class="galeria-main"><img src="${p.fotos[0]}" alt="${p.titulo}"></div>
        ${p.fotos[1] ? `<div class="galeria-thumb"><img src="${p.fotos[1]}" alt="foto 2"></div>` : '<div class="galeria-thumb" style="background:var(--bg-secondary)"></div>'}
        ${p.fotos[2] ? `<div class="galeria-thumb"><img src="${p.fotos[2]}" alt="foto 3"></div>` : '<div class="galeria-thumb" style="background:var(--bg-secondary)"></div>'}
      </div>`
    : `<div class="propiedad-galeria"><div class="galeria-vacia">Sin fotografías disponibles</div></div>`;

  contenido.innerHTML = `
    <div class="container" style="padding-top:32px;padding-bottom:80px">
      <div style="margin-bottom:16px">
        <a href="catalogo.html" style="color:var(--text-light);text-decoration:none;font-size:14px">← Volver al catálogo</a>
      </div>
      ${galeriaHTML}
      <div class="propiedad-layout">
        <div class="propiedad-info">
          <div style="display:flex;gap:8px;margin-bottom:16px">
            <span class="tag tag-${p.operacion}">${p.operacion}</span>
            <span class="tag tag-${p.tipo}">${p.tipo}</span>
          </div>
          <h1 class="propiedad-info">${p.titulo}</h1>
          <div class="propiedad-ubicacion">
            📍 ${p.ubicacion.colonia ? p.ubicacion.colonia + ', ' : ''}${p.ubicacion.ciudad}, ${p.ubicacion.estado}
            ${p.ubicacion.direccion ? ' · ' + p.ubicacion.direccion : ''}
          </div>
          <div class="propiedad-precio-grande">${formatPrecio(p.precio)}</div>
          <div class="propiedad-operacion">Precio de ${p.operacion === 'renta' ? 'renta mensual' : 'venta'}</div>
          <label data-comparador-id="${p._id}" class="comparador-check${typeof comparadorTieneId === 'function' && comparadorTieneId(p._id) ? ' activo' : ''}" style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:6px 14px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;width:fit-content">
            <input type="checkbox" ${typeof comparadorTieneId === 'function' && comparadorTieneId(p._id) ? 'checked' : ''} onchange="comparadorToggle('${p._id}', event)" style="cursor:pointer">
            ⚖️ Agregar a comparación
          </label>

          <div class="caracteristicas-grid">
            ${p.caracteristicas.recamaras ? `<div class="caract-item"><div class="caract-valor">${p.caracteristicas.recamaras}</div><div class="caract-label">Recámaras</div></div>` : ''}
${p.caracteristicas.banos ? `<div class="caract-item"><div class="caract-valor">${p.caracteristicas.banos}</div><div class="caract-label">Baños completos</div></div>` : ''}
            ${p.caracteristicas.mediosBanos ? `<div class="caract-item"><div class="caract-valor">${p.caracteristicas.mediosBanos}</div><div class="caract-label">Medios baños</div></div>` : ''}
            ${p.caracteristicas.estacionamientos ? `<div class="caract-item"><div class="caract-valor">${p.caracteristicas.estacionamientos}</div><div class="caract-label">Estacion.</div></div>` : ''}
            ${p.caracteristicas.m2 ? `<div class="caract-item"><div class="caract-valor">${p.caracteristicas.m2}</div><div class="caract-label">m²</div></div>` : ''}
          </div>

          <div class="descripcion-titulo">Descripción</div>
          <div class="descripcion-texto">${p.descripcion}</div>

          ${p.ubicacion.lat && p.ubicacion.lng ? `
            <div class="mapa-titulo">Ubicación</div>
            <div id="mapa"></div>
            <div class="mapa-nota">🔒 Por privacidad mostramos la zona aproximada (±100 m).</div>
            <div class="mapa-acciones">
              <a class="btn btn-outline mapa-btn" href="https://www.google.com/maps?q=${p.ubicacion.lat},${p.ubicacion.lng}&z=16" target="_blank" rel="noopener">
                📍 Ver en Google Maps
              </a>
              <a class="btn btn-outline mapa-btn" href="https://waze.com/ul?ll=${p.ubicacion.lat},${p.ubicacion.lng}&navigate=no" target="_blank" rel="noopener">
                🧭 Ver en Waze
              </a>
            </div>
          ` : ''}
        </div>

        <div>
          <div class="contacto-card">
            <h3>¿Te interesa esta propiedad?</h3>
            <p style="font-size:13px;color:var(--text-light)">Contacta directamente al propietario</p>

            ${p.propietario ? `
              <div class="propietario-info">
                <div class="propietario-avatar">${p.propietario.nombre.charAt(0)}</div>
                <div>
                  <div class="propietario-nombre">${p.propietario.nombre}</div>
                  <div class="propietario-telefono">Propietario verificado ✓</div>
                </div>
              </div>
            ` : ''}

            <div id="contacto-form">
              <p style="font-size:13px;color:var(--text-light);margin-bottom:12px">
                Envía un mensaje al propietario. Tus datos están protegidos.
              </p>
              <textarea class="mensaje-input" id="mensaje-texto" placeholder="Hola, me interesa esta propiedad. ¿Podría darme más información?"></textarea>
              <button class="btn btn-primary" style="width:100%;padding:14px" onclick="enviarMensaje('${p._id}')">
                Enviar mensaje
              </button>
              <button id="btn-favorito" class="btn btn-outline" style="width:100%;padding:12px;margin-top:8px" onclick="toggleFavorito('${p._id}')">
                ❤️ Guardar en favoritos
              </button>
              <div id="favorito-login-hint" class="favorito-login-hint" aria-live="polite">
                Inicia sesión para guardar esta propiedad en favoritos.
              </div>
              <button class="btn btn-outline" style="width:100%;padding:10px;margin-top:8px;font-size:12.5px;color:#6b7280;border-color:#e5e7eb" onclick="typeof auth!=='undefined'&&auth.isLoggedIn&&auth.isLoggedIn()?mostrarModalReporte({tipo:'propiedad',propiedadId:'${p._id}'}):alert('Inicia sesión para reportar esta publicación.')">
                🚩 Reportar publicación
              </button>
              <div style="display:flex;align-items:center;gap:6px;margin-top:12px;padding:10px;background:var(--bg-secondary);border-radius:8px">
                <span style="font-size:16px">🔒</span>
                <span style="font-size:11px;color:var(--text-light)">Tus datos y los del propietario están protegidos. La comunicación es a través de Vive Más.</span>
              </div>

              ${!auth.isLoggedIn() ? `
                <p style="font-size:12px;color:var(--text-light);margin-top:10px">
                  Para guardar favoritos y contactar propietarios necesitas una cuenta.
                </p>
                <a href="#" onclick="localStorage.setItem('redireccion_favorito', window.location.href); window.location.href='login.html'; return false;" class="btn btn-outline" style="width:100%;padding:10px;margin-top:8px;text-align:center;display:block">Iniciar sesión</a>
              ` : ''}
            </div>
            <div id="contacto-msg" style="display:none;margin-top:12px"></div>
          </div>
        </div>
      </div>
    </div>`;

  if (auth.isLoggedIn()) {
    favoritoActivo = await revisarFavorito(p._id);
    actualizarBotonFavorito();
  }

  if (p.ubicacion.lat && p.ubicacion.lng) {
    setTimeout(() => {
const lat = Number(p.ubicacion.lat);
      const lng = Number(p.ubicacion.lng);
      const mapa = L.map('mapa').setView([lat, lng], 15);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(mapa);

      // Por privacidad NO se muestra el punto exacto: solo un área aproximada de ±100 m
      L.circle([lat, lng], {
        radius: 100,
        color: 'var(--primary, #1a472a)',
        weight: 2,
        fillColor: 'var(--primary, #1a472a)',
        fillOpacity: 0.12
      }).addTo(mapa).bindPopup(`${p.titulo} — zona aproximada (±100 m)`);

      // Ajustar el zoom para que se vea el área de 100 m sin revelar el punto exacto
      setTimeout(() => {
        try { mapa.setZoom(16); } catch (e) {}
      }, 50);
    }, 100);
  }
};

const enviarMensaje = async (propiedadId) => {
  if (!auth.isLoggedIn()) {
    mostrarMsg('<div class="alert alert-error">Necesitas iniciar sesión para enviar mensajes.</div>');
    return;
  }

  const texto = document.getElementById('mensaje-texto')?.value?.trim() || '';
  if (!texto) {
    mostrarMsg('<div class="alert alert-error">Escribe un mensaje</div>');
    return;
  }

  const data = await api.post(`/mensajes/${propiedadId}`, { mensaje: texto });

  if (data.ok) {
    mostrarMsg('<div class="alert alert-success">¡Mensaje enviado! El propietario te contactará pronto.</div>');
    const txt = document.getElementById('mensaje-texto');
    if (txt) txt.value = '';
  } else {
    mostrarMsg(`<div class="alert alert-error">${data.error || 'Error al enviar'}</div>`);
  }
};

const toggleFavorito = async (propiedadId) => {
  if (!auth.isLoggedIn()) {
    const btn = document.getElementById('btn-favorito');
    const hint = document.getElementById('favorito-login-hint');
    if (btn) {
      btn.title = 'Primero inicia sesión para guardar favoritos';
      btn.classList.remove('favorito-shake');
      void btn.offsetWidth;
      btn.classList.add('favorito-shake');
    }
    if (hint) {
      hint.classList.add('is-visible');
      clearTimeout(Number(hint.dataset.timeoutId || 0));
      hint.dataset.timeoutId = String(setTimeout(() => {
        hint.classList.remove('is-visible');
      }, 4500));
    }
    mostrarMsg('<div class="alert alert-error">💡 Primero inicia sesión para guardar favoritos.</div>');
    return;
  }

  let data;
  if (favoritoActivo) {
    data = await api.delete(`/favoritos/${propiedadId}`);
    if (data.ok) {
      favoritoActivo = false;
      actualizarBotonFavorito();
      mostrarMsg('<div class="alert alert-success">Eliminado de favoritos.</div>');
    } else {
      mostrarMsg(`<div class="alert alert-error">${data.error || 'No se pudo eliminar de favoritos'}</div>`);
    }
    return;
  }

  data = await api.post(`/favoritos/${propiedadId}`, {});
  if (data.ok) {
    favoritoActivo = true;
    actualizarBotonFavorito();
    mostrarMsg('<div class="alert alert-success">❤️ Agregado a favoritos</div>');
  } else if (data.error === 'Ya está en tus favoritos') {
    favoritoActivo = true;
    actualizarBotonFavorito();
    mostrarMsg('<div class="alert alert-success">Esta propiedad ya estaba en tus favoritos.</div>');
  } else {
    mostrarMsg(`<div class="alert alert-error">${data.error || 'Error al guardar favorito'}</div>`);
  }
};