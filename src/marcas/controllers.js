const { Brand, BrandAccount, BrandOTP } = require('./models');
const { BrandCategory, BrandCity } = require('./models');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const BRAND_JWT_SECRET = process.env.JWT_BRAND_SECRET || process.env.JWT_SECRET + '_brand';

// Función auxiliar para generar slug
const slugify = (text) => text.toString().toLowerCase().trim()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');

// ==========================================
// AUTENTICACIÓN DE MARCAS
// ==========================================

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

exports.registrarMarca = async (req, res) => {
  try {
    const { canal, email, telefono, password } = req.body;
    if (!canal) return res.status(400).json({ error: 'Debes elegir un canal.' });
    if (!password) return res.status(400).json({ error: 'La contraseña es obligatoria.' });
    if (canal === 'email' && !email) return res.status(400).json({ error: 'El correo es obligatorio.' });
    
    let telefonoLimpio = '';
    if (canal === 'sms') {
      if (!telefono) return res.status(400).json({ error: 'El teléfono es obligatorio.' });
      const soloDigitos = telefono.replace(/\D/g, '');
      if (soloDigitos.length !== 10) return res.status(400).json({ error: 'El teléfono debe tener 10 dígitos.' });
      telefonoLimpio = '+521' + soloDigitos;
    }

    let cuenta = await BrandAccount.findOne({ $or: [{ email: email }, { phone: telefonoLimpio }] });
    if (cuenta) {
      return res.status(400).json({ error: 'Ya existe una cuenta con este correo o teléfono. Intenta iniciar sesión.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    cuenta = await BrandAccount.create({
      email: email || null,
      phone: telefonoLimpio || null,
      password: hashedPassword
    });

    // --- Lógica de Twilio (SMS) ---
    if (canal === 'sms') {
      const twilioConfigurado = !!(process.env.SID_TWILIO && process.env.TOKEN_TWILIO && process.env.SID_SERVICIO_TWILIO);
      if (twilioConfigurado) {
        try {
          const client = require('twilio')(process.env.SID_TWILIO, process.env.TOKEN_TWILIO);
          await client.verify.v2.services(process.env.SID_SERVICIO_TWILIO)
            .verifications
            .create({ to: telefonoLimpio, channel: 'sms' });
            
          return res.status(200).json({ 
            ok: true, 
            mensaje: 'Te enviamos un código por SMS.',
            accountId: cuenta._id,
            espera: 60
          });
        } catch (twilioError) {
          return res.status(400).json({ error: `Twilio dice: ${twilioError.message}` });
        }
      }
    }

    // --- Lógica de Correo ---
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    await BrandOTP.deleteMany({ accountId: cuenta._id });
    await BrandOTP.create({ accountId: cuenta._id, codigo, tipo: 'email', expira: new Date(Date.now() + 10 * 60 * 1000) });

    try {
      const nodemailer = require('nodemailer');
      let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
        port: process.env.EMAIL_PORT || 465, secure: true,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
      });
      await transporter.sendMail({
        from: `"SomosViveMás" <${process.env.EMAIL_USER}>`,
        to: email, subject: 'Tu código de verificación - SomosViveMás',
        html: `<div style="font-family: Arial; text-align: center; padding: 20px;"><h2>Verifica tu cuenta de Marca</h2><h1 style="color: #1a472a; font-size: 40px;">${codigo}</h1></div>`
      });
    } catch (mailError) { console.error('Error al enviar correo:', mailError.message); }

    res.status(200).json({ ok: true, mensaje: 'Cuenta creada. Revisa tu correo.', accountId: cuenta._id, espera: 60 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.verificarMarca = async (req, res) => {
  try {
    const { accountId, codigo, canal, email, telefono } = req.body;
    
    let cuenta = null;
    
    if (accountId) {
      cuenta = await BrandAccount.findById(accountId);
    }
    if (!cuenta && email) {
      cuenta = await BrandAccount.findOne({ email });
    }
    if (!cuenta && telefono) {
      const soloDigitos = telefono.replace(/\D/g, '');
      cuenta = await BrandAccount.findOne({ 
        $or: [
          { phone: '+52' + soloDigitos },
          { phone: '+521' + soloDigitos }
        ]
      });
    }

    if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada' });

    if (canal === 'sms') {
      const twilioConfigurado = !!(process.env.SID_TWILIO && process.env.TOKEN_TWILIO && process.env.SID_SERVICIO_TWILIO);
      if (twilioConfigurado) {
        try {
          const client = require('twilio')(process.env.SID_TWILIO, process.env.TOKEN_TWILIO);
          const telefonoTwilio = '+521' + telefono.replace(/\D/g, '');
          
          const verification = await client.verify.v2.services(process.env.SID_SERVICIO_TWILIO)
            .verificationChecks
            .create({ to: telefonoTwilio, code: codigo });

          if (verification.status !== 'approved') {
            return res.status(400).json({ error: 'El código de SMS es incorrecto' });
          }
          cuenta.phoneVerified = true;
          cuenta.phone = telefonoTwilio;
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

    const token = jwt.sign({ id: cuenta._id, brandId: marca._id }, BRAND_JWT_SECRET, { expiresIn: '5m' });

    res.json({ ok: true, accessToken: token, marca, esNueva });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.loginMarca = async (req, res) => {
  try {
    const { email, telefono, password } = req.body;
    
    let cuenta = null;
    
    if (email) {
      cuenta = await BrandAccount.findOne({ email });
    } else if (telefono) {
      const soloDigitos = telefono.replace(/\D/g, '');
      cuenta = await BrandAccount.findOne({ 
        $or: [
          { phone: '+52' + soloDigitos },
          { phone: '+521' + soloDigitos }
        ]
      });
    }

    if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada' });
    
    if (!cuenta.emailVerified && !cuenta.phoneVerified) {
      return res.status(403).json({ error: 'Debes verificar tu correo o teléfono primero.' });
    }

    const valid = await bcrypt.compare(password, cuenta.password);
    if (!valid) return res.status(400).json({ error: 'Contraseña incorrecta' });

    const token = jwt.sign({ id: cuenta._id, brandId: cuenta.brandId }, BRAND_JWT_SECRET, { expiresIn: '5m' });
    
    res.json({ ok: true, accessToken: token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// PANEL DEL PROVEEDOR
// ==========================================
exports.obtenerMiMarca = async (req, res) => {
  try {
    let marca = await Brand.findOne({ accountId: req.user.id })
      .populate('accountId', 'email phone emailVerified phoneVerified')
      .populate('categorias', 'nombre slug')
      .populate('ciudadPrincipal', 'nombre slug')
      .populate('ciudadesCobertura', 'nombre slug');
    
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada' });

    if (!marca.servicios) marca.servicios = [];
    if (!marca.ciudadesCobertura) marca.ciudadesCobertura = [];
    if (!marca.categorias) marca.categorias = [];
    if (!marca.solicitudesModeracion) marca.solicitudesModeracion = [];
    
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

    // Si el admin decide ELIMINAR, borramos la marca y la cuenta para liberar el correo/teléfono
    if (status === 'eliminado') {
      const marca = await Brand.findById(id);
      if (marca) {
        // Guardamos un registro en la consola de Hostinger antes de borrar
        console.log(`[ADMIN] Eliminando permanentemente: ${marca.nombreComercial} (ID: ${marca._id})`);
        
        if (marca.accountId) {
          await BrandAccount.deleteOne({ _id: marca.accountId });
        }
        await Brand.deleteOne({ _id: id });
      }
      return res.json({ ok: true, mensaje: 'Marca y cuenta eliminadas permanentemente. El correo/teléfono ya está libre para registrarse de nuevo.' });
    }

    // Para bloquear o despublicar, solo actualizamos el estado
    const marca = await Brand.findByIdAndUpdate(id, { status }, { new: true });
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada' });
    
    res.json({ ok: true, marca });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// REFRESCAR TOKEN (Inactividad)
// ==========================================
exports.refreshToken = async (req, res) => {
  try {
    const oldToken = req.header('Authorization')?.replace('Bearer ', '');
    if (!oldToken) return res.status(401).json({ error: 'No hay token' });

    const decoded = jwt.verify(oldToken, BRAND_JWT_SECRET);
    const cuenta = await BrandAccount.findById(decoded.id);
    if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada' });

    const newToken = jwt.sign({ id: cuenta._id, brandId: cuenta.brandId }, BRAND_JWT_SECRET, { expiresIn: '5m' });
    
    res.json({ ok: true, accessToken: newToken });
  } catch (error) {
    res.status(401).json({ error: 'Sesión expirada, inicia sesión de nuevo' });
  }
};

// ==========================================
// SOLICITUDES DE MODERACIÓN
// ==========================================
exports.obtenerSolicitudes = async (req, res) => {
  try {
    const marca = await Brand.findOne({ accountId: req.user.id }).select('solicitudesModeracion');
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada' });
    res.json({ ok: true, solicitudes: marca.solicitudesModeracion || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

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
// ==========================================
// ADMIN: RESETEAR CONTRASEÑA DE MARCA
// ==========================================
exports.adminResetPasswordMarca = async (req, res) => {
  try {
    const { id } = req.params; // ID de la marca
    const marca = await Brand.findById(id);
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada' });

    const cuenta = await BrandAccount.findById(marca.accountId);
    if (!cuenta) return res.status(404).json({ error: 'Cuenta de marca no encontrada' });

    // Generar contraseña temporal
    const tempPass = Math.random().toString(36).slice(-8);
    const salt = await bcrypt.genSalt(10);
    cuenta.password = await bcrypt.hash(tempPass, salt);
    await cuenta.save();

    // Si tiene correo, se le envía (usando tu Nodemailer)
    if (cuenta.email) {
      try {
        const nodemailer = require('nodemailer');
        let transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
          port: process.env.EMAIL_PORT || 465, secure: true,
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });
        await transporter.sendMail({
          from: `"SomosViveMás" <${process.env.EMAIL_USER}>`,
          to: cuenta.email,
          subject: 'Tu nueva contraseña de Marca - SomosViveMás',
          html: `<p>El administrador ha reseteado tu contraseña.</p><p>Tu nueva contraseña temporal es: <b>${tempPass}</b></p><p>Úsala para iniciar sesión en el panel de tu marca.</p>`
        });
      } catch (mailError) { console.error('Error al enviar correo:', mailError.message); }
    }

        let correoEnviado = false;
    if (cuenta.email) {
      try {
        const nodemailer = require('nodemailer');
        let transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
          port: process.env.EMAIL_PORT || 465, secure: true,
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });
        await transporter.sendMail({
          from: `"SomosViveMás" <${process.env.EMAIL_USER}>`,
          to: cuenta.email,
          subject: 'Tu nueva contraseña de Marca - SomosViveMás',
          html: `<p>El administrador ha reseteado tu contraseña.</p><p>Tu nueva contraseña temporal es: <b>${tempPass}</b></p>`
        });
        correoEnviado = true;
      } catch (mailError) { 
        console.error('Error al enviar correo:', mailError.message); 
      }
    }

    res.json({ ok: true, passwordTemporal: tempPass, correoEnviado, mensaje: correoEnviado ? 'Contraseña enviada por correo.' : 'No se pudo enviar el correo, entra a los logs del servidor para ver el error.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// ==========================================
// PROVEEDOR: ELIMINAR SU PROPIA CUENTA
// ==========================================
exports.eliminarMiMarca = async (req, res) => {
  try {
    const marca = await Brand.findOne({ accountId: req.user.id });
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada' });

    // Borramos la marca y la cuenta de la base de datos permanentemente
    await BrandAccount.deleteOne({ _id: req.user.id });
    await Brand.deleteOne({ _id: marca._id });

    res.json({ ok: true, mensaje: 'Tu marca y cuenta han sido eliminadas permanentemente.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};