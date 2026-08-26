const Property = require('../../models/Property');
const User = require('../../models/User');
const Founder = require('../models/Founder');
const FichaRapida = require('../models/FichaRapida');
const { generatePropertyCard } = require('../services/imageGenerator');

// Arma la respuesta de estadísticas que usan tanto el panel público (por
// referralCode) como el panel del usuario logueado (por su sesión).
function buildPanelPayload(req, founder) {
  return {
    isFounder: true,
    name: founder.name,
    rank: founder.rank,
    rankTitle: founder.rankTitle,
    propertiesCount: founder.propertiesCount,
    profileViews: founder.profileViews,
    referralsCount: founder.referralsCount,
    ambassadorTitle: founder.ambassadorTitle,
    referredBy: founder.referredBy,
    social: founder.social,
    referralCode: founder.referralCode,
    referralLink: `${req.protocol}://${req.get('host')}/agente/${founder.referralCode}`,
    ambassadorLink: `${req.protocol}://${req.get('host')}/agentes-fundadores?ref=${founder.referralCode}`,
    nextRankProps: founder.rank === 1 ? 5 : founder.rank === 2 ? 12 : founder.rank === 3 ? 19 : founder.rank === 4 ? 26 : null,
    nextAmbassadorRefs: founder.referralsCount < 5 ? 5 : founder.referralsCount < 10 ? 10 : founder.referralsCount < 25 ? 25 : null,
  };
}

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

    const cardData = {
      price: price || 0,
      rooms: rooms || 0,
      baths: baths || 0,
      location: location || founder.city,
      imageUrl: imageUrl || null,
    };

    const imageBuffer = await generatePropertyCard(cardData, req.file ? req.file.buffer : null);

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

// 8. Obtener (o crear) el Founder ligado al usuario logueado — para la
//    sección "Programa de Embajadores" dentro del dashboard real (con sesión)
// 8a. Solo CONSULTA si el usuario logueado ya es Founder — NUNCA crea uno.
//     Se usa al abrir la sección (sidebar) para decidir si mostrar la
//     pantalla de inscripción o el dashboard. Antes esto lo hacía
//     getOrCreateMine, que auto-registraba a cualquiera con solo abrir la
//     sección — bug real reportado por el usuario.
exports.getMineStatus = async (req, res) => {
  try {
    const founder = await Founder.findOne({ userId: req.user.id });
    if (!founder) return res.json({ isFounder: false });
    res.json(buildPanelPayload(req, founder));
  } catch (error) {
    console.error('Error en getMineStatus:', error);
    res.status(500).json({ error: error.message });
  }
};

// 8b. Inscribe de verdad al usuario logueado (crea su Founder si no existe).
//     Solo se llama cuando el usuario da clic explícito en "Inscribirme".
exports.registerMine = async (req, res) => {
  try {
    let founder = await Founder.findOne({ userId: req.user.id });
    if (founder) return res.json(buildPanelPayload(req, founder)); // ya estaba inscrito

    const user = await User.findById(req.user.id).select('nombre telefono direccion.ciudad');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (!user.telefono) {
      // Sin teléfono no podemos generar su enlace de WhatsApp ni fichas.
      return res.json({ isFounder: false, needsPhone: true });
    }

    const existentePorTelefono = await Founder.findOne({ phone: user.telefono });
    if (existentePorTelefono && !existentePorTelefono.userId) {
      // Ya se había registrado antes desde el flujo público con este mismo teléfono: lo ligamos.
      existentePorTelefono.userId = user._id;
      founder = await existentePorTelefono.save();
    } else if (!existentePorTelefono) {
      founder = await new Founder({
        userId: user._id,
        name: user.nombre,
        phone: user.telefono,
        city: user.direccion?.ciudad || 'CDMX',
      }).save();
    } else {
      founder = existentePorTelefono; // Ya ligado a otro usuario (caso raro), lo devolvemos tal cual
    }

    res.json(buildPanelPayload(req, founder));
  } catch (error) {
    console.error('Error en registerMine:', error);
    res.status(500).json({ error: error.message });
  }
};

