const Property = require('../../models/Property');
const User = require('../../models/User');
const Founder = require('../models/Founder');
const FichaRapida = require('../models/FichaRapida');
const { generatePropertyCard } = require('../services/imageGenerator');

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
    socialVisible: founder.socialVisible !== false, // AGREGAR
    profilePhoto: founder.profilePhoto || '',      // AGREGAR
    referralCode: founder.referralCode,
    referralLink: `${req.protocol}://${req.get('host')}/agente/${founder.referralCode}`,
    ambassadorLink: `${req.protocol}://${req.get('host')}/agentes-fundadores?ref=${founder.referralCode}`,
    nextRankProps: founder.rank === 1 ? 5 : founder.rank === 2 ? 12 : founder.rank === 3 ? 19 : founder.rank === 4 ? 26 : null,
    nextAmbassadorRefs: founder.referralsCount < 5 ? 5 : founder.referralsCount < 10 ? 10 : founder.referralsCount < 25 ? 25 : null,
  };
}

// 1. Registro rápido de Agente Fundador (sin login, un solo paso)
// DESACTIVADO: el registro al programa de Agentes Fundadores ya no se
// hace sin cuenta. Ahora todo agente necesita una cuenta gratuita real de
// la plataforma (ver registerMine, más abajo, y embajador-invitacion.html
// en el frontend). Se deja la función original renombrada por si en algún
// momento se necesita recuperar el histórico de cómo funcionaba, pero la
// ruta pública ya no la usa.
exports.register = async (req, res) => {
  return res.status(410).json({
    error: 'El registro directo ya no está disponible. Crea una cuenta gratuita en SomosViveMás para unirte al programa de Agentes Fundadores.',
    registroUrl: '/pages/registro.html',
  });
};

