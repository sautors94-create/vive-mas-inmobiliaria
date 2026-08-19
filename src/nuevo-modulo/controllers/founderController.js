const Property = require('../../models/Property');
const Founder = require('../models/Founder');
const FichaRapida = require('../models/FichaRapida');
const { generatePropertyCard } = require('../services/imageGenerator');

// 1. Registro rápido de Agente Fundador (sin login, un solo paso)
exports.register = async (req, res) => {
  try {
    const { name, phone, city, referredBy } = req.body;

    if (!name || !phone || !city) {
      return res.status(400).json({ error: 'Nombre, WhatsApp y ciudad son obligatorios' });
    }

    const phoneLimpio = String(phone).replace(/\D/g, '');
    if (phoneLimpio.length < 10) {
      return res.status(400).json({ error: 'Número de WhatsApp inválido' });
    }

    const existente = await Founder.findOne({ phone: phoneLimpio });
    if (existente) {
      return res.json({
        message: 'Ya estabas registrado, bienvenido de nuevo',
        data: { referralCode: existente.referralCode },
      });
    }

    const founder = new Founder({
      name,
      phone: phoneLimpio,
      city,
      referredBy: referredBy || null,
    });
    await founder.save();

    // Si quien lo invitó existe, le suma 1 a su conteo de referidos y
    // recalcula su nivel de Embajador (5/10/25 -> Embajador/Oro/Élite)
    if (referredBy) {
      const referente = await Founder.findOne({ referralCode: referredBy });
      if (referente) {
        referente.referralsCount = (referente.referralsCount || 0) + 1;
        await referente.save(); // dispara el pre('save') que recalcula ambassadorTitle
      }
    }

    res.status(201).json({
      message: 'Registrado como Agente Fundador',
      data: { referralCode: founder.referralCode },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Este teléfono ya está registrado' });
    }
    res.status(500).json({ error: error.message });
  }
};

// 2. Estado del panel del Agente (Vistas, Links, Rango) por su código de referido
exports.getAgentPanelData = async (req, res) => {
  try {
    const founder = await Founder.findOne({ referralCode: req.params.referralCode });
    if (!founder) return res.status(404).json({ isFounder: false });

    res.json({
      isFounder: true,
      name: founder.name,
      rank: founder.rank,
      rankTitle: founder.rankTitle,
      propertiesCount: founder.propertiesCount,
      profileViews: founder.profileViews,
      referralsCount: founder.referralsCount,
      ambassadorTitle: founder.ambassadorTitle,
      referralLink: `${req.protocol}://${req.get('host')}/agente/${founder.referralCode}`,
      ambassadorLink: `${req.protocol}://${req.get('host')}/agentes-fundadores?ref=${founder.referralCode}`,
      nextRankProps: founder.rank === 1 ? 5 : founder.rank === 2 ? 12 : founder.rank === 3 ? 19 : founder.rank === 4 ? 26 : null,
      nextAmbassadorRefs: founder.referralsCount < 5 ? 5 : founder.referralsCount < 10 ? 10 : founder.referralsCount < 25 ? 25 : null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Registrar vista en el perfil público del agente
exports.trackProfileView = async (req, res) => {
  try {
    const founder = await Founder.findOneAndUpdate(
      { referralCode: req.params.referralCode },
      { $inc: { profileViews: 1 } },
      { new: true }
    );
    if (!founder) return res.status(404).send('Agente no encontrado');
    res.json({ views: founder.profileViews });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Generar la ficha/imagen para compartir + guardar la ficha rápida
//    (identifica al agente por su referralCode, no por sesión/login)
exports.generateCard = async (req, res) => {
  try {
    const { referralCode, price, rooms, baths, location, imageUrl, type } = req.body;

    const founder = await Founder.findOne({ referralCode });
    if (!founder) return res.status(403).json({ error: 'Agente Fundador no encontrado. Regístrate primero.' });

    let filePath = null;
    if (req.file) filePath = req.file.path;

    const cardData = {
      price: price || 0,
      rooms: rooms || 0,
      baths: baths || 0,
      location: location || founder.city,
      imageUrl: imageUrl || null,
    };

    const imageBuffer = await generatePropertyCard(cardData, filePath);

    // Guardamos la ficha rápida y subimos el contador de propiedades del agente (para su rango)
    const ficha = new FichaRapida({
      founder: founder._id,
      operacion: type === 'venta' ? 'venta' : 'renta',
      precio: Number(price) || 0,
      recamaras: Number(rooms) || 0,
      banos: Number(baths) || 0,
      ubicacion: location || founder.city,
      imagenUrl: imageUrl || null,
    });
    await ficha.save();

    founder.propertiesCount += 1;
    await founder.save();

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': 'attachment; filename=ficha-somosvivemas.png',
      'X-Ficha-Url': `${req.protocol}://${req.get('host')}/ficha/${ficha.slug}`,
    });
    res.send(imageBuffer);
  } catch (error) {
    console.error('Error en generateCard:', error);
    res.status(500).json({ error: 'Error al generar imagen' });
  }
};

// 7. Perfil público del agente (SSR, para compartir el link y que Google lo indexe)
exports.getPublicProfile = async (req, res) => {
  try {
    const founder = await Founder.findOneAndUpdate(
      { referralCode: req.params.referralCode },
      { $inc: { profileViews: 1 } },
      { new: true }
    );
    if (!founder) return res.status(404).send('Agente no encontrado');

    const fichas = await FichaRapida.find({ founder: founder._id }).sort({ createdAt: -1 }).limit(12).lean();
    const whatsappLink = `https://wa.me/52${founder.phone}?text=${encodeURIComponent('Hola ' + founder.name + ', vi tu perfil en SomosViveMás')}`;

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${founder.name} - Asesor Inmobiliario en ${founder.city} | SomosViveMás</title>
        <meta name="description" content="${founder.name}, asesor inmobiliario en ${founder.city}. ${founder.propertiesCount} propiedades publicadas. Contacta directo por WhatsApp.">
        <meta property="og:title" content="${founder.name} - Asesor Inmobiliario en ${founder.city}">
        <meta property="og:description" content="${founder.propertiesCount} propiedades publicadas · Rango ${founder.rankTitle}${founder.ambassadorTitle ? ' · ' + founder.ambassadorTitle : ''}">
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    </head>
    <body class="bg-light">
        <div class="container py-5">
            <div class="row justify-content-center">
                <div class="col-md-7">
                    <div class="card shadow-sm mb-4">
                        <div class="card-body text-center py-4">
                            <div class="display-1 mb-2">🏅</div>
                            <h2 class="mb-0">${founder.name}</h2>
                            <p class="text-muted mb-2">📍 ${founder.city}</p>
                            <span class="badge bg-warning text-dark me-1">${founder.rankTitle}</span>
                            ${founder.ambassadorTitle ? `<span class="badge bg-success">${founder.ambassadorTitle}</span>` : ''}
                            <div class="row mt-4">
                                <div class="col-6 border-end">
                                    <h4 class="mb-0">${founder.propertiesCount}</h4>
                                    <small class="text-muted">Propiedades</small>
                                </div>
                                <div class="col-6">
                                    <h4 class="mb-0">${founder.profileViews}</h4>
                                    <small class="text-muted">Vistas de perfil</small>
                                </div>
                            </div>
                            <a href="${whatsappLink}" class="btn btn-success w-100 mt-4 fw-bold">💬 Contactar por WhatsApp</a>
                        </div>
                    </div>

                    ${fichas.length > 0 ? `
                    <h5 class="mb-3">Propiedades recientes de ${founder.name}</h5>
                    <div class="row g-3">
                        ${fichas.map(f => `
                            <div class="col-6">
                                <div class="card h-100">
                                    <img src="${f.imagenUrl || 'https://via.placeholder.com/300x180?text=Sin+Imagen'}" class="card-img-top" style="height:140px;object-fit:cover">
                                    <div class="card-body p-2">
                                        <div class="fw-bold text-success">$${Number(f.precio).toLocaleString('es-MX')}</div>
                                        <div class="small text-muted">📍 ${f.ubicacion}</div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>` : ''}

                    <div class="text-center mt-4">
                        <a href="/agentes-fundadores?ref=${founder.referralCode}" class="text-decoration-none small text-muted">¿Eres asesor? Publica gratis en SomosViveMás →</a>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>`;
    res.send(html);
  } catch (error) {
    console.error('Error en getPublicProfile:', error);
    res.status(500).send('Error del servidor');
  }
};
exports.getAdminList = async (req, res) => {
  try {
    const agents = await Founder.find().sort({ createdAt: -1 });
    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 6. Datos para el "Tablero de Guerra"
exports.getDashboardData = async (req, res) => {
  try {
    const totalAgents = await Founder.countDocuments();
    const totalProperties = await Property.countDocuments();
    const recentAgents = await Founder.find().sort({ createdAt: -1 }).limit(5).select('name city createdAt rank rankTitle');
    res.json({ totalAgents, totalProperties, recentAgents });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