// 9. Registrar el código de quien invitó al usuario logueado (una sola vez)
exports.setReferrer = async (req, res) => {
  try {
    const { referralCode } = req.body;
    if (!referralCode) return res.status(400).json({ error: 'Falta el código de referido' });

    const founder = await Founder.findOne({ userId: req.user.id });
    if (!founder) return res.status(404).json({ error: 'Primero inscríbete al programa' });
    if (founder.referredBy) return res.status(409).json({ error: 'Ya registraste tu código de referido antes, no se puede cambiar' });

    if (referralCode === founder.referralCode) {
      return res.status(400).json({ error: 'No puedes usar tu propio código' });
    }

    const referente = await Founder.findOne({ referralCode });
    if (!referente) return res.status(404).json({ error: 'Ese código de embajador no existe' });

    founder.referredBy = referralCode;
    await founder.save();

    referente.referralsCount = (referente.referralsCount || 0) + 1;
    await referente.save();

    res.json(buildPanelPayload(req, founder));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 10. Guardar redes sociales del agente logueado
exports.updateSocial = async (req, res) => {
  try {
    const { facebook, instagram, website } = req.body;
    const founder = await Founder.findOneAndUpdate(
      { userId: req.user.id },
      { social: { facebook: facebook || '', instagram: instagram || '', website: website || '' } },
      { new: true }
    );
    if (!founder) return res.status(404).json({ error: 'Primero inscríbete al programa' });
    res.json({ social: founder.social });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 11. Generar ficha para el agente logueado (misma lógica que generateCard,
//     pero identificando al agente por sesión en vez de por referralCode en el body)
exports.generateCardMine = async (req, res) => {
  try {
    const founder = await Founder.findOne({ userId: req.user.id });
    if (!founder) return res.status(404).json({ error: 'Primero inscríbete al programa de Embajadores' });

    const { price, rooms, baths, location, imageUrl, type } = req.body;

    const cardData = {
      price: price || 0,
      rooms: rooms || 0,
      baths: baths || 0,
      location: location || founder.city,
      imageUrl: imageUrl || null,
    };

    const imageBuffer = await generatePropertyCard(cardData, req.file ? req.file.buffer : null);

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
    console.error('Error en generateCardMine:', error);
    res.status(500).json({ error: 'Error al generar imagen' });
  }
};

// 5. Listado para el admin
exports.getAdminList = async (req, res) => {
  try {
    // populate trae el email y el plan reales del usuario ligado (cuando lo
    // hay — un agente reclutado externamente vía el flujo público, sin
    // cuenta en la plataforma, no tiene userId y esos campos quedan vacíos)
    const agents = await Founder.find()
      .sort({ createdAt: -1 })
      .populate('userId', 'email plan')
      .lean();

    const agentsConDatos = agents.map((a) => ({
      ...a,
      email: a.userId?.email || null,
      plan: a.userId?.plan || null,
    }));

    res.json(agentsConDatos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Elimina a un Agente Fundador (le quita su rango/progreso). No borra al
// usuario de la plataforma si tenía cuenta — solo su registro de Founder.
exports.eliminarFundador = async (req, res) => {
  try {
    const founder = await Founder.findByIdAndDelete(req.params.id);
    if (!founder) return res.status(404).json({ error: 'Agente Fundador no encontrado' });
    res.json({ ok: true, mensaje: 'Agente Fundador eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 6. Datos para el "Tablero de Guerra"
exports.getDashboardData = async (req, res) => {
  try {
    const totalAgents = await Founder.countDocuments();
    const totalProperties = await Property.countDocuments();
    const totalFichas = await FichaRapida.countDocuments();
    const totalReferrals = await Founder.countDocuments({ referredBy: { $ne: null } });
    const linkedToRealUsers = await Founder.countDocuments({ userId: { $ne: null } });

    const recentAgents = await Founder.find().sort({ createdAt: -1 }).limit(5).select('name city createdAt rank rankTitle referralsCount ambassadorTitle');

    const porRango = await Founder.aggregate([
      { $group: { _id: '$rankTitle', total: { $sum: 1 } } },
    ]);

    const porNivelEmbajador = await Founder.aggregate([
      { $match: { ambassadorTitle: { $ne: null } } },
      { $group: { _id: '$ambassadorTitle', total: { $sum: 1 } } },
    ]);

    const topAgentesPorPropiedades = await Founder.find().sort({ propertiesCount: -1 }).limit(10).select('name city propertiesCount rankTitle');
    const topEmbajadoresPorReferidos = await Founder.find({ referralsCount: { $gt: 0 } }).sort({ referralsCount: -1 }).limit(10).select('name city referralsCount ambassadorTitle');

    // Ciudades con más agentes (para saber dónde ya tenemos densidad, del plan original)
    const porCiudad = await Founder.aggregate([
      { $group: { _id: '$city', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      totalAgents,
      totalProperties,
      totalFichas,
      totalReferrals,
      linkedToRealUsers,
      recentAgents,
      porRango,
      porNivelEmbajador,
      topAgentesPorPropiedades,
      topEmbajadoresPorReferidos,
      porCiudad,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