exports._registerLegacySinUsar = async (req, res) => {
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

// NUEVA FUNCIÓN: Listado para el directorio público
exports.getDirectoryList = async (req, res) => {
  try {
    const agentes = await Founder.find()
      .sort({ rank: -1, propertiesCount: -1 })
      .select('name city rankTitle ambassadorTitle propertiesCount profileViews referralCode profilePhoto');
    res.json(agentes);
  } catch (error) {
    console.error('Error en getDirectoryList:', error);
    res.status(500).json({ error: 'Error al obtener el directorio de agentes' });
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
    
    // Generar enlaces si el agente los configuró
    const whatsappLink = founder.publicWhatsapp ? `https://wa.me/52${founder.publicWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Hola ' + founder.name + ', vi tu perfil en SomosViveMás')}` : '';
    const mailtoLink = founder.publicEmail ? `mailto:${founder.publicEmail}?subject=Contacto desde SomosViveMás` : '';

    // Botones de contacto dinámicos
    let contactButtons = '';
    if (whatsappLink) {
      contactButtons += `<a href="${whatsappLink}" target="_blank" class="cta-btn cta-wa">💬 WhatsApp</a>`;
    }
    if (mailtoLink) {
      contactButtons += `<a href="${mailtoLink}" class="cta-btn cta-mail">✉️ Correo</a>`;
    }
    if (!whatsappLink && !mailtoLink) {
      contactButtons = `<div style="color: #64748b; font-size: 14px; padding: 15px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">El agente no ha habilitado métodos de contacto directo aún.</div>`;
    }

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
    <script>(function(){try{var t=JSON.parse(localStorage.getItem('vm_tema')||'{}');if(t&&t.primary){var e=document.createElement('style');e.textContent=':root{--primary:'+t.primary+' !important;--primary-light:'+t.primaryLight+' !important;--accent:'+t.accent+' !important;--accent-dark:'+t.accentDark+' !important;--bg-dark:'+t.bgDark+' !important}';document.head.appendChild(e);}}catch(e){}})();</script>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${founder.name} - Asesor Inmobiliario en ${founder.city} | SomosViveMás</title>
      <meta name="description" content="${founder.name}, asesor inmobiliario en ${founder.city}. ${founder.propertiesCount} propiedades publicadas.">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background-color: #f8fafc; color: #0f172a; }
        .nav { padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.8); backdrop-filter: blur(12px); box-shadow: 0 1px 3px rgba(0,0,0,0.05); position: sticky; top: 0; z-index: 100; }
        .logo { text-decoration: none; font-family: 'Bricolage Grotesque', sans-serif; font-size: 24px; font-weight: 800; }
        .logo-vive { color: var(--primary, #1a472a); }
        .logo-mas { color: #0f172a; }
        .nav-btn { padding: 10px 20px; background: #0f172a; color: white; border-radius: 10px; text-decoration: none; font-size: 14px; font-weight: 600; }
        
        .profile-container { max-width: 800px; margin: -30px auto 60px; padding: 0 20px; position: relative; z-index: 10; }
        .profile-card { background: white; border-radius: 24px; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #e2e8f0; }
        .profile-header { background: linear-gradient(135deg, var(--bg-dark, #0f172a) 0%, var(--primary, #1a472a) 100%); padding: 60px 40px 40px; text-align: center; position: relative; }
        .avatar-circle { width: 110px; height: 110px; border-radius: 50%; background: white; color: var(--primary, #1a472a); display: flex; align-items: center; justify-content: center; font-size: 44px; font-weight: 800; font-family: 'Bricolage Grotesque', sans-serif; margin: 0 auto 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); border: 4px solid rgba(255,255,255,0.3); }
        .profile-name { color: white; font-family: 'Bricolage Grotesque', sans-serif; font-size: 34px; font-weight: 700; margin-bottom: 8px; }
        .profile-location { color: rgba(255,255,255,0.9); font-size: 15px; }
        .badges { display: flex; justify-content: center; gap: 12px; margin-top: 20px; }
        .badge { padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; backdrop-filter: blur(10px); }
        .badge-rank { background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); }
        .badge-amb { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
        
        .profile-body { padding: 40px; }
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .stat-box { background: #f8fafc; padding: 24px; border-radius: 16px; text-align: center; border: 1px solid #e2e8f0; }
        .stat-value { font-size: 32px; font-weight: 800; font-family: 'Bricolage Grotesque', sans-serif; color: var(--primary, #1a472a); }
        .stat-label { font-size: 13px; color: #64748b; margin-top: 8px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .contact-area { display: flex; flex-direction: column; gap: 12px; }
        .cta-btn { padding: 16px; border-radius: 14px; text-decoration: none; font-weight: 700; font-size: 16px; text-align: center; transition: transform 0.2s; }
        .cta-btn:hover { transform: translateY(-2px); }
        .cta-wa { background: #22c55e; color: white; box-shadow: 0 10px 20px -5px rgba(34, 197, 94, 0.4); }
        .cta-mail { background: #f1f5f9; color: #0f172a; border: 1px solid #e2e8f0; }
        
        .section-title { font-family: 'Bricolage Grotesque', sans-serif; font-size: 24px; font-weight: 700; margin: 50px 0 20px; color: #0f172a; }
        .fichas-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }
        .ficha-card { background: white; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; transition: all 0.3s; }
        .ficha-card:hover { transform: translateY(-5px); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); border-color: var(--primary, #1a472a); }
        .ficha-img { width: 100%; height: 180px; object-fit: cover; background: #e2e8f0; }
        .ficha-body { padding: 20px; }
        .ficha-price { font-size: 20px; font-weight: 700; color: #16a34a; margin-bottom: 8px; font-family: 'Bricolage Grotesque', sans-serif; }
        .ficha-loc { font-size: 14px; color: #64748b; }
        
        .footer-link { text-align: center; margin-top: 60px; padding-bottom: 40px; }
        .footer-link a { color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500; padding: 12px 24px; border: 1px solid #e2e8f0; border-radius: 30px; }

        /* Modal Editor de Contacto */
        .edit-fab { position: fixed; bottom: 30px; right: 30px; background: var(--primary, #1a472a); color: white; width: 60px; height: 60px; border-radius: 50%; display: none; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 10px 20px rgba(0,0,0,0.2); cursor: pointer; z-index: 999; border: none; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .modal-card { background: white; border-radius: 24px; max-width: 480px; width: 100%; padding: 40px; box-shadow: 0 25px 60px rgba(0,0,0,0.3); }
        .modal-title { font-family: 'Bricolage Grotesque', sans-serif; font-size: 22px; font-weight: 700; margin-bottom: 8px; }
        .modal-desc { font-size: 14px; color: #64748b; margin-bottom: 24px; }
        .modal-input { width: 100%; padding: 14px 16px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 15px; font-family: 'Inter', sans-serif; margin-bottom: 16px; outline: none; box-sizing: border-box; }
        .modal-input:focus { border-color: var(--primary, #1a472a); }
        .modal-btn { width: 100%; padding: 16px; background: var(--primary, #1a472a); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; }
      </style>
    </head>
    <body>
      <nav class="nav">
        <a href="/" class="logo"><span class="logo-vive">Vive</span><span class="logo-mas">Más</span></a>
        <a href="/pages/registro.html" class="nav-btn">Crear cuenta</a>
      </nav>

      <div class="profile-container">
        <div class="profile-card">
          <div class="profile-header">
            <div class="avatar-circle" style="background-image: url('${founder.profilePhoto || ''}'); background-size: cover; background-position: center; ${founder.profilePhoto ? 'color: transparent;' : ''}">${founder.profilePhoto ? '' : founder.name.charAt(0).toUpperCase()}</div>
            <h1 class="profile-name">${founder.name}</h1>
            <div class="profile-location">📍 ${founder.city}</div>
            <div class="badges">
              <span class="badge badge-rank">🏆 ${founder.rankTitle}</span>
              ${founder.ambassadorTitle ? `<span class="badge badge-amb">⭐ ${founder.ambassadorTitle}</span>` : ''}
            </div>
          </div>
          
          <div class="profile-body">
            <div class="stats-grid">
              <div class="stat-box"><div class="stat-value">${founder.propertiesCount}</div><div class="stat-label">Propiedades</div></div>
              <div class="stat-box"><div class="stat-value">${founder.profileViews}</div><div class="stat-label">Vistas</div></div>
            </div>
            
            <div class="contact-area" id="contactArea">
              ${contactButtons}
            </div>
          </div>
        </div>

        ${fichas.length > 0 ? `
          <h3 class="section-title">Propiedades recientes</h3>
          <div class="fichas-grid">
            ${fichas.map(f => `
              <div class="ficha-card">
                <img src="${f.imagenUrl || 'https://via.placeholder.com/300x180?text=Sin+Imagen'}" class="ficha-img" alt="Propiedad">
                <div class="ficha-body">
                  <div class="ficha-price">$${Number(f.precio).toLocaleString('es-MX')}</div>
                  <div class="ficha-loc">📍 ${f.ubicacion}</div>
                </div>
              </div>
            `).join('')}
          </div>` : ''}

        <div class="footer-link">
          <a href="/agentes-fundadores?ref=${founder.referralCode}">¿Eres asesor? Únete al programa →</a>
        </div>
      </div>

      <!-- BOTÓN FLOTANTE DE EDICIÓN (SOLO PARA EL DUEÑO) -->
      <button class="edit-fab" id="editFab" onclick="openModal()">✏️</button>

      <!-- MODAL DE EDICIÓN DE CONTACTO -->
      <div class="modal-overlay" id="editModal">
        <div class="modal-card">
          <h3 class="modal-title">Configurar Contacto Público</h3>
          <p class="modal-desc">Agrega tu WhatsApp y/o Correo. Estos datos serán visibles para cualquier cliente que abra este link. Puedes dejarlos vacíos si prefieres no mostrarlos.</p>
          <label style="font-size:13px; font-weight:600; color:#374151;">WhatsApp (10 dígitos)</label>
          <input type="tel" id="waInput" class="modal-input" placeholder="Ej: 5512345678" value="${founder.publicWhatsapp || ''}">
          <label style="font-size:13px; font-weight:600; color:#374151;">Correo electrónico</label>
          <input type="email" id="emailInput" class="modal-input" placeholder="Ej: agente@correo.com" value="${founder.publicEmail || ''}">
          <button class="modal-btn" onclick="saveContact()">Guardar cambios</button>
        </div>
      </div>

      <script>
        // Lógica para saber si el que visita es el dueño del perfil
        const loggedUser = JSON.parse(localStorage.getItem('user') || '{}');
        const ownerId = '${founder.userId ? founder.userId.toString() : ''}';
        if (loggedUser._id && loggedUser._id === ownerId) {
          document.getElementById('editFab').style.display = 'flex';
        }

        function openModal() {
          document.getElementById('editModal').style.display = 'flex';
        }

        async function saveContact() {
          const whatsapp = document.getElementById('waInput').value.trim();
          const email = document.getElementById('emailInput').value.trim();
          
          try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/fundadores/mine/public-contact', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
              body: JSON.stringify({ whatsapp, email })
            });
            const data = await res.json();
            if (data.ok) {
              alert('Contacto actualizado. La página se recargará para mostrar los cambios.');
              window.location.reload();
            } else {
              alert('Error: ' + (data.error || 'No se pudo guardar'));
            }
          } catch (e) {
            alert('Error de conexión');
          }
        }
      </script>
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
    if (founder) {
      console.log(`[registerMine] Usuario ${req.user.id} ya tenía Founder ${founder._id}`);
      return res.json(buildPanelPayload(req, founder));
    }

    const user = await User.findById(req.user.id).select('nombre telefono direccion.ciudad');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (!user.telefono) {
      // Sin teléfono no podemos generar su enlace de WhatsApp ni fichas.
      console.log(`[registerMine] Usuario ${req.user.id} sin teléfono, no se puede inscribir`);
      return res.json({ isFounder: false, needsPhone: true });
    }

    const existentePorTelefono = await Founder.findOne({ phone: user.telefono });

    if (existentePorTelefono && !existentePorTelefono.userId) {
      // Ya se había registrado antes desde el flujo público con este mismo
      // teléfono: lo ligamos. Usamos findOneAndUpdate (atómico) en vez de
      // mutar+.save() para eliminar cualquier duda de que el cambio se
      // aplique de verdad, y pedimos el documento actualizado de vuelta.
      console.log(`[registerMine] Ligando Founder existente ${existentePorTelefono._id} (tel ${user.telefono}) al usuario ${req.user.id}`);
      founder = await Founder.findOneAndUpdate(
        { _id: existentePorTelefono._id },
        { $set: { userId: user._id, name: user.nombre } },
        { new: true }
      );
      console.log(`[registerMine] Resultado tras ligar: userId=${founder?.userId}`);
    } else if (!existentePorTelefono) {
      console.log(`[registerMine] Creando Founder nuevo para usuario ${req.user.id} (tel ${user.telefono})`);
      founder = await new Founder({
        userId: user._id,
        name: user.nombre,
        phone: user.telefono,
        city: user.direccion?.ciudad || 'CDMX',
      }).save();
    } else {
      // Ya ligado a OTRO usuario distinto — caso raro (2 cuentas con mismo teléfono)
      console.log(`[registerMine] Teléfono ${user.telefono} ya ligado a otro usuario (${existentePorTelefono.userId}), no se puede re-ligar a ${req.user.id}`);
      return res.status(409).json({ error: 'Ese número de WhatsApp ya está inscrito con otra cuenta de la plataforma' });
    }

    if (!founder) {
      console.error('[registerMine] founder quedó undefined tras todas las ramas — esto no debería pasar');
      return res.status(500).json({ error: 'No se pudo completar la inscripción, intenta de nuevo' });
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
    const { facebook, instagram, website, socialVisible } = req.body;
    const founder = await Founder.findOneAndUpdate(
      { userId: req.user.id },
      { 
        social: { facebook: facebook || '', instagram: instagram || '', website: website || '' },
        socialVisible: socialVisible !== undefined ? socialVisible : true
      },
      { new: true }
    );
    if (!founder) return res.status(404).json({ error: 'Primero inscríbete al programa' });
    res.json({ ok: true, social: founder.social, socialVisible: founder.socialVisible });
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
// 13. Actualizar datos de contacto públicos (WhatsApp / Correo)
exports.updatePublicContact = async (req, res) => {
  try {
    const { whatsapp, email } = req.body;
    const founder = await Founder.findOneAndUpdate(
      { userId: req.user.id },
      { 
        publicWhatsapp: whatsapp || '', 
        publicEmail: email || '' 
      },
      { new: true }
    );
    if (!founder) return res.status(404).json({ error: 'Primero inscríbete al programa' });
    res.json({ ok: true, publicWhatsapp: founder.publicWhatsapp, publicEmail: founder.publicEmail });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// 14. Subir foto de perfil con moderación básica
exports.uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se subió ninguna imagen' });

    // AQUÍ PUEDES INTEGRAR GOOGLE VISION O SIGHTENGINE EN EL FUTURO
    // Por ahora, una validación básica de tamaño y tipo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Formato no válido. Usa JPG, PNG o WEBP.' });
    }
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'La imagen es muy grande (Máx 5MB).' });
    }

    // Convertimos a Base64 para guardar fácilmente sin depender de almacenamiento externo
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const founder = await Founder.findOneAndUpdate(
      { userId: req.user.id },
      { profilePhoto: base64Image },
      { new: true }
    );

    if (!founder) return res.status(404).json({ error: 'Primero inscríbete al programa' });
    res.json({ ok: true, photoUrl: base64Image });
  } catch (error) {
    res.status(500).json({ error: error.message });
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