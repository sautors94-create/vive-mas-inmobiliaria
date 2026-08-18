const Property = require('../models/Property');

exports.create = async (req, res) => {
  try {
    const prop = new Property(req.body);
    await prop.save();
    // Cambia 'somosvivemas.com' por tu dominio real cuando lo subas a producción
    res.status(201).json({ 
      message: 'Propiedad guardada', 
      slug: prop.slug,
      url: `https://somosvivemas.com/p/${prop.slug}` 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.showPublicPage = async (req, res) => {
  try {
    const prop = await Property.findOne({ slug: req.params.slug }).populate('agentId');
    if (!prop) return res.status(404).send('Propiedad no encontrada');

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>${prop.type === 'renta' ? 'Renta' : 'Venta'} de ${prop.propertyType} en ${prop.location}</title>
        <meta property="og:title" content="${prop.propertyType} en ${prop.location} - $${prop.price}" />
        <meta property="og:description" content="🛏 ${prop.rooms} Recámaras. Visita SomosViveMás." />
        <meta property="og:image" content="${prop.imageUrl}" />
        <meta property="og:url" content="https://somosvivemas.com/p/${prop.slug}" />
        <style>body{font-family:Arial;margin:0;background:#f4f4f4;display:flex;justify-content:center;padding:20px}.container{max-width:600px;background:#fff;border-radius:10px;box-shadow:0 4px 10px rgba(0,0,0,.1);overflow:hidden}img{width:100%;height:300px;object-fit:cover}.details{padding:20px}.price{font-size:2em;color:#00FF88;font-weight:bold;margin:0}.location{color:#666;font-size:1.2em;margin-bottom:20px}.specs{display:flex;gap:15px;color:#333;margin-bottom:30px}.btn{display:block;width:100%;padding:15px;background:#25D366;color:#fff;text-align:center;text-decoration:none;font-weight:bold;border-radius:5px}.agent{margin-top:20px;padding-top:20px;border-top:1px solid #eee;font-size:.9em;color:#666}</style>
    </head>
    <body>
        <div class="container">
            <img src="${prop.imageUrl}" alt="${prop.propertyType}">
            <div class="details">
                <h1 class="price">$${prop.price} ${prop.type === 'renta' ? 'MXN/mes' : 'MXN'}</h1>
                <p class="location">📍 ${prop.location}</p>
                <div class="specs"><span>🛏 ${prop.rooms} Recámaras</span><span>🚿 ${prop.baths} Baños</span></div>
                <a href="https://wa.me/52${prop.agentId?.phone || ''}?text=Hola, vi la propiedad en ${prop.location} en SomosViveMas" class="btn">Contactar por WhatsApp</a>
                <div class="agent">Publicado por: <strong>${prop.agentId?.name || 'SomosViveMás'}</strong></div>
            </div>
        </div>
    </body>
    </html>`;
    res.send(html);
  } catch (error) {
    res.status(500).send('Error del servidor');
  }
};