const Property = require('../../models/Property');

// Página pública SSR de una propiedad real, con meta og: para que se vea
// bien al compartir el link por WhatsApp/Facebook (algo que el SPA normal
// no puede hacer porque renderiza con JS del lado del cliente).
// La creación de propiedades sigue existiendo SOLO por el flujo real
// (crearPropiedad en property.controller.js), con moderación y límites de
// plan — este controlador es de solo lectura.
exports.showPublicPage = async (req, res) => {
  try {
    const prop = await Property.findOne({ slug: req.params.slug, status: 'aprobada' })
      .populate('propietario', 'nombre telefono')
      .lean();

    if (!prop) return res.status(404).send('Propiedad no encontrada');

    const foto = (prop.fotos && prop.fotos[0]) || 'https://via.placeholder.com/600x300?text=Sin+Imagen';
    const ubicacionTexto = [prop.ubicacion?.colonia, prop.ubicacion?.ciudad, prop.ubicacion?.estado].filter(Boolean).join(', ');
    const telefonoAgente = (prop.propietario?.telefono || '').replace(/\D/g, '');

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>${prop.operacion === 'renta' ? 'Renta' : 'Venta'} de ${prop.tipo} en ${ubicacionTexto}</title>
        <meta property="og:title" content="${prop.tipo} en ${ubicacionTexto} - $${Number(prop.precio).toLocaleString('es-MX')}" />
        <meta property="og:description" content="🛏 ${prop.caracteristicas?.recamaras || 0} Recámaras. Visita SomosViveMás." />
        <meta property="og:image" content="${foto}" />
        <meta property="og:url" content="https://somosvivemas.com/p/${prop.slug}" />
        <style>body{font-family:Arial;margin:0;background:#f4f4f4;display:flex;justify-content:center;padding:20px}.container{max-width:600px;background:#fff;border-radius:10px;box-shadow:0 4px 10px rgba(0,0,0,.1);overflow:hidden}img{width:100%;height:300px;object-fit:cover}.details{padding:20px}.price{font-size:2em;color:#059669;font-weight:bold;margin:0}.location{color:#666;font-size:1.2em;margin-bottom:20px}.specs{display:flex;gap:15px;color:#333;margin-bottom:30px}.btn{display:block;width:100%;padding:15px;background:#25D366;color:#fff;text-align:center;text-decoration:none;font-weight:bold;border-radius:5px}.agent{margin-top:20px;padding-top:20px;border-top:1px solid #eee;font-size:.9em;color:#666}</style>
    </head>
    <body>
        <div class="container">
            <img src="${foto}" alt="${prop.tipo}">
            <div class="details">
                <h1 class="price">$${Number(prop.precio).toLocaleString('es-MX')} ${prop.operacion === 'renta' ? 'MXN/mes' : 'MXN'}</h1>
                <p class="location">📍 ${ubicacionTexto}</p>
                <div class="specs"><span>🛏 ${prop.caracteristicas?.recamaras || 0} Recámaras</span><span>🚿 ${prop.caracteristicas?.banos || 0} Baños</span></div>
                <a href="https://wa.me/52${telefonoAgente}?text=${encodeURIComponent('Hola, vi la propiedad en ' + ubicacionTexto + ' en SomosViveMás')}" class="btn">Contactar por WhatsApp</a>
                <div class="agent">Publicado por: <strong>${prop.propietario?.nombre || 'SomosViveMás'}</strong></div>
            </div>
        </div>
    </body>
    </html>`;
    res.send(html);
  } catch (error) {
    console.error('Error en showPublicPage:', error);
    res.status(500).send('Error del servidor');
  }
};
