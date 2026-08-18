const Property = require('../models/Property');

// Ruta dinámica: /renta/departamentos/cdmx/polanco
exports.showDynamicSEOPage = async (req, res) => {
  try {
    // Limpiar parámetros de la URL
    const operacion = req.params.operacion.toLowerCase(); // renta o venta
    const tipo = req.params.tipo.toLowerCase(); // departamentos, casas, etc
    const estado = req.params.estado ? req.params.estado.toLowerCase() : null; // cdmx
    const ciudad = req.params.ciudad ? req.params.ciudad.toLowerCase() : null; // polanco

    // Mapear tipos para buscar en BD
    const tipoMap = { 'departamentos': 'departamento', 'casas': 'casa', 'terrenos': 'terreno', 'locales': 'local' };
    const tipoBD = tipoMap[tipo] || tipo;

    // Construir filtro
    let filter = { 
      type: operacion, 
      propertyType: tipoBD, 
      status: 'aprobada' // Asumo que tus propiedades tienen un status
    };
    
    if (ciudad) filter.location = { $regex: new RegExp(ciudad, 'i') };
    else if (estado) filter.city = { $regex: new RegExp(estado, 'i') };

    const propiedades = await Property.find(filter).sort({ createdAt: -1 }).limit(50);
    
    const tituloCapitalizado = (str) => str.charAt(0).toUpperCase() + str.slice(1);
    const fullLocation = [ciudad, estado].filter(Boolean).map(tituloCapitalizado).join(', ') || 'México';

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>${tituloCapitalizado(operacion)} de ${tituloCapitalizado(tipo)} en ${fullLocation} - SomosViveMás</title>
        <meta name="description" content="Encuentra ${tituloCapitalizado(tipo)} en ${tituloCapitalizado(operacion)} en ${fullLocation}. Las mejores propiedades verificadas en SomosViveMás.">
        <!-- PEGA AQUÍ TUS CSS O EL HEADER DE TU PÁGINA PÚBLICA -->
        <style>
            body { font-family: 'Inter', sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px; }
            .container { max-width: 1200px; margin: 0 auto; }
            h1 { color: #111827; font-size: 28px; margin-bottom: 10px; }
            p.desc { color: #6b7280; font-size: 16px; margin-bottom: 30px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
            .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e5e7eb; }
            .card img { width: 100%; height: 200px; object-fit: cover; }
            .card-body { padding: 16px; }
            .price { font-size: 20px; font-weight: 700; color: #059669; }
            .loc { font-size: 14px; color: #6b7280; margin-top: 4px; }
            .btn { display: inline-block; margin-top: 12px; padding: 8px 16px; background: #111827; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>${tituloCapitalizado(operacion)} de ${tituloCapitalizado(tipo)} en ${fullLocation}</h1>
            <p class="desc">Descubre las mejores opciones de ${tituloCapitalizado(tipo)} disponibles en ${fullLocation}. Propiedades verificadas y actualizadas diariamente.</p>
            
            <div class="grid">
                ${propiedades.length === 0 ? '<p>No hay propiedades disponibles en esta zona aún.</p>' : ''}
                ${propiedades.map(p => `
                    <div class="card">
                        <img src="${p.imageUrl || 'https://via.placeholder.com/400x200?text=Sin+Imagen'}" alt="${p.location}">
                        <div class="card-body">
                            <div class="price">$${Number(p.price).toLocaleString('es-MX')} MXN</div>
                            <div class="loc">📍 ${p.location}</div>
                            <a href="/p/${p.slug}" class="btn">Ver Detalles</a>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        <!-- PEGA AQUÍ EL FOOTER DE TU PÁGINA PÚBLICA -->
    </body>
    </html>`;
    
    res.send(html);
  } catch (error) {
    res.status(500).send('Error al cargar la página');
  }
};