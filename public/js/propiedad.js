const params = new URLSearchParams(window.location.search);
const id = params.get('id');

if (!id) window.location.href = 'catalogo.html';

document.addEventListener('DOMContentLoaded', async () => {
  actualizarNavbar();
  await cargarPropiedad();
});

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

          <div class="caracteristicas-grid">
            ${p.caracteristicas.recamaras ? `<div class="caract-item"><div class="caract-valor">${p.caracteristicas.recamaras}</div><div class="caract-label">Recámaras</div></div>` : ''}
            ${p.caracteristicas.banos ? `<div class="caract-item"><div class="caract-valor">${p.caracteristicas.banos}</div><div class="caract-label">Baños</div></div>` : ''}
            ${p.caracteristicas.estacionamientos ? `<div class="caract-item"><div class="caract-valor">${p.caracteristicas.estacionamientos}</div><div class="caract-label">Estacion.</div></div>` : ''}
            ${p.caracteristicas.m2 ? `<div class="caract-item"><div class="caract-valor">${p.caracteristicas.m2}</div><div class="caract-label">m²</div></div>` : ''}
          </div>

          <div class="descripcion-titulo">Descripción</div>
          <div class="descripcion-texto">${p.descripcion}</div>

          ${p.ubicacion.lat && p.ubicacion.lng ? `
            <div class="mapa-titulo">Ubicación</div>
            <div id="mapa"></div>
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
                  ${p.propietario.telefono ? `<div class="propietario-telefono">📞 ${p.propietario.telefono}</div>` : ''}
                </div>
              </div>
            ` : ''}

            <div id="contacto-form">
              ${auth.isLoggedIn() ? `
                <textarea class="mensaje-input" id="mensaje-texto" placeholder="Hola, me interesa esta propiedad. ¿Podría darme más información?"></textarea>
                <button class="btn btn-primary" style="width:100%;padding:14px" onclick="enviarMensaje('${p._id}')">Enviar mensaje</button>
                <button class="btn btn-outline" style="width:100%;padding:12px;margin-top:8px" onclick="agregarFavorito('${p._id}')">❤️ Guardar en favoritos</button>
              ` : `
                <p style="font-size:13px;color:var(--text-light);margin-bottom:16px">Inicia sesión para contactar al propietario</p>
                <a href="login.html" class="btn btn-primary" style="width:100%;padding:14px;text-align:center;display:block">Iniciar sesión</a>
                <a href="registro.html" class="btn btn-outline" style="width:100%;padding:12px;margin-top:8px;text-align:center;display:block">Crear cuenta gratis</a>
              `}
            </div>
            <div id="contacto-msg" style="display:none;margin-top:12px"></div>
          </div>
        </div>
      </div>
    </div>`;

  if (p.ubicacion.lat && p.ubicacion.lng) {
    setTimeout(() => {
      const mapa = L.map('mapa').setView([p.ubicacion.lat, p.ubicacion.lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);
      L.marker([p.ubicacion.lat, p.ubicacion.lng])
        .addTo(mapa)
        .bindPopup(p.titulo)
        .openPopup();
    }, 100);
  }
};

const enviarMensaje = async (propiedadId) => {
  const texto = document.getElementById('mensaje-texto').value.trim();
  const msgEl = document.getElementById('contacto-msg');

  if (!texto) {
    msgEl.innerHTML = '<div class="alert alert-error">Escribe un mensaje</div>';
    msgEl.style.display = 'block';
    return;
  }

  const data = await api.post(`/mensajes/${propiedadId}`, { mensaje: texto });

  if (data.ok) {
    msgEl.innerHTML = '<div class="alert alert-success">¡Mensaje enviado! El propietario te contactará pronto.</div>';
    msgEl.style.display = 'block';
    document.getElementById('mensaje-texto').value = '';
  } else {
    msgEl.innerHTML = `<div class="alert alert-error">${data.error || 'Error al enviar'}</div>`;
    msgEl.style.display = 'block';
  }
};

const agregarFavorito = async (propiedadId) => {
  const msgEl = document.getElementById('contacto-msg');
  const data = await api.post(`/favoritos/${propiedadId}`, {});

  if (data.ok) {
    msgEl.innerHTML = '<div class="alert alert-success">¡Agregado a favoritos!</div>';
  } else {
    msgEl.innerHTML = `<div class="alert alert-error">${data.error || 'Error'}</div>`;
  }
  msgEl.style.display = 'block';
};