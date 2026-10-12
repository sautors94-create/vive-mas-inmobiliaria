const { Brand, BrandAccount, BrandOTP } = require('./models');
const { BrandCategory, BrandCity } = require('./models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const BRAND_JWT_SECRET = process.env.JWT_BRAND_SECRET || process.env.JWT_SECRET + '_brand';

// Función auxiliar para generar slug
const slugify = (text) => text.toString().toLowerCase().trim()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');

// ==========================================
// AUTENTICACIÓN DE MARCAS
// ==========================================
exports.registrarMarca = async (req, res) => {
  try {
    const { email, phone, password } = req.body;
    if (!password) return res.status(400).json({ error: 'La contraseña es obligatoria' });
    if (!email && !phone) return res.status(400).json({ error: 'Email o teléfono son obligatorios' });

    const existe = await BrandAccount.findOne({ $or: [{ email }, { phone }] });
    if (existe) return res.status(400).json({ error: 'Ya existe una cuenta con este correo o teléfono' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const nuevaCuenta = await BrandAccount.create({
      email: email || null,
      phone: phone || null,
      password: hashedPassword
    });

    // Generar OTP (Simulado por aquí, en producción se envía por correo/SMS real)
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    await BrandOTP.create({
      accountId: nuevaCuenta._id,
      codigo,
      tipo: email ? 'email' : 'phone',
      expira: new Date(Date.now() + 10 * 60 * 1000)
    });

    // TODO: Aquí llamarías a tu servicio de correo (utils/email.js) o Twilio para enviar el código.
    console.log(`[DEV] Código de verificación para Marca: ${codigo}`);

    res.status(201).json({ 
      ok: true, 
      mensaje: 'Cuenta creada. Revisa tu correo/teléfono para el código de verificación.',
      accountId: nuevaCuenta._id 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.verificarMarca = async (req, res) => {
  try {
    const { accountId, codigo } = req.body;
    const otp = await BrandOTP.findOne({ accountId, codigo });

    if (!otp) return res.status(400).json({ error: 'Código incorrecto' });
    if (otp.expira < new Date()) return res.status(400).json({ error: 'El código ha expirado' });

    const cuenta = await BrandAccount.findById(accountId);
    if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada' });

    if (otp.tipo === 'email') cuenta.emailVerified = true;
    if (otp.tipo === 'phone') cuenta.phoneVerified = true;
    await cuenta.save();

    // Crear perfil de marca vacío
    const slug = `marca-${cuenta._id.toString().slice(-6)}`;
    const nuevaMarca = await Brand.create({
      accountId: cuenta._id,
      nombreComercial: 'Mi Nueva Marca',
      slug: slug
    });
    cuenta.brandId = nuevaMarca._id;
    await cuenta.save();

    await BrandOTP.deleteOne({ _id: otp._id });

    const token = jwt.sign({ id: cuenta._id, brandId: nuevaMarca._id }, BRAND_JWT_SECRET, { expiresIn: '7d' });

    res.json({ ok: true, token, marca: nuevaMarca });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.loginMarca = async (req, res) => {
  try {
    const { email, phone, password } = req.body;
    const cuenta = await BrandAccount.findOne({ $or: [{ email }, { phone }] });
    if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada' });

    const valid = await bcrypt.compare(password, cuenta.password);
    if (!valid) return res.status(400).json({ error: 'Contraseña incorrecta' });

    const token = jwt.sign({ id: cuenta._id, brandId: cuenta.brandId }, BRAND_JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok: true, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// PANEL DEL PROVEEDOR
// ==========================================
exports.obtenerMiMarca = async (req, res) => {
  try {
    const marca = await Brand.findOne({ accountId: req.user.id })
      .populate('categorias', 'nombre slug')
      .populate('ciudadPrincipal', 'nombre slug')
      .populate('ciudadesCobertura', 'nombre slug');
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada' });
    res.json({ ok: true, marca });
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
    const { search, categoria, ciudad } = req.query;
    let query = { status: 'publicado' };

    if (search) {
      query.$or = [
        { nombreComercial: { $regex: search, $options: 'i' } },
        { descripcion: { $regex: search, $options: 'i' } }
      ];
    }
    if (categoria) query.categorias = mongoose.Types.ObjectId(categoria);
    if (ciudad) query.ciudadesCobertura = mongoose.Types.ObjectId(ciudad);

    const marcas = await Brand.find(query)
      .populate('categorias', 'nombre')
      .populate('ciudadPrincipal', 'nombre')
      .select('nombreComercial slug descripcion logo portada telefono whatsapp promociones categorias ciudadPrincipal');

    res.json({ ok: true, total: marcas.length, marcas });
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