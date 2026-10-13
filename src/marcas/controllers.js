const { Brand, BrandAccount, BrandOTP } = require('./models');
const { BrandCategory, BrandCity } = require('./models');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const BRAND_JWT_SECRET = process.env.JWT_BRAND_SECRET || process.env.JWT_SECRET + '_brand';

// Función para saber qué métodos de registro están activos
exports.obtenerCanales = async (req, res) => {
  try {
    const twilioConfigurado = !!(process.env.SID_TWILIO && process.env.TOKEN_TWILIO && process.env.SID_SERVICIO_TWILIO);
    res.json({ 
      ok: true, 
      email: true, 
      sms: twilioConfigurado 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const slugify = (text) => text.toString().toLowerCase().trim()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');

// ==========================================
// AUTENTICACIÓN DE MARCAS
// ==========================================
exports.registrarMarca = async (req, res) => {
  try {
    const { canal, email, telefono } = req.body;
    if (!canal) return res.status(400).json({ error: 'Debes elegir un canal (email o sms).' });
    if (canal === 'email' && !email) return res.status(400).json({ error: 'El correo es obligatorio.' });
    
    let telefonoLimpio = '';
    if (canal === 'sms') {
      if (!telefono) return res.status(400).json({ error: 'El teléfono es obligatorio.' });
      const soloDigitos = telefono.replace(/\D/g, '');
      if (soloDigitos.length !== 10) {
        return res.status(400).json({ error: 'El teléfono debe tener exactamente 10 dígitos.' });
      }
      telefonoLimpio = '+521' + soloDigitos; // Forzamos el prefijo de México con el 1
    }

    let cuenta = await BrandAccount.findOne({ $or: [{ email: email }, { phone: telefonoLimpio }] });
    let esNueva = false;

    if (!cuenta) {
      cuenta = await BrandAccount.create({
        email: email || null,
        phone: telefonoLimpio || null
      });
      esNueva = true;
    }

    if (canal === 'sms') {
      const twilioConfigurado = !!(process.env.SID_TWILIO && process.env.TOKEN_TWILIO && process.env.SID_SERVICIO_TWILIO);
      if (twilioConfigurado) {
        try {
          const client = require('twilio')(process.env.SID_TWILIO, process.env.TOKEN_TWILIO);
          const verification = await client.verify.v2.services(process.env.SID_SERVICIO_TWILIO)
            .verifications
            .create({ to: telefonoLimpio, channel: 'sms' });
            
          console.log(`[TWILIO DEBUG] Enviando a: ${telefonoLimpio} | Estado: ${verification.status} | SID: ${verification.sid}`);
            
          return res.status(200).json({ 
            ok: true, 
            mensaje: 'Te enviamos un código por SMS.',
            accountId: cuenta._id,
            espera: 60
          });
        } catch (twilioError) {
          console.error('[TWILIO DEBUG] Error de Twilio:', twilioError.message);
          return res.status(400).json({ error: `Twilio dice: ${twilioError.message}` });
        }
      } else {
        return res.status(400).json({ error: 'La verificación por SMS no está configurada en el servidor.' });
      }
    }

    // Si eligió correo, generamos un código local y lo enviamos por correo real
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    await BrandOTP.deleteMany({ accountId: cuenta._id });
    await BrandOTP.create({
      accountId: cuenta._id,
      codigo,
      tipo: 'email',
      expira: new Date(Date.now() + 10 * 60 * 1000)
    });

    try {
      const nodemailer = require('nodemailer');
      let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
        port: process.env.EMAIL_PORT || 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER, 
          pass: process.env.EMAIL_PASS  
        }
      });

      await transporter.sendMail({
        from: `"SomosViveMás" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Tu código de verificación - SomosViveMás',
        html: `
          <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
            <h2>Verifica tu cuenta de Marca</h2>
            <p>Estás a un paso de publicar tu marca en el directorio de SomosViveMás.</p>
            <p>Tu código de verificación es:</p>
            <h1 style="color: #1a472a; letter-spacing: 5px; font-size: 40px;">${codigo}</h1>
            <p>Este código expirará en 10 minutos.</p>
          </div>
        `
      });
    } catch (mailError) {
      console.error('Error al enviar correo:', mailError.message);
    }

    console.log(`[DEV] Código de verificación para Marca ${email}: ${codigo}`);

    res.status(200).json({ 
      ok: true, 
      mensaje: 'Cuenta creada. Revisa tu correo para el código de verificación.',
      accountId: cuenta._id,
      espera: 60
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.verificarMarca = async (req, res) => {
  try {
    const { accountId, codigo, canal, email, telefono } = req.body;
    
    let telefonoLimpio = '';
    if (telefono) {
      const soloDigitos = telefono.replace(/\D/g, '');
      telefonoLimpio = '+521' + soloDigitos;
    }

    let cuenta = await BrandAccount.findById(accountId);
    if (!cuenta && email) cuenta = await BrandAccount.findOne({ email });
    if (!cuenta && telefonoLimpio) cuenta = await BrandAccount.findOne({ phone: telefonoLimpio });

    if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada' });

    if (canal === 'sms') {
      const twilioConfigurado = !!(process.env.SID_TWILIO && process.env.TOKEN_TWILIO && process.env.SID_SERVICIO_TWILIO);
      if (twilioConfigurado) {
        try {
          const client = require('twilio')(process.env.SID_TWILIO, process.env.TOKEN_TWILIO);
          const verification = await client.verify.v2.services(process.env.SID_SERVICIO_TWILIO)
            .verificationChecks
            .create({ to: telefonoLimpio, code: codigo });

          if (verification.status !== 'approved') {
            return res.status(400).json({ error: 'El código de SMS es incorrecto' });
          }
          cuenta.phoneVerified = true;
        } catch (twilioError) {
          console.error('Error al verificar Twilio:', twilioError.message);
          return res.status(400).json({ error: 'Error al verificar el SMS.' });
        }
      }
    } else {
      const otp = await BrandOTP.findOne({ accountId: cuenta._id, codigo });
      if (!otp) return res.status(400).json({ error: 'Código incorrecto' });
      if (otp.expira < new Date()) return res.status(400).json({ error: 'El código ha expirado' });

      if (otp.tipo === 'email') cuenta.emailVerified = true;
      await BrandOTP.deleteOne({ _id: otp._id });
    }

    await cuenta.save();

    let marca = await Brand.findOne({ accountId: cuenta._id });
    let esNueva = false;
    if (!marca) {
      const slug = `marca-${cuenta._id.toString().slice(-6)}`;
      marca = await Brand.create({
        accountId: cuenta._id,
        nombreComercial: 'Mi Nueva Marca',
        slug: slug
      });
      cuenta.brandId = marca._id;
      await cuenta.save();
      esNueva = true;
    }

    const token = jwt.sign({ id: cuenta._id, brandId: marca._id }, BRAND_JWT_SECRET, { expiresIn: '7d' });

    res.json({ ok: true, accessToken: token, marca, esNueva });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.loginMarca = async (req, res) => {
  res.status(501).json({ error: 'El login se hace a través del flujo de código de verificación.' });
};

// ==========================================
// PANEL DEL PROVEEDOR
// ==========================================
exports.obtenerMiMarca = async (req, res) => {
  try {
    // Buscamos la marca y populamos la cuenta para saber el email/teléfono
    let marca = await Brand.findOne({ accountId: req.user.id })
      .populate('accountId', 'email phone emailVerified phoneVerified')
      .populate('categorias', 'nombre slug')
      .populate('ciudadPrincipal', 'nombre slug')
      .populate('ciudadesCobertura', 'nombre slug');
    
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada' });

    // Nos aseguramos de que los arreglos siempre existan para el frontend
    if (!marca.servicios) marca.servicios = [];
    if (!marca.ciudadesCobertura) marca.ciudadesCobertura = [];
    if (!marca.categorias) marca.categorias = [];
    if (!marca.solicitudesModeracion) marca.solicitudesModeracion = [];
    
    // Devolvemos la cuenta adjunta para que el frontend la pueda leer
    const respuesta = marca.toObject();
    respuesta.cuenta = marca.accountId;
    
    res.json({ ok: true, marca: respuesta });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.actualizarMiMarca = async (req, res) => {
  try {
    const marca = await Brand.findOne({ accountId: req.user.id });
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada' });
    if (marca.status === 'bloqueado') return res.status(403).json({ error: 'Tu marca está bloqueada' });

    const campos = ['nombreComercial', 'descripcion', 'logo', 'portada', 'telefono', 'whatsapp', 'emailContacto', 'sitioWeb', 'promociones', 'categorias', 'ciudadPrincipal', 'ciudadesCobertura'];
    campos.forEach(campo => {
      if (req.body[campo] !== undefined) marca[campo] = req.body[campo];
    });

    if (marca.nombreComercial) marca.slug = slugify(marca.nombreComercial) + '-' + marca._id.toString().slice(-4);

    await marca.save();
    res.json({ ok: true, marca });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.publicarMarca = async (req, res) => {
  try {
    const marca = await Brand.findOne({ accountId: req.user.id });
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada' });
    if (marca.status === 'bloqueado') return res.status(403).json({ error: 'No puedes publicar una marca bloqueada' });

    if (!marca.nombreComercial || !marca.descripcion || marca.descripcion.length < 30 || !marca.logo || marca.categorias.length === 0) {
      return res.status(400).json({ error: 'Faltan datos mínimos para publicar (nombre, descripción >30 caracteres, logo y categoría)' });
    }

    marca.status = 'publicado';
    await marca.save();
    res.json({ ok: true, mensaje: 'Marca publicada correctamente', marca });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// DIRECTORIO PÚBLICO
// ==========================================
exports.obtenerMarcasPublico = async (req, res) => {
  try {
    const { search, categoria, ciudad, orden, pagina = 1, limite = 12 } = req.query;
    let query = { status: 'publicado' };

    if (search) {
      query.$or = [
        { nombreComercial: { $regex: search, $options: 'i' } },
        { descripcion: { $regex: search, $options: 'i' } }
      ];
    }
    if (categoria) query.categorias = mongoose.Types.ObjectId(categoria);
    if (ciudad) query.ciudadesCobertura = mongoose.Types.ObjectId(ciudad);

    let sortOptions = { createdAt: -1 }; 
    if (orden === 'alfabetico') sortOptions = { nombreComercial: 1 };

    const skip = (Number(pagina) - 1) * Number(limite);

    const [marcas, total] = await Promise.all([
      Brand.find(query)
        .populate('categorias', 'nombre')
        .populate('ciudadPrincipal', 'nombre')
        .select('nombreComercial slug descripcion logo portada telefono whatsapp promociones categorias ciudadPrincipal')
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limite)),
      Brand.countDocuments(query)
    ]);

    res.json({ 
      ok: true, 
      total, 
      marcas,
      pagina: Number(pagina),
      totalPaginas: Math.ceil(total / Number(limite))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.obtenerMarcaPublico = async (req, res) => {
  try {
    const marca = await Brand.findOne({ slug: req.params.slug, status: 'publicado' })
      .populate('categorias', 'nombre')
      .populate('ciudadPrincipal', 'nombre')
      .populate('ciudadesCobertura', 'nombre');
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada o no publicada' });
    res.json({ ok: true, marca });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.obtenerCatalogos = async (req, res) => {
  try {
    const categorias = await BrandCategory.find().sort('nombre');
    const ciudades = await BrandCity.find().sort('nombre');
    res.json({ ok: true, categorias, ciudades });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// PANEL ADMINISTRATIVO
// ==========================================
exports.adminObtenerMarcas = async (req, res) => {
  try {
    const marcas = await Brand.find()
      .populate('accountId', 'email phone emailVerified phoneVerified')
      .populate('categorias', 'nombre')
      .sort({ createdAt: -1 });
    res.json({ ok: true, marcas });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.adminCambiarStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const marca = await Brand.findByIdAndUpdate(id, { status }, { new: true });
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada' });
    res.json({ ok: true, marca });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const oldToken = req.header('Authorization')?.replace('Bearer ', '');
    if (!oldToken) return res.status(401).json({ error: 'No hay token' });

    const decoded = jwt.verify(oldToken, BRAND_JWT_SECRET);
    const cuenta = await BrandAccount.findById(decoded.id);
    if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada' });

    const newToken = jwt.sign({ id: cuenta._id, brandId: cuenta.brandId }, BRAND_JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok: true, accessToken: newToken });
  } catch (error) {
    res.status(401).json({ error: 'Sesión expirada, inicia sesión de nuevo' });
  }
};
// Obtener solicitudes de moderación
exports.obtenerSolicitudes = async (req, res) => {
  try {
    const marca = await Brand.findOne({ accountId: req.user.id }).select('solicitudesModeracion');
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada' });
    res.json({ ok: true, solicitudes: marca.solicitudesModeracion || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Resolver una solicitud de moderación
exports.resolverSolicitud = async (req, res) => {
  try {
    const { solicitudId } = req.params;
    const marca = await Brand.findOne({ accountId: req.user.id });
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada' });

    const solicitud = marca.solicitudesModeracion.id(solicitudId);
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });

    solicitud.estado = 'atendida';
    await marca.save();
    res.json({ ok: true, mensaje: 'Solicitud marcada como atendida' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};