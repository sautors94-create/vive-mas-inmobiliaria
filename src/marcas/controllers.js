'use strict';

/**
 * src/marcas/controllers.js — Controladores del módulo Marcas y Profesionales Aliados.
 * ---------------------------------------------------------------------------
 * REESCRITO COMPLETO según el contrato de tests/marcas.integration.js (Camino B).
 * El archivo original tenía 21 funciones con otro contrato (registro por
 * password, campos status/accountId/ciudadesCobertura, JWT de 5 minutos con
 * datos de la cuenta dentro del token, Twilio leído por env, etc.). El test
 * define un módulo más maduro; cambios clave:
 *
 *   AUTENTICACIÓN
 *   - Registro OTP-first: `solicitar` NO crea cuenta (sólo envía código);
 *     la cuenta + borrador de marca se crean al VERIFICAR.
 *   - Sin passwords: acceso por código de un solo uso (email/Twilio Verify)
 *     + cookie httpOnly vm_brand_refresh para renovar sesión.
 *   - Secreto de marca SEPARADO (JWT_BRAND_SECRET o JWT_SECRET + '_brand'):
 *     un token de usuario/admin NO abre el panel de marca (401) y viceversa.
 *   - Twilio se consume vía src/utils/twilioVerify (el test lo stubbea); SMS
 *     sin configuración responde 503, nunca se finge.
 *   - Anti-abuso: cooldown 60 s por destino (BrandOtp.ultimoEnvio), máx. 4
 *     intentos fallidos por código (después 429), límite por IP en routes.js.
 *
 *   DATOS
 *   - Brand: estado (borrador→publicado→despublicado/bloqueado/desactivado/
 *     eliminado), contacto público separado de credenciales, buscador
 *     normalizado sin acentos (`busqueda`), promociones con etiqueta pública.
 *   - Serializadores públicos cerrados: el detalle público jamás expone
 *     estado interno, cuenta, busqueda ni moderación.
 *   - IDOR: todo el panel opera sobre la marca de req (sesión), y las
 *     subcolecciones se buscan dentro de ESA marca → 404, no 403 (no revela
 *     existencia).
 *
 *   ADMIN
 *   - Moderación con bitácora BrandAuditLog (quién: adminEmail resuelto de BD;
 *     cuándo: createdAt) y purga en dos pasos (borrado lógico → purga con
 *     confirmación explícita).
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const {
  Brand,
  BrandAccount,
  BrandOtp,
  BrandCategory,
  BrandCity,
  BrandAuditLog,
} = require('./models');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
// ---------------------------------------------------------------
// CORREO — ACCESO HÍBRIDO (no exige que email.js exporte nada):
// El repositorio conserva SU propio src/utils/email.js (con las
// funciones del registro de usuarios). Si ese módulo expone un
// `transporter` lo reutilizamos; si no, Marcas construye el suyo
// con las mismas variables EMAIL_*. Así el módulo Marcas NO puede
// romper (ni ser roto por) el email.js del resto del sitio.
// ---------------------------------------------------------------
const _moduloEmail = require('../utils/email');
const correoConfigurado = typeof _moduloEmail.correoConfigurado === 'function'
  ? _moduloEmail.correoConfigurado
  : () => !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
let transporterPropio = null;
const transporterMarcas = () => {
  const t = _moduloEmail && _moduloEmail.transporter;
  if (t && typeof t.sendMail === 'function') return t; // banco de pruebas / email.js compatible
  if (!transporterPropio) {
    const nodemailer = require('nodemailer');
    transporterPropio = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
      port: Number(process.env.EMAIL_PORT || 465),
      secure: String(process.env.EMAIL_SECURE == null ? 'true' : process.env.EMAIL_SECURE) !== 'false',
      auth: process.env.EMAIL_USER
        ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        : undefined,
    });
  }
  return transporterPropio;
};
const twilio = require('../utils/twilioVerify');
const cloud = require('../config/cloudinary');
const slugify = require('./utils/slugify');

// ============================================================
// CONSTANTES DE NEGOCIO
// ============================================================
const ACCESO_MINUTOS = 15;              // vida del access token de marca
const REFRESCO_DIAS = 30;               // vida de la cookie de refresco
const VIDA_OTP_MS = 10 * 60 * 1000;     // el código vive 10 minutos
const COOLDOWN_OTP_MS = 60 * 1000;      // 1 código por minuto por destino
const MAX_INTENTOS_OTP = 4;             // al 4º fallo el código queda bloqueado
const MAX_GALERIA = 8;
const MAX_PROMOCIONES = 10;
const ESTADOS_MARCA = ['borrador', 'publicado', 'despublicado', 'bloqueado', 'desactivado', 'eliminado'];
const TIPOS_IMAGEN = ['logo', 'portada', 'fotoPerfil', 'galeria'];
const REDES_SOCIALES = ['facebook', 'instagram', 'tiktok', 'x', 'linkedin', 'youtube'];
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Ciudad válida: letras/números al inicio, sin < > / \ ni inyecciones.
const NOMBRE_CIUDAD_RX = /^[\p{L}\p{N}][\p{L}\p{N} .,'()\u2013-]{1,79}$/u;

// ============================================================
// HELPERS GENERALES
// ============================================================
const brandSecret = () =>
  process.env.JWT_BRAND_SECRET || `${process.env.JWT_SECRET || ''}_brand`;

const sinAcentos = (texto) =>
  String(texto == null ? '' : texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const escaparRegex = (texto) => String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const aObjectId = (valor) => {
  try {
    if (!valor) return null;
    return new mongoose.Types.ObjectId(String(valor));
  } catch {
    return null;
  }
};

const porCadena = (valor) => String(valor == null ? '' : valor).trim();

// ============================================================
// CATÁLOGO BASE (v7) — copia CANÓNICA de src/marcas/utils/seed.js v3.
// La autocuración v6 dependía de que la utils/seed.js de producción
// exportara sembrarCatalogos: si ese archivo quedó VIEJO, el guard
// typeof se lo saltaba EN SILENCIO y los dropdowns del panel volvían a
// quedarse vacíos ("Selecciona una ciudad…" sin opciones, cero
// categorías → Publicar deshabilitado). Con esta base EMBEBIDA el
// rescate funciona siempre, exista o no seed.js.
// 8 categorías + 63 ciudades; upsert por slug con $setOnInsert →
// idempotente, race-safe y NUNCA pisa documentos existentes.
// ============================================================
const CATALOGO_CATEGORIAS = [
  'Arquitectura y diseño de interiores',
  'Notarías y servicios legales',
  'Persianas, cortinas y decoración',
  'Remodelación, construcción y mantenimiento',
  'Mudanzas y logística',
  'Fotografía y servicios inmobiliarios',
  'Servicios para el hogar',
  'Otros servicios profesionales',
];

// [nombre, estado] — mismas 63 ciudades del seed v3 (el slug es la clave).
const CATALOGO_CIUDADES = [
  ['Aguascalientes', 'Aguascalientes'],
  ['Ensenada', 'Baja California'],
  ['Mexicali', 'Baja California'],
  ['Tecate', 'Baja California'],
  ['Tijuana', 'Baja California'],
  ['La Paz', 'Baja California Sur'],
  ['San José del Cabo', 'Baja California Sur'],
  ['Calkiní', 'Campeche'],
  ['Campeche', 'Campeche'],
  ['Tapachula', 'Chiapas'],
  ['Tuxtla Gutiérrez', 'Chiapas'],
  ['Chihuahua', 'Chihuahua'],
  ['Ciudad Juárez', 'Chihuahua'],
  ['Delicias', 'Chihuahua'],
  ['Monclova', 'Coahuila'],
  ['Saltillo', 'Coahuila'],
  ['Torreón', 'Coahuila'],
  ['Colima', 'Colima'],
  ['Manzanillo', 'Colima'],
  ['Acapulco', 'Guerrero'],
  ['Chilpancingo', 'Guerrero'],
  ['Zihuatanejo', 'Guerrero'],
  ['Gómez Palacio', 'Durango'],
  ['Durango', 'Durango'],
  ['Celaya', 'Guanajuato'],
  ['Guanajuato', 'Guanajuato'],
  ['Irapuato', 'Guanajuato'],
  ['León', 'Guanajuato'],
  ['San Miguel de Allende', 'Guanajuato'],
  ['Pachuca', 'Hidalgo'],
  ['Tulancingo', 'Hidalgo'],
  ['Guadalajara', 'Jalisco'],
  ['Puerto Vallarta', 'Jalisco'],
  ['Tlaquepaque', 'Jalisco'],
  ['Zapopan', 'Jalisco'],
  ['Ciudad de México', 'Ciudad de México'],
  ['Naucalpan', 'Estado de México'],
  ['Tlalnepantla', 'Estado de México'],
  ['Toluca', 'Estado de México'],
  ['Morelia', 'Michoacán'],
  ['Uruapan', 'Michoacán'],
  ['Zamora', 'Michoacán'],
  ['Cuernavaca', 'Morelos'],
  ['Jiutepec', 'Morelos'],
  ['Tepic', 'Nayarit'],
  ['Monterrey', 'Nuevo León'],
  ['San Pedro Garza García', 'Nuevo León'],
  ['Oaxaca', 'Oaxaca'],
  ['Huatulco', 'Oaxaca'],
  ['Cholula', 'Puebla'],
  ['Puebla', 'Puebla'],
  ['Querétaro', 'Querétaro'],
  ['San Juan del Río', 'Querétaro'],
  ['Cancún', 'Quintana Roo'],
  ['Chetumal', 'Quintana Roo'],
  ['Playa del Carmen', 'Quintana Roo'],
  ['San Luis Potosí', 'San Luis Potosí'],
  ['Culiacán', 'Sinaloa'],
  ['Mazatlán', 'Sinaloa'],
  ['Hermosillo', 'Sonora'],
  ['Ciudad Obregón', 'Sonora'],
  ['Villahermosa', 'Tabasco'],
  ['Tampico', 'Tamaulipas'],
].map(([nombre, estado]) => ({ nombre, estado: estado || '' }));

// Dedupe de rescates concurrentes: si 2 peticiones llegan a la vez, ambas
// comparten la MISMA promesa (y el bulkWrite upsert hace el resto seguro).
let _sembrandoBase = null;
const sembrarCatalogoBase = async () => {
  if (mongoose.connection.readyState !== 1) return false;
  if (!_sembrandoBase) {
    _sembrandoBase = (async () => {
      try {
        await Promise.all([
          BrandCategory.bulkWrite(
            CATALOGO_CATEGORIAS.map((nombre) => ({
              updateOne: {
                filter: { slug: slugify(nombre) },
                update: { $setOnInsert: { nombre, slug: slugify(nombre), activa: true } },
                upsert: true,
              },
            })),
            { ordered: false },
          ),
          BrandCity.bulkWrite(
            CATALOGO_CIUDADES.map(({ nombre, estado }) => ({
              updateOne: {
                filter: { slug: slugify(nombre) },
                update: { $setOnInsert: { nombre, estado, slug: slugify(nombre), activa: true } },
                upsert: true,
              },
            })),
            { ordered: false },
          ),
        ]);
        return true;
      } catch (e) {
        // Choque E11000 de carrera u otro error de escritura: el rescate
        // NUNCA debe tumbar la petición.
        console.error('[marcas][sembrarCatalogoBase]', e && e.message);
        return false;
      } finally {
        _sembrandoBase = null;
      }
    })();
  }
  return _sembrandoBase;
};

const ES_ID_24 = (v) => /^[0-9a-f]{24}$/i.test(String(v || ''));

/**
 * v7 — resuelve una lista de entradas de catálogo aceptando TRES formas:
 *   ObjectId (24 hex)  ·  slug ("san-jose-del-cabo")  ·  nombre ("San José del Cabo")
 * El panel v2.4 puede llevar seleccionadas opciones del CATÁLOGO DE RESPALDO
 * (sin _id) cuando la API de catálogos aún no devolvía documentos reales;
 * así el guardado resuelve por slug/nombre en vez de rechazar con 400 y el
 * flujo "completar perfil → Publicar" nunca se atasca por el catálogo.
 * Devuelve { ids: [ObjectId], faltantes: [String] }. Compatibilidad total:
 * si todo lo que llega son ObjectId el comportamiento es IDÉNTICO al v6.
 */
const resolverListaCatalogo = async (entradas, { Modelo, soloActivas }) => {
  const crudos = [];
  for (const c of (entradas || [])) {
    const s = porCadena(c);
    if (s) crudos.push(s);
  }
  if (!crudos.length) return { ids: [], faltantes: [] };

  // Autorrescate: si la tabla está VACÍA (BD recién migrada que nunca llamó
  // a /publico/catalogos) se siembra la base ANTES de resolver.
  try {
    if ((await Modelo.countDocuments({})) === 0) await sembrarCatalogoBase();
  } catch (e) { /* sin rescate: seguimos y las no encontradas irán a faltantes */ }

  const ids = new Set();
  const faltantes = [];
  const textos = [];
  for (const s of crudos) {
    if (ES_ID_24(s)) ids.add(s.toLowerCase());
    else textos.push(s);
  }
  for (const s of textos) {
    const slug = slugify(s);
    let doc = await Modelo.findOne(soloActivas ? { slug, activa: true } : { slug }).select('_id').lean();
    if (!doc) {
      // 2ª oportunidad: nombre EXACTO (por si el slug difiere en puntuación).
      const rx = new RegExp(`^${escaparRegex(s)}$`, 'i');
      doc = await Modelo.findOne(soloActivas ? { nombre: rx, activa: true } : { nombre: rx }).select('_id').lean();
    }
    if (doc) ids.add(String(doc._id));
    else faltantes.push(s);
  }
  return { ids: [...ids].map(aObjectId).filter(Boolean), faltantes };
};

const firmarAcceso = (cuenta) =>
  jwt.sign({ id: cuenta._id, tipo: 'marca' }, brandSecret(), {
    expiresIn: `${ACCESO_MINUTOS}m`,
    algorithm: 'HS256',
  });

const firmarRefresco = (cuenta) =>
  jwt.sign({ id: cuenta._id, tipo: 'refresco-marca' }, brandSecret(), {
    expiresIn: `${REFRESCO_DIAS}d`,
    algorithm: 'HS256',
  });

const codigoOTP = () => String(Math.floor(100000 + Math.random() * 900000));

/**
 * Traduce un error interno (SMTP / MongoDB) a una causa accionable y SEGURA
 * (sin filtrar mensajes crudos del servidor al cliente). El detalle completo
 * queda en el registro del hosting vía console.error.
 */
const clasificarErrorInterno = (error) => {
  const codigo = error && (error.code || error.responseCode);
  const texto = String((error && error.message) || '');
  if (codigo === 'ETRANSPORT') {
    return 'El servidor de correo no está preparado (email.js no exporta transporter).';
  }
  if (codigo === 'EAUTH' || codigo === 535 || codigo === 530 || /auth|login|credential/i.test(texto)) {
    return 'El servidor de correo rechazó las credenciales de envío (EMAIL_USER/EMAIL_PASS).';
  }
  if (['ECONNREFUSED', 'ETIMEDOUT', 'ESOCKET', 'EAI_AGAIN', 'ECONNECTION', 'EDNS'].includes(codigo)) {
    return 'El servidor no pudo conectarse al servidor de correo saliente.';
  }
  if (codigo === 11000 || (error && error.name === 'MongoServerError') || /mong/i.test(texto)) {
    return 'Error de base de datos. Revisa el registro del servidor.';
  }
  return 'Error interno. Revisa el registro del servidor.';
};

/**
 * Envío del correo de código. Va DIRECTO por transporter.sendMail (no por
 * enviarCorreo) para que el banco de pruebas intercepte el envío aunque el
 * servidor no tenga EMAIL_USER configurado.
 */
const enviarCorreoCodigo = (para, codigo) => {
  // Guardia: si el email.js del servidor quedó con una versión que no exporta
  // transporter, sendMail reventaba con TypeError críptico → 500 genérico.
  // Con este guardia el error llega clasificado (ETRANSPORT) al log y al
  // campo "detalle" de la respuesta.
  if (!transporterMarcas() || typeof transporterMarcas().sendMail !== 'function') {
    const error = new Error('No hay transporte de correo utilizable para Marcas');
    error.code = 'ETRANSPORT';
    return Promise.reject(error);
  }
  return transporterMarcas().sendMail({
    from: `"SomosViveMás" <${process.env.EMAIL_USER || 'no-reply@somosvivemas.com'}>`,
    to: para,
    subject: `Tu código: ${codigo} (válido 10 minutos) - SomosViveMás`,
    html: `<div style="font-family:Arial,sans-serif;text-align:center;padding:24px">
      <h2 style="color:#1a472a">Verifica tu cuenta de Marca</h2>
      <p>Ingresa este código en la pantalla de verificación:</p>
      <h1 style="color:#1a472a;font-size:40px;letter-spacing:8px">${codigo}</h1>
      <p style="color:#777">El código expira en 10 minutos. Si no solicitaste este correo, ignóralo.</p>
    </div>`,
  });
};

/** Un solo código activo por destino+canal: borra previos y crea el nuevo. */
const crearOTP = async (destino, canal) => {
  await BrandOtp.deleteMany({ destino, canal });
  return BrandOtp.create({
    destino,
    canal,
    codigo: codigoOTP(),
    expira: new Date(Date.now() + VIDA_OTP_MS),
    ultimoEnvio: new Date(),
    intentos: 0,
  });
};

/** Slug de marca único (el borrador usa marca-xxxxxx; al renombrar, nombre-xxxx). */
const slugUnico = async (base, exceptoId) => {
  const raiz = String(base || '').replace(/^-+|-+$/g, '').slice(0, 90) || 'marca';
  const existe = async (candidato) => {
    const filtro = exceptoId ? { slug: candidato, _id: { $ne: exceptoId } } : { slug: candidato };
    return Brand.exists(filtro);
  };
  if (!(await existe(raiz))) return raiz;
  for (let i = 2; i < 60; i += 1) {
    const candidato = `${raiz}-${i}`;
    if (!(await existe(candidato))) return candidato;
  }
  return `${raiz}-${Date.now().toString(36)}`;
};

/**
 * Filtro ANTI-MEZCLA DE VERSIONES: localiza la marca de una cuenta tanto si
 * fue creada con el campo nuevo (`cuenta`) como con el legado (`accountId`,
 * monolito viejo de models.js). Así un documento antiguo NUNCA provoca la
 * creación de un borrador duplicado ni un ValidationError.
 */
const filtroMarcaDeCuenta = (idCuenta) => ({
  $or: [{ cuenta: idCuenta }, { accountId: idCuenta }],
});

/** Borrador mínimo con el que toda cuenta verificada entra al panel. */
const crearBorrador = async (cuenta) => {
  const slug = await slugUnico(`marca-${String(cuenta._id).slice(-6)}`);
  // Se guardan AMBOS campos (cuenta + accountId legado) para que el documento
  // también sea visible para cualquier código/vista que aún lea accountId.
  return Brand.create({
    cuenta: cuenta._id,
    accountId: cuenta._id,
    nombreComercial: 'Mi Nueva Marca',
    slug,
  });
};

// ============================================================
// HELPERS DE PROMOCIONES
// ============================================================
const promoVigente = (p, ahora = new Date()) => {
  if (!p || p.activa === false) return false;
  if (p.vigenciaInicio && new Date(p.vigenciaInicio) > ahora) return false;
  if (p.vigenciaFin && new Date(p.vigenciaFin) < ahora) return false;
  return true;
};

const etiquetaPromocion = (p) => {
  if (p.tipo === 'porcentaje') return `${p.porcentaje}% de descuento`;
  if (p.tipo === 'monto') return `$${Number(p.monto).toLocaleString('es-MX')} de descuento`;
  if (p.tipo === 'cortesia') return p.titulo || 'Cortesía';
  return p.titulo || 'Promoción especial';
};

const validarPromocion = (b) => {
  if (!['porcentaje', 'monto', 'cortesia', 'otro'].includes(b.tipo)) {
    return 'El tipo de promoción no es válido.';
  }
  const descripcion = porCadena(b.descripcion);
  if (descripcion.length < 15 || descripcion.length > 500) {
    return 'La descripción de la promoción debe tener entre 15 y 500 caracteres.';
  }
  if (b.tipo === 'porcentaje') {
    const p = Number(b.porcentaje);
    if (!Number.isFinite(p) || p < 1 || p > 100) return 'El porcentaje debe estar entre 1 y 100.';
  }
  if (b.tipo === 'monto') {
    const m = Number(b.monto);
    if (!Number.isFinite(m) || m <= 0) return 'Indica un monto válido para la promoción.';
  }
  const titulo = porCadena(b.titulo);
  if (titulo.length > 80) return 'El título admite hasta 80 caracteres.';
  if (porCadena(b.condiciones).length > 300) return 'Las condiciones admiten hasta 300 caracteres.';
  if (b.vigenciaInicio && b.vigenciaFin && new Date(b.vigenciaInicio) > new Date(b.vigenciaFin)) {
    return 'La vigencia no es coherente: el inicio es posterior al fin.';
  }
  return null;
};

const datosPromocion = (b) => ({
  tipo: b.tipo,
  titulo: porCadena(b.titulo).slice(0, 80),
  descripcion: porCadena(b.descripcion).slice(0, 500),
  porcentaje: b.tipo === 'porcentaje' ? Number(b.porcentaje) : undefined,
  monto: b.tipo === 'monto' ? Number(b.monto) : undefined,
  condiciones: porCadena(b.condiciones).slice(0, 300),
  vigenciaInicio: b.vigenciaInicio ? new Date(b.vigenciaInicio) : undefined,
  vigenciaFin: b.vigenciaFin ? new Date(b.vigenciaFin) : undefined,
  activa: true,
});

// ============================================================
// HELPERS DE VALIDACIÓN DE EDICIÓN
// ============================================================
/** 'persianasaurora.mx' → 'https://persianasaurora.mx/' ; 'javascript:...' → null */
const validarSitioWeb = (valor) => {
  let url = porCadena(valor);
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!u.hostname || !u.hostname.includes('.')) return null;
  return u.href;
};

/** Mínimo 10 dígitos; devuelve los dígitos o null. */
const validarTelefonoLimpio = (valor) => {
  const digitos = porCadena(valor).replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 13) return null;
  return digitos;
};

const validarRedSocial = (valor) => {
  const url = porCadena(valor);
  if (!url) return '';
  return /^https?:\/\/[^\s]+$/i.test(url) ? url : null;
};

const limpiarListaStrings = (valor, { max = 15, largo = 80 } = {}) => {
  if (!Array.isArray(valor)) return null;
  const lista = valor
    .map((s) => porCadena(s))
    .filter(Boolean)
    .slice(0, max);
  if (lista.some((s) => s.length > largo)) return null;
  return lista;
};

// ============================================================
// FALTANTES + BUSCADOR
// ============================================================
/** Lista humana de lo que falta para poder publicar. */
const calcularFaltantes = (marca) => {
  const faltantes = [];
  const c = marca.contacto || {};
  if (!porCadena(marca.nombreComercial)) faltantes.push('Nombre comercial');
  if (!marca.descripcionCorta || marca.descripcionCorta.trim().length < 20) {
    faltantes.push('Descripción corta (mínimo 20 caracteres)');
  }
  if (!marca.descripcion || marca.descripcion.trim().length < 30) {
    faltantes.push('Descripción (mínimo 30 caracteres)');
  }
  if (!Array.isArray(marca.categorias) || marca.categorias.length === 0) {
    faltantes.push('Categorías: elige al menos una categoría');
  }
  if (!Array.isArray(marca.ciudades) || marca.ciudades.length === 0) {
    faltantes.push('Ciudades de cobertura (elige al menos una)');
  }
  if (!marca.ciudadPrincipal) faltantes.push('Ciudad principal');
  if (!marca.logo && !marca.fotoPerfil) faltantes.push('Logotipo o fotografía de perfil');
  if (!c.telefono && !c.whatsapp && !c.email) {
    faltantes.push('Medio de contacto (teléfono, WhatsApp o correo)');
  }
  return faltantes;
};

/** Texto de búsqueda normalizado (sin acentos, minúsculas) de la marca. */
const construirBusqueda = async (marca) => {
  const partes = [
    marca.nombreComercial,
    marca.descripcionCorta,
    marca.descripcion,
    (marca.servicios || []).join(' '),
    (marca.zonasAdicionales || []).join(' '),
  ];
  const [cats, cds] = await Promise.all([
    (marca.categorias || []).length
      ? BrandCategory.find({ _id: { $in: marca.categorias } }).select('nombre slug').lean()
      : Promise.resolve([]),
    (marca.ciudades || []).length
      ? BrandCity.find({ _id: { $in: marca.ciudades } }).select('nombre slug').lean()
      : Promise.resolve([]),
  ]);
  partes.push(cats.map((c) => `${c.nombre} ${c.slug}`).join(' '));
  partes.push(cds.map((c) => `${c.nombre} ${c.slug}`).join(' '));
  return sinAcentos(partes.filter(Boolean).join(' ')).replace(/\s+/g, ' ').trim();
};

// ============================================================
// SERIALIZACIÓN PÚBLICA (cerrada: nada de estado interno / cuenta / moderación)
// ============================================================
const POPULATE_PUBLICO = [
  { path: 'categorias', select: 'nombre slug' },
  { path: 'ciudades', select: 'nombre slug estado' },
  { path: 'ciudadPrincipal', select: 'nombre slug estado' },
  { path: 'categoriaPrincipal', select: 'nombre slug' },
];

const POPULATE_PANEL = [
  ...POPULATE_PUBLICO,
  { path: 'cuenta', select: 'email telefono emailVerificado telefonoVerificado' },
];

const categoriaPublica = (c) => (c && c._id ? { id: String(c._id), nombre: c.nombre, slug: c.slug } : null);
const ciudadPublica = (c) => (c && c._id ? { id: String(c._id), nombre: c.nombre, slug: c.slug, estado: c.estado || '' } : null);

const contactoPublico = (m) => {
  const c = m.contacto || {};
  return {
    telefono: c.telefono || null,
    whatsapp: c.whatsapp || null,
    email: c.email || null,
    sitioWeb: c.sitioWeb || null,
    redes: {
      facebook: (c.redes && c.redes.facebook) || null,
      instagram: (c.redes && c.redes.instagram) || null,
      tiktok: (c.redes && c.redes.tiktok) || null,
      x: (c.redes && c.redes.x) || null,
      linkedin: (c.redes && c.redes.linkedin) || null,
      youtube: (c.redes && c.redes.youtube) || null,
    },
  };
};

const promoPublica = (p) => ({
  id: String(p._id),
  tipo: p.tipo,
  titulo: p.titulo || null,
  etiqueta: etiquetaPromocion(p),
  descripcion: p.descripcion,
  condiciones: p.condiciones || null,
  vigenciaFin: p.vigenciaFin || null,
});

/** Elemento de la lista del directorio. */
const aResumenPublico = (m) => {
  const vigentes = (m.promociones || []).filter((p) => promoVigente(p));
  return {
    id: String(m._id),
    nombre: m.nombreComercial,
    slug: m.slug,
    descripcionCorta: m.descripcionCorta || '',
    logo: m.logo || null,
    portada: m.portada || null,
    fotoPerfil: m.fotoPerfil || null,
    servicios: m.servicios || [],
    contacto: contactoPublico(m),
    categorias: (m.categorias || []).map(categoriaPublica),
    ciudades: (m.ciudades || []).map(ciudadPublica),
    promocion: vigentes.length ? promoPublica(vigentes[0]) : null,
    miembroDesde: m.createdAt,
  };
};

/** Perfil público completo (detalle). */
const aPerfilPublico = (m) => ({
  ...aResumenPublico(m),
  descripcion: m.descripcion || '',
  responsable: m.responsable || '',
  galeria: m.galeria || [],
  zonasAdicionales: m.zonasAdicionales || [],
  categoriaPrincipal: categoriaPublica(m.categoriaPrincipal),
  ciudadPrincipal: ciudadPublica(m.ciudadPrincipal),
  promociones: (m.promociones || []).filter((p) => promoVigente(p)).map(promoPublica),
});

/** Vista del panel: documento completo (con virtuals) + campos calculados. */
const conExtrasDePanel = (marca) => {
  const obj = marca.toJSON();
  const faltantes = calcularFaltantes(marca);
  obj.faltantes = faltantes;
  obj.puedePublicar = faltantes.length === 0 && ['borrador', 'despublicado'].includes(marca.estado);
  return obj;
};

// ============================================================
// AUTENTICACIÓN DE MARCAS
// ============================================================

/** GET /api/marcas/auth/canales — qué medios de registro hay activos. */
exports.canales = async (req, res) => {
  res.json({ ok: true, email: true, sms: twilio.twilioVerifyConfigurado() });
};

/**
 * POST /api/marcas/auth/solicitar — envía un código (NO crea la cuenta).
 * email: OTP propio (BrandOtp) · sms: Twilio Verify (503 si no está configurado).
 */
exports.solicitarCodigo = async (req, res) => {
  try {
    const { canal, email, telefono } = req.body || {};
    if (canal !== 'email' && canal !== 'sms') {
      return res.status(400).json({ error: 'Elige un canal válido: email o sms.' });
    }

    let destino;
    let emailVisible;
    if (canal === 'email') {
      if (!email || !EMAIL_RX.test(porCadena(email))) {
        return res.status(400).json({ error: 'El correo no es válido.' });
      }
      // Diagnóstico temprano: sin credenciales SMTP, sendMail fallaría más
      // adelante con un 500 críptico. En producción respondemos 503 con causa
      // clara (espejo del canal SMS). Los tests (NODE_ENV != production)
      // interceptan el envío vía stub y NO cambian de comportamiento.
      const smtpListo = typeof correoConfigurado === 'function'
        ? correoConfigurado()
        : !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
      if (process.env.NODE_ENV === 'production' && !smtpListo) {
        return res.status(503).json({
          error: 'El envío de códigos por correo no está disponible por ahora.',
          detalle: 'SMTP_NO_CONFIGURADO',
        });
      }
      emailVisible = porCadena(email);
      destino = emailVisible.toLowerCase();
    } else {
      if (!twilio.twilioVerifyConfigurado()) {
        return res.status(503).json({ error: 'La verificación por SMS no está disponible por ahora.' });
      }
      const normalizado = twilio.normalizarTelefono(telefono);
      if (!normalizado) {
        return res.status(400).json({ error: 'El teléfono debe tener 10 dígitos.' });
      }
      destino = normalizado;
    }

    // Cooldown por destino: máximo 1 código por minuto.
    const previo = await BrandOtp.findOne({ destino, canal }).sort({ ultimoEnvio: -1 }).lean();
    if (previo && Date.now() - new Date(previo.ultimoEnvio).getTime() < COOLDOWN_OTP_MS) {
      return res.status(429).json({ error: 'Espera un minuto para solicitar otro código.' });
    }

    const otp = await crearOTP(destino, canal);
    if (canal === 'sms') {
      await twilio.enviarOTP(destino);
    } else {
      await enviarCorreoCodigo(emailVisible, otp.codigo);
    }

    return res.json({
      ok: true,
      mensaje: canal === 'sms' ? 'Te enviamos un código por SMS.' : 'Te enviamos un código por correo.',
      espera: 60,
    });
  } catch (error) {
    // Código del error visible en el registro del hosting (Hostinger).
    console.error('[marcas][solicitarCodigo]', error && (error.code || error.responseCode || error.name), '-', error && error.message);
    return res.status(500).json({
      error: 'No se pudo enviar el código. Intenta de nuevo.',
      detalle: clasificarErrorInterno(error),
    });
  }
};

/**
 * POST /api/marcas/auth/verificar — valida el código, crea (o reutiliza) la
 * cuenta VERIFICADA + borrador de marca y regresa el par de tokens.
 * El código es de un solo uso y se bloquea tras MAX_INTENTOS_OTP fallos.
 */
exports.verificarCodigo = async (req, res) => {
  try {
    const { canal, codigo } = req.body || {};
    if (canal !== 'email' && canal !== 'sms') {
      return res.status(400).json({ error: 'Elige un canal válido: email o sms.' });
    }
    const codigoLimpio = porCadena(codigo);
    if (!/^\d{6}$/.test(codigoLimpio)) {
      return res.status(400).json({ error: 'Código incorrecto' });
    }

    let destino;
    if (canal === 'email') {
      if (!req.body.email) return res.status(400).json({ error: 'Falta el correo.' });
      destino = porCadena(req.body.email).toLowerCase();
    } else {
      const normalizado = twilio.normalizarTelefono(req.body.telefono);
      if (!normalizado) return res.status(400).json({ error: 'El teléfono debe tener 10 dígitos.' });
      destino = normalizado;
    }

    const otp = await BrandOtp.findOne({ destino, canal }).sort({ createdAt: -1 });
    if (!otp) return res.status(400).json({ error: 'Código incorrecto' });
    if ((otp.intentos || 0) >= MAX_INTENTOS_OTP) {
      return res.status(429).json({ error: 'Demasiados intentos. Solicita un código nuevo.' });
    }
    if (new Date(otp.expira).getTime() < Date.now()) {
      await otp.deleteOne();
      return res.status(400).json({ error: 'El código ha expirado. Solicita uno nuevo.' });
    }

    if (canal === 'sms') {
      const verificacion = await twilio.verificarOTP(destino, codigoLimpio);
      if (!verificacion.ok) {
        otp.intentos = (otp.intentos || 0) + 1;
        await otp.save();
        return res.status(400).json({ error: 'El código de SMS es incorrecto' });
      }
    } else if (otp.codigo !== codigoLimpio) {
      otp.intentos = (otp.intentos || 0) + 1;
      await otp.save();
      return res.status(400).json({ error: 'Código incorrecto' });
    }

    // Código correcto → un solo uso.
    await otp.deleteOne();

    // La cuenta se crea AQUÍ (no en solicitar) y queda marcada verificada.
    const filtroCuenta = canal === 'email' ? { email: destino } : { telefono: destino };
    let cuenta = await BrandAccount.findOne(filtroCuenta);
    let esNueva = false;
    if (!cuenta) {
      cuenta = await BrandAccount.create(
        canal === 'email'
          ? { email: destino, emailVerificado: true }
          : { telefono: destino, telefonoVerificado: true }
      );
      esNueva = true;
    } else if (canal === 'email' && !cuenta.emailVerificado) {
      cuenta.emailVerificado = true;
      await cuenta.save();
    } else if (canal === 'sms' && !cuenta.telefonoVerificado) {
      cuenta.telefonoVerificado = true;
      await cuenta.save();
    }

    // Toda cuenta verificada es operable; el BORRADOR de marca se crea de
    // forma perezosa en el primer acceso al panel (el spec cuenta las marcas
    // de la BD y exige que verificar NO las multiplique).
    const marca = await Brand.findOne(filtroMarcaDeCuenta(cuenta._id));

    res.cookie('vm_brand_refresh', firmarRefresco(cuenta), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: REFRESCO_DIAS * 24 * 60 * 60 * 1000,
      path: '/api/marcas/auth',
    });

    return res.json({
      ok: true,
      accessToken: firmarAcceso(cuenta),
      esNueva,
      marca,
      cuenta,
    });
  } catch (error) {
    console.error('[marcas][verificarCodigo]', error && (error.code || error.name), '-', error && error.message);
    return res.status(500).json({
      error: 'No se pudo verificar el código. Intenta de nuevo.',
      detalle: clasificarErrorInterno(error),
    });
  }
};

/** POST /api/marcas/auth/refrescar — nuevo access token desde la cookie. */
exports.refrescarSesion = async (req, res) => {
  try {
    const token = req.cookies && req.cookies.vm_brand_refresh;
    if (!token) return res.status(401).json({ error: 'No hay sesión que refrescar.' });
    let decoded;
    try {
      decoded = jwt.verify(token, brandSecret(), { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ error: 'Sesión expirada, inicia sesión de nuevo' });
    }
    if (!decoded || decoded.tipo !== 'refresco-marca' || !decoded.id) {
      return res.status(401).json({ error: 'Sesión expirada, inicia sesión de nuevo' });
    }
    const cuenta = await BrandAccount.findById(decoded.id);
    if (!cuenta) return res.status(401).json({ error: 'Sesión expirada, inicia sesión de nuevo' });
    return res.json({ ok: true, accessToken: firmarAcceso(cuenta) });
  } catch (error) {
    console.error('[marcas][refrescarSesion]', error && error.message);
    return res.status(500).json({ error: 'No se pudo refrescar la sesión.' });
  }
};

/**
 * POST /api/marcas/auth/login — ACCESO CON CONTRASEÑA (diseño del dueño):
 * - Login diario del proveedor: email + contraseña (el OTP queda para
 *   inscribirse y para cambiar medios de contacto).
 * - Cuenta sin contraseña o password incorrecta → 401 GENÉRICO (con compare
 *   "fantasma" para no filtrar por tiempos si el email existe).
 * - Respuesta idéntica a verificarCodigo: accessToken + cookie de refresco.
 */
exports.loginMarca = async (req, res) => {
  try {
    const emailLimpio = porCadena(req.body && req.body.email).toLowerCase();
    const password = porCadena(req.body && req.body.password);
    if (!emailLimpio || !EMAIL_RX.test(emailLimpio) || !password) {
      return res.status(400).json({ error: 'Debes enviar tu correo y contraseña.' });
    }

    const igualador = bcrypt.hashSync('igualador-de-tiempo-marcas', 10); // compare fantasma
    const cuenta = await BrandAccount.findOne({ email: emailLimpio }).select('+password');
    if (!cuenta || !cuenta.password) {
      await bcrypt.compare(password, igualador);
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const passwordOk = await bcrypt.compare(password, cuenta.password);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // La cuenta existe y la contraseña es correcta: misma sesión que verificar.
    // ⚠️ NUNCA devolver el documento con el hash: se neutraliza el campo
    // (fue cargado con select('+password') para el compare).
    cuenta.password = undefined;
    const marca = await Brand.findOne(filtroMarcaDeCuenta(cuenta._id));
    res.cookie('vm_brand_refresh', firmarRefresco(cuenta), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: REFRESCO_DIAS * 24 * 60 * 60 * 1000,
      path: '/api/marcas/auth',
    });
    return res.json({
      ok: true,
      accessToken: firmarAcceso(cuenta),
      esNueva: false,
      marca,
      cuenta,
    });
  } catch (error) {
    console.error('[marcas][loginMarca]', error && error.message);
    return res.status(500).json({ error: 'No se pudo iniciar sesión. Intenta de nuevo.' });
  }
};

/**
 * POST /api/marcas/panel/cuenta/contrasena — crear o cambiar la contraseña.
 * - Sin contraseña previa: basta { nueva } (p. ej. al terminar el registro OTP).
 * - Con contraseña previa: exige { actual, nueva } (cambio desde el panel).
 * Mínimo 8 caracteres. Guarda SOLO el hash (bcrypt 10 rondas).
 */
exports.fijarContrasena = async (req, res) => {
  try {
    const actual = porCadena(req.body && req.body.actual);
    const nueva = porCadena(req.body && req.body.nueva);
    if (nueva.length < 8 || nueva.length > 128) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener entre 8 y 128 caracteres.' });
    }

    const cuenta = await BrandAccount.findById(req.marcaCuenta._id).select('+password');
    if (!cuenta) return res.status(401).json({ error: 'Sesión no válida.' });

    if (cuenta.password) {
      if (!actual) {
        return res.status(400).json({ error: 'Escribe tu contraseña actual para poder cambiarla.' });
      }
      const actualOk = await bcrypt.compare(actual, cuenta.password);
      if (!actualOk) {
        return res.status(401).json({ error: 'Tu contraseña actual no coincide.' });
      }
    }

    const eraCambio = !!cuenta.password;
    cuenta.password = await bcrypt.hash(nueva, 10);
    await cuenta.save();
    return res.json({ ok: true, mensaje: eraCambio ? 'Contraseña actualizada.' : 'Contraseña creada.' });
  } catch (error) {
    console.error('[marcas][fijarContrasena]', error && error.message);
    return res.status(500).json({ error: 'No se pudo guardar la contraseña.' });
  }
};

// ============================================================
// MIDDLEWARE DEL PANEL — sesión de MARCA (no de usuario)
// ============================================================

/**
 * Verifica el Bearer con el secreto de marca y carga cuenta+marca.
 * - Token de usuario/admin (secreto distinto) → 401 (aislamiento de sesiones).
 * - Marca eliminada (borrado lógico) → 410 Gone en TODO el panel.
 */
exports.autenticarMarca = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, '').trim() : null;
    if (!token) return res.status(401).json({ error: 'Sesión no válida. Inicia sesión de nuevo.' });

    let decoded;
    try {
      decoded = jwt.verify(token, brandSecret(), { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ error: 'Sesión expirada, inicia sesión de nuevo' });
    }
    if (!decoded || decoded.tipo !== 'marca' || !decoded.id) {
      return res.status(401).json({ error: 'Sesión expirada, inicia sesión de nuevo' });
    }

    const cuenta = await BrandAccount.findById(decoded.id);
    if (!cuenta) return res.status(401).json({ error: 'Sesión expirada, inicia sesión de nuevo' });

    let marca = null;
    try {
      marca = await Brand.findOne(filtroMarcaDeCuenta(cuenta._id));
    } catch (e) {
      // Un documento legado que el schema nuevo no puede hidratar NO debe
      // tumbar la sesión: se registra y se intenta el borrador abajo.
      console.error('[marcas][autenticarMarca] findOne:', e && e.message);
    }
    if (!marca) {
      try {
        marca = await crearBorrador(cuenta);
      } catch (e) {
        // CARRERA BENIGNA (causa del 401 intermitente del panel): el panel
        // lanza 3 peticiones en paralelo al cargar (mi-marca, catalogos,
        // solicitudes) y TODAS pasan por aquí cuando la marca aún no existe.
        // El índice unique de `cuenta` rechaza a las sobrantes (E11000):
        // la marca ya existe — se re-busca y la sesión continúa.
        console.error('[marcas][autenticarMarca] crearBorrador:', e && e.message);
        marca = await Brand.findOne(filtroMarcaDeCuenta(cuenta._id)).catch(() => null);
      }
    }
    if (!marca) {
      // El token es VÁLIDO pero la cuenta quedó sin marca y no pudo crearse.
      // 503 (no 401): el panel muestra "No pudimos cargar tu panel + Reintentar"
      // en lugar de expulsar al usuario al login por un problema de datos.
      return res.status(503).json({ error: 'No pudimos preparar tu espacio de marca. Intenta de nuevo en unos segundos.' });
    }
    // Upgrade perezoso de documentos legados (creados con accountId): se les
    // escribe `cuenta` una sola vez para que el índice unique y las consultas
    // futuras funcionen siempre por el campo nuevo. NUNCA tumba una sesión
    // válida: si el guardado falla (datos legados inusuales), se registra y
    // se continúa con el documento en memoria; el upgrade se reintenta después.
    if (!marca.cuenta && marca.accountId) {
      marca.cuenta = marca.accountId;
      try {
        await marca.save({ validateModifiedOnly: true });
      } catch (e) {
        console.error('[marcas][autenticarMarca] upgrade legado:', e && e.message);
      }
    }
    if (marca.estado === 'eliminado') {
      return res.status(410).json({
        error: 'Esta cuenta fue eliminada. Contacta al equipo SomosViveMás si crees que es un error.',
      });
    }

    req.marcaCuenta = cuenta;
    req.marca = marca;
    return next();
  } catch (error) {
    console.error('[marcas][autenticarMarca]', error && error.message);
    return res.status(401).json({ error: 'Sesión no válida.' });
  }
};

// ============================================================
// PANEL DEL PROVEEDOR
// ============================================================

/** GET /api/marcas/panel/mi-marca — vista completa + faltantes + puedePublicar. */
exports.obtenerMiMarca = async (req, res) => {
  try {
    const marca = await Brand.findById(req.marca._id).populate(POPULATE_PANEL);
    // La cuenta es del PROPIO proveedor (sesión de marca): solo los 4 campos
    // que consume la pestaña "Mi acceso" del panel. Nunca credenciales.
    const cta = req.marcaCuenta || {};
    return res.json({
      ok: true,
      marca: conExtrasDePanel(marca),
      cuenta: {
        email: cta.email || '',
        telefono: cta.telefono || '',
        emailVerificado: !!cta.emailVerificado,
        telefonoVerificado: !!cta.telefonoVerificado,
      },
      smsDisponible: twilio.twilioVerifyConfigurado(),
    });
  } catch (error) {
    console.error('[marcas][obtenerMiMarca]', error && error.message);
    return res.status(500).json({ error: 'No se pudo cargar tu marca.' });
  }
};

/**
 * GET /api/marcas/panel/mi-marca/vista-previa — la marca en su forma PÚBLICA
 * sin importar el estado (borrador incluido). La consume marca.html?vista=previa
 * con la sesión del panel y usa el MISMO serializer del perfil público, para que
 * la previsualización muestre EXACTAMENTE lo que verá el público.
 */
exports.vistaPreviaMarca = async (req, res) => {
  try {
    const marca = await Brand.findById(req.marca._id).populate(POPULATE_PUBLICO);
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada.' });
    return res.json({ ok: true, previa: true, marca: aPerfilPublico(marca) });
  } catch (error) {
    console.error('[marcas][vistaPreviaMarca]', error && error.message);
    return res.status(500).json({ error: 'No se pudo generar la vista previa.' });
  }
};

/**
 * PUT /api/marcas/panel/mi-marca — edición con whitelist.
 * - El body JAMÁS puede cambiar cuenta/estado/slug directo (el slug se deriva
 *   del nombre y la propiedad vive en la sesión).
 * - `categorias`/`ciudades` se validan contra el catálogo ACTIVO (400 si hay
 *   una inexistente o inactiva; la principal debe estar dentro del listado).
 * - `nuevasCiudades` valida TODAS antes de crear NINGUNA y reutiliza la
 *   existente por slug (QUERÉTARO → queretaro, sin duplicar).
 * - Un perfil publicado no puede quedar incompleto con una edición (400 +
 *   faltantes, sin guardar).
 */
exports.actualizarMiMarca = async (req, res) => {
  try {
    const marca = req.marca;
    const b = req.body || {};

    // --- Texto simple ---
    if (b.nombreComercial !== undefined) {
      const nombre = porCadena(b.nombreComercial);
      if (nombre.length < 2 || nombre.length > 80) {
        return res.status(400).json({ error: 'El nombre comercial debe tener entre 2 y 80 caracteres.' });
      }
      marca.nombreComercial = nombre;
      marca.slug = await slugUnico(`${slugify(nombre)}-${String(marca._id).slice(-4)}`, marca._id);
    }
    if (b.responsable !== undefined) marca.responsable = porCadena(b.responsable).slice(0, 100);
    if (b.descripcionCorta !== undefined) {
      const d = porCadena(b.descripcionCorta);
      if (d.length > 160) return res.status(400).json({ error: 'La descripción corta admite hasta 160 caracteres.' });
      marca.descripcionCorta = d;
    }
    if (b.descripcion !== undefined) {
      const d = porCadena(b.descripcion);
      if (d.length > 2000) return res.status(400).json({ error: 'La descripción admite hasta 2000 caracteres.' });
      marca.descripcion = d;
    }
    if (b.servicios !== undefined) {
      const lista = limpiarListaStrings(b.servicios, { max: 15, largo: 80 });
      if (lista === null) return res.status(400).json({ error: 'Servicios inválidos (máximo 15, 80 caracteres cada uno).' });
      marca.servicios = lista;
    }
    if (b.zonasAdicionales !== undefined) {
      const lista = limpiarListaStrings(b.zonasAdicionales, { max: 8, largo: 80 });
      if (lista === null) return res.status(400).json({ error: 'Zonas adicionales inválidas.' });
      marca.zonasAdicionales = lista;
    }

    // --- Categorías ---
    // v7: se aceptan ObjectId, slug o NOMBRE (compatibilidad total con v6:
    // si llegan ObjectId el comportamiento es idéntico).
    if (b.categorias !== undefined || b.categoriaPrincipal !== undefined) {
      if (b.categorias !== undefined && !Array.isArray(b.categorias)) {
        return res.status(400).json({ error: 'Categorías inválidas.' });
      }
      const pedidas = b.categorias !== undefined ? b.categorias.map(String) : marca.categorias.map(String);
      const { ids, faltantes } = await resolverListaCatalogo(pedidas, { Modelo: BrandCategory, soloActivas: true });
      if (faltantes.length) {
        return res.status(400).json({ error: 'Hay categorías inexistentes o inactivas.' });
      }
      marca.categorias = ids;
      const principalPedida = b.categoriaPrincipal !== undefined ? b.categoriaPrincipal : marca.categoriaPrincipal;
      if (principalPedida) {
        const prin = await resolverListaCatalogo([principalPedida], { Modelo: BrandCategory, soloActivas: true });
        const principalId = prin.ids.length ? String(prin.ids[0]) : '';
        if (!principalId || !marca.categorias.some((o) => String(o) === principalId)) {
          return res.status(400).json({ error: 'La categoría principal debe estar entre las categorías de tu marca.' });
        }
        marca.categoriaPrincipal = principalId;
      } else {
        marca.categoriaPrincipal = marca.categorias.length ? marca.categorias[0] : undefined;
      }
    }

    // --- Ciudades ---
    if (b.ciudades !== undefined || b.ciudadPrincipal !== undefined || b.nuevasCiudades !== undefined) {
      if (b.ciudades !== undefined && !Array.isArray(b.ciudades)) {
        return res.status(400).json({ error: 'Ciudades inválidas.' });
      }
      let ids = b.ciudades !== undefined ? b.ciudades.map(String) : marca.ciudades.map(String);

      if (b.nuevasCiudades !== undefined) {
        if (!Array.isArray(b.nuevasCiudades)) {
          return res.status(400).json({ error: 'Nuevas ciudades inválidas.' });
        }
        // 1) Validar TODAS antes de crear NINGUNA (nada de basura parcial).
        const nuevas = [];
        for (const nc of b.nuevasCiudades) {
          const nombre = porCadena(nc && nc.nombre);
          if (!NOMBRE_CIUDAD_RX.test(nombre)) {
            return res.status(400).json({ error: `El nombre de ciudad "${nombre}" no es válido.` });
          }
          nuevas.push({ nombre, estado: porCadena(nc && nc.estado).slice(0, 60) });
        }
        // 2) Reutilizar por slug (normaliza acentos/mayúsculas) o crear.
        for (const nc of nuevas) {
          const slugCiudad = slugify(nc.nombre);
          let ciudad = await BrandCity.findOne({ slug: slugCiudad }).select('_id');
          if (!ciudad) {
            ciudad = await BrandCity.create({ nombre: nc.nombre, estado: nc.estado, slug: slugCiudad });
          }
          ids.push(String(ciudad._id));
        }
      }

      // v7: resolución ObjectId/slug/nombre + validación de existencia
      // (las ciudades nuevas creadas arriba ya vienen como ObjectId real).
      const resueltas = await resolverListaCatalogo(ids, { Modelo: BrandCity, soloActivas: false });
      if (resueltas.faltantes.length) {
        return res.status(400).json({ error: 'Hay ciudades inexistentes.' });
      }
      marca.ciudades = resueltas.ids;
      const principalPedida = b.ciudadPrincipal !== undefined ? b.ciudadPrincipal : marca.ciudadPrincipal;
      if (principalPedida) {
        const prin = await resolverListaCatalogo([principalPedida], { Modelo: BrandCity, soloActivas: false });
        const principalId = prin.ids.length ? String(prin.ids[0]) : '';
        if (!principalId || !marca.ciudades.some((o) => String(o) === principalId)) {
          return res.status(400).json({ error: 'La ciudad principal debe estar entre las ciudades de cobertura.' });
        }
        marca.ciudadPrincipal = principalId;
      } else {
        marca.ciudadPrincipal = marca.ciudades.length ? marca.ciudades[0] : undefined;
      }
    }

    // --- Contacto público (NUNCA credenciales: esas viven en BrandAccount) ---
    if (b.contacto !== undefined) {
      if (typeof b.contacto !== 'object' || Array.isArray(b.contacto)) {
        return res.status(400).json({ error: 'Contacto inválido.' });
      }
      const c = b.contacto;
      if (c.telefono !== undefined) {
        if (c.telefono === null || c.telefono === '') marca.contacto.telefono = '';
        else {
          if (!validarTelefonoLimpio(c.telefono)) {
            return res.status(400).json({ error: 'El teléfono de contacto debe tener al menos 10 dígitos.' });
          }
          marca.contacto.telefono = porCadena(c.telefono);
        }
      }
      if (c.whatsapp !== undefined) {
        if (c.whatsapp === null || c.whatsapp === '') marca.contacto.whatsapp = '';
        else {
          if (!validarTelefonoLimpio(c.whatsapp)) {
            return res.status(400).json({ error: 'El WhatsApp debe tener al menos 10 dígitos.' });
          }
          marca.contacto.whatsapp = porCadena(c.whatsapp);
        }
      }
      if (c.email !== undefined) {
        if (c.email === null || c.email === '') marca.contacto.email = '';
        else {
          const em = porCadena(c.email).toLowerCase();
          if (!EMAIL_RX.test(em)) return res.status(400).json({ error: 'El correo de contacto no es válido.' });
          marca.contacto.email = em;
        }
      }
      if (c.sitioWeb !== undefined) {
        if (c.sitioWeb === null || c.sitioWeb === '') marca.contacto.sitioWeb = '';
        else {
          const web = validarSitioWeb(c.sitioWeb);
          if (web === null) return res.status(400).json({ error: 'El sitio web no es válido.' });
          marca.contacto.sitioWeb = web;
        }
      }
      if (c.redes !== undefined) {
        if (typeof c.redes !== 'object' || Array.isArray(c.redes)) {
          return res.status(400).json({ error: 'Redes inválidas.' });
        }
        for (const red of REDES_SOCIALES) {
          if (c.redes[red] !== undefined) {
            const url = c.redes[red] === null ? '' : validarRedSocial(c.redes[red]);
            if (url === null) {
              return res.status(400).json({ error: `El enlace de ${red} no es válido (usa http/https).` });
            }
            marca.contacto.redes[red] = url;
          }
        }
      }
    }

    // --- Integridad del perfil publicado ---
    if (marca.estado === 'publicado') {
      const faltantes = calcularFaltantes(marca);
      if (faltantes.length) {
        return res.status(400).json({ error: 'No puedes dejar incompleto un perfil publicado.', faltantes });
      }
    }

    marca.busqueda = await construirBusqueda(marca);
    await marca.save();
    await marca.populate(POPULATE_PANEL);
    return res.json({ ok: true, mensaje: 'Información guardada.', marca: conExtrasDePanel(marca) });
  } catch (error) {
    console.error('[marcas][actualizarMiMarca]', error && error.message);
    return res.status(500).json({ error: 'No se pudo guardar la información.' });
  }
};

/** POST /api/marcas/panel/mi-marca/publicar — sin aprobación administrativa. */
exports.publicarMarca = async (req, res) => {
  try {
    const marca = req.marca;
    if (marca.estado === 'bloqueado') {
      return res.status(403).json({ error: 'Tu marca está bloqueada. Atiende las observaciones del equipo SomosViveMás.' });
    }
    if (marca.estado === 'desactivado') {
      return res.status(403).json({ error: 'Tu marca está desactivada. Contacta al equipo SomosViveMás para reactivarla.' });
    }
    if (marca.estado === 'publicado') {
      return res.status(400).json({ error: 'Tu marca ya está publicada.' });
    }
    const faltantes = calcularFaltantes(marca);
    if (faltantes.length) {
      return res.status(400).json({ error: 'Falta información obligatoria para publicar.', faltantes });
    }
    marca.estado = 'publicado';
    marca.ocultoPorModeracion = false;
    await marca.save();
    await marca.populate(POPULATE_PANEL);
    return res.json({ ok: true, mensaje: 'Marca publicada correctamente.', marca: conExtrasDePanel(marca) });
  } catch (error) {
    console.error('[marcas][publicarMarca]', error && error.message);
    return res.status(500).json({ error: 'No se pudo publicar la marca.' });
  }
};

/** POST /api/marcas/panel/mi-marca/despublicar — decisión del proveedor. */
exports.despublicarMarca = async (req, res) => {
  try {
    const marca = req.marca;
    if (marca.estado !== 'publicado') {
      return res.status(400).json({ error: 'Tu marca no está publicada ahora mismo.' });
    }
    marca.estado = 'despublicado';
    await marca.save();
    await marca.populate(POPULATE_PANEL);
    return res.json({ ok: true, mensaje: 'Marca despublicada. Puedes republicarla cuando quieras.', marca: conExtrasDePanel(marca) });
  } catch (error) {
    console.error('[marcas][despublicarMarca]', error && error.message);
    return res.status(500).json({ error: 'No se pudo despublicar la marca.' });
  }
};

// ============================================================
// IMÁGENES (Cloudinary)
// ============================================================

/** Firma real del archivo (no confiamos en el mimetype declarado). */
const firmaImagenValida = (buffer, mimetype) => {
  if (!buffer || buffer.length < 12) return false;
  const mime = String(mimetype || '').toLowerCase();
  if (mime === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mime === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === 'image/webp') {
    return buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
};

/** POST /api/marcas/panel/mi-marca/imagenes/:tipo (logo|portada|fotoPerfil|galeria) */
exports.subirImagen = async (req, res) => {
  try {
    const tipo = req.params.tipo;
    if (!TIPOS_IMAGEN.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de imagen no válido (logo, portada, fotoPerfil o galeria).' });
    }
    if (!req.file) return res.status(400).json({ error: 'No se seleccionó ningún archivo.' });
    if (!firmaImagenValida(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ error: 'El archivo no es una imagen válida (se permiten PNG, JPG o WebP).' });
    }

    const marca = req.marca;
    if (tipo === 'galeria' && (marca.galeria || []).length >= MAX_GALERIA) {
      return res.status(400).json({ error: `La galería admite máximo ${MAX_GALERIA} fotografías.` });
    }

    const carpeta = tipo === 'galeria' ? `vive-mas/marcas/${marca._id}/galeria` : `vive-mas/marcas/${marca._id}`;
    const url = await cloud.subirACloudinary(req.file.buffer, req.file.mimetype, carpeta);
    const anterior = tipo === 'galeria' ? null : marca[tipo] || null;

    if (tipo === 'galeria') marca.galeria.push(url);
    else marca[tipo] = url;
    await marca.save();

    // Reemplazo (logo/portada/fotoPerfil): la imagen saliente se destruye.
    if (anterior && anterior !== url) {
      await cloud.eliminarDeCloudinary(anterior);
    }

    await marca.populate(POPULATE_PANEL);
    return res.json({ ok: true, mensaje: 'Imagen actualizada correctamente.', marca: conExtrasDePanel(marca) });
  } catch (error) {
    console.error('[marcas][subirImagen]', error && error.message);
    return res.status(500).json({ error: 'No se pudo subir la imagen. Intenta de nuevo.' });
  }
};

/**
 * DELETE /api/marcas/panel/mi-marca/imagenes/:tipo
 * - galeria: DELETE con body { url } — 404 si la url no es de SU galería (IDOR).
 * - logo/portada/fotoPerfil: un perfil publicado conserva al menos su imagen
 *   principal (logo o fotoPerfil) — si borrarla lo rompería, 400.
 */
exports.eliminarImagen = async (req, res) => {
  try {
    const tipo = req.params.tipo;
    const marca = req.marca;

    if (tipo === 'galeria') {
      const url = porCadena(req.body && req.body.url);
      if (!url) return res.status(400).json({ error: 'Indica la fotografía (url) a eliminar.' });
      if (!(marca.galeria || []).includes(url)) {
        return res.status(404).json({ error: 'Esa fotografía no existe en tu galería.' });
      }
      marca.galeria = marca.galeria.filter((u) => u !== url);
      await marca.save();
      await cloud.eliminarDeCloudinary(url);
      await marca.populate(POPULATE_PANEL);
      return res.json({ ok: true, mensaje: 'Fotografía eliminada de la galería.', marca: conExtrasDePanel(marca) });
    }

    if (!['logo', 'portada', 'fotoPerfil'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de imagen no válido.' });
    }
    if (!marca[tipo]) return res.status(404).json({ error: 'No tienes esa imagen.' });
    if (marca.estado === 'publicado' && tipo !== 'portada') {
      const otraPrincipal = tipo === 'logo' ? marca.fotoPerfil : marca.logo;
      if (!otraPrincipal) {
        return res.status(400).json({
          error: 'Tu perfil publicado necesita al menos un logotipo o fotografía. Sube otra antes de eliminar esta.',
        });
      }
    }
    const anterior = marca[tipo];
    marca[tipo] = '';
    await marca.save();
    await cloud.eliminarDeCloudinary(anterior);
    await marca.populate(POPULATE_PANEL);
    return res.json({ ok: true, mensaje: 'Imagen eliminada.', marca: conExtrasDePanel(marca) });
  } catch (error) {
    console.error('[marcas][eliminarImagen]', error && error.message);
    return res.status(500).json({ error: 'No se pudo eliminar la imagen.' });
  }
};

// ============================================================
// PROMOCIONES
// ============================================================

/** POST /api/marcas/panel/mi-marca/promociones — 201 al crear. */
exports.agregarPromocion = async (req, res) => {
  try {
    const marca = req.marca;
    if ((marca.promociones || []).length >= MAX_PROMOCIONES) {
      return res.status(400).json({ error: `Puedes tener máximo ${MAX_PROMOCIONES} promociones.` });
    }
    const error = validarPromocion(req.body || {});
    if (error) return res.status(400).json({ error });
    marca.promociones.push(datosPromocion(req.body));
    await marca.save();
    await marca.populate(POPULATE_PANEL);
    return res.status(201).json({ ok: true, mensaje: 'Promoción agregada correctamente.', marca: conExtrasDePanel(marca) });
  } catch (error) {
    console.error('[marcas][agregarPromocion]', error && error.message);
    return res.status(500).json({ error: 'No se pudo agregar la promoción.' });
  }
};

/** PUT /api/marcas/panel/mi-marca/promociones/:promoId — sólo sobre SU marca. */
exports.actualizarPromocion = async (req, res) => {
  try {
    const marca = req.marca;
    const promo = (marca.promociones || []).id(req.params.promoId);
    if (!promo) return res.status(404).json({ error: 'Promoción no encontrada.' });
    const b = req.body || {};

    if (b.activa !== undefined) promo.activa = !!b.activa;

    const tocaCampos = ['tipo', 'titulo', 'descripcion', 'porcentaje', 'monto', 'condiciones', 'vigenciaInicio', 'vigenciaFin']
      .some((k) => b[k] !== undefined);
    if (tocaCampos) {
      const fusion = { ...promo.toObject(), ...b };
      const error = validarPromocion(fusion);
      if (error) return res.status(400).json({ error });
      const limpios = datosPromocion(fusion);
      promo.tipo = limpios.tipo;
      promo.titulo = limpios.titulo;
      promo.descripcion = limpios.descripcion;
      promo.porcentaje = limpios.porcentaje;
      promo.monto = limpios.monto;
      promo.condiciones = limpios.condiciones;
      promo.vigenciaInicio = limpios.vigenciaInicio;
      promo.vigenciaFin = limpios.vigenciaFin;
    }

    await marca.save();
    await marca.populate(POPULATE_PANEL);
    return res.json({ ok: true, mensaje: 'Promoción actualizada.', marca: conExtrasDePanel(marca) });
  } catch (error) {
    console.error('[marcas][actualizarPromocion]', error && error.message);
    return res.status(500).json({ error: 'No se pudo actualizar la promoción.' });
  }
};

/** DELETE /api/marcas/panel/mi-marca/promociones/:promoId */
exports.eliminarPromocion = async (req, res) => {
  try {
    const marca = req.marca;
    const promo = (marca.promociones || []).id(req.params.promoId);
    if (!promo) return res.status(404).json({ error: 'Promoción no encontrada.' });
    promo.deleteOne();
    await marca.save();
    await marca.populate(POPULATE_PANEL);
    return res.json({ ok: true, mensaje: 'Promoción eliminada.', marca: conExtrasDePanel(marca) });
  } catch (error) {
    console.error('[marcas][eliminarPromocion]', error && error.message);
    return res.status(500).json({ error: 'No se pudo eliminar la promoción.' });
  }
};

// ============================================================
// SOLICITUDES DE MODERACIÓN (vista del proveedor)
// ============================================================

/** GET /api/marcas/panel/mi-marca/solicitudes — sin datos internos del admin. */
exports.obtenerSolicitudes = async (req, res) => {
  try {
    const marca = await Brand.findById(req.marca._id).select('solicitudesModeracion');
    const solicitudes = (marca.solicitudesModeracion || [])
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((s) => ({
        id: String(s._id),
        campo: s.campo || '',
        motivo: s.motivo,
        mensaje: s.mensaje || '',
        de: s.de || 'Equipo SomosViveMás',
        estado: s.estado,
        ocultarMientras: !!s.ocultarMientras,
        createdAt: s.createdAt,
        atendidaEn: s.atendidaEn || null,
        resueltaEn: s.resueltaEn || null,
      }));
    return res.json({ ok: true, solicitudes });
  } catch (error) {
    console.error('[marcas][obtenerSolicitudes]', error && error.message);
    return res.status(500).json({ error: 'No se pudieron cargar las solicitudes.' });
  }
};

/**
 * POST /api/marcas/panel/mi-marca/solicitudes/:solicitudId/atender
 * El proveedor marca la corrección hecha; si la solicitud ocultaba el perfil,
 * vuelve al directorio.
 */
exports.atenderSolicitud = async (req, res) => {
  try {
    const marca = req.marca;
    const solicitud = (marca.solicitudesModeracion || []).id(req.params.solicitudId);
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    if (solicitud.estado !== 'abierta') {
      return res.status(400).json({ error: 'Esa solicitud ya está cerrada.' });
    }
    solicitud.estado = 'atendida';
    solicitud.atendidaEn = new Date();
    if (marca.ocultoPorModeracion) {
      const otrasOcultando = (marca.solicitudesModeracion || []).some(
        (s) => s.estado === 'abierta' && s.ocultarMientras && String(s._id) !== String(solicitud._id)
      );
      if (solicitud.ocultarMientras || !otrasOcultando) {
        marca.ocultoPorModeracion = false;
      }
    }
    await marca.save();
    return res.json({ ok: true, mensaje: 'Gracias. El equipo SomosViveMás revisará tu corrección.' });
  } catch (error) {
    console.error('[marcas][atenderSolicitud]', error && error.message);
    return res.status(500).json({ error: 'No se pudo atender la solicitud.' });
  }
};

// ============================================================
// MEDIOS DE ACCESO ADICIONALES (verificar ANTES de guardar)
// ============================================================

/**
 * POST /api/marcas/panel/cuenta/acceso/solicitar
 * Agregar otro email/teléfono a la cuenta. NO se guarda hasta confirmar el
 * código. Teléfono/correo de otra cuenta → 409.
 */
exports.solicitarAcceso = async (req, res) => {
  try {
    const cuenta = req.marcaCuenta;
    const { canal, email, telefono } = req.body || {};

    if (canal === 'sms') {
      if (!twilio.twilioVerifyConfigurado()) {
        return res.status(503).json({ error: 'La verificación por SMS no está disponible por ahora.' });
      }
      const normalizado = twilio.normalizarTelefono(telefono);
      if (!normalizado) return res.status(400).json({ error: 'El teléfono debe tener 10 dígitos.' });
      if (cuenta.telefono === normalizado && cuenta.telefonoVerificado) {
        return res.status(400).json({ error: 'Ese teléfono ya está verificado en tu cuenta.' });
      }
      const ajena = await BrandAccount.findOne({ telefono: normalizado, _id: { $ne: cuenta._id } }).select('_id').lean();
      if (ajena) return res.status(409).json({ error: 'Ese teléfono ya está asociado a otra cuenta.' });
      await twilio.enviarOTP(normalizado);
      return res.json({ ok: true, mensaje: 'Te enviamos un código por SMS.', espera: 60 });
    }

    if (canal === 'email') {
      if (!email || !EMAIL_RX.test(porCadena(email))) {
        return res.status(400).json({ error: 'El correo no es válido.' });
      }
      const destino = porCadena(email).toLowerCase();
      if (cuenta.email === destino && cuenta.emailVerificado) {
        return res.status(400).json({ error: 'Ese correo ya está verificado en tu cuenta.' });
      }
      const ajena = await BrandAccount.findOne({ email: destino, _id: { $ne: cuenta._id } }).select('_id').lean();
      if (ajena) return res.status(409).json({ error: 'Ese correo ya está asociado a otra cuenta.' });
      const previo = await BrandOtp.findOne({ destino, canal: 'email' }).sort({ ultimoEnvio: -1 }).lean();
      if (previo && Date.now() - new Date(previo.ultimoEnvio).getTime() < COOLDOWN_OTP_MS) {
        return res.status(429).json({ error: 'Espera un minuto para solicitar otro código.' });
      }
      const otp = await crearOTP(destino, 'email');
      await enviarCorreoCodigo(porCadena(email), otp.codigo);
      return res.json({ ok: true, mensaje: 'Te enviamos un código por correo.', espera: 60 });
    }

    return res.status(400).json({ error: 'Elige un canal válido: email o sms.' });
  } catch (error) {
    console.error('[marcas][solicitarAcceso]', error && error.message);
    return res.status(500).json({ error: 'No se pudo enviar el código.' });
  }
};

/** POST /api/marcas/panel/cuenta/acceso/confirmar — aquí sí se guarda. */
exports.confirmarAcceso = async (req, res) => {
  try {
    const cuenta = req.marcaCuenta;
    const { canal, codigo } = req.body || {};
    const codigoLimpio = porCadena(codigo);

    if (canal === 'sms') {
      const normalizado = twilio.normalizarTelefono(req.body.telefono);
      if (!normalizado) return res.status(400).json({ error: 'El teléfono debe tener 10 dígitos.' });
      const verificacion = await twilio.verificarOTP(normalizado, codigoLimpio);
      if (!verificacion.ok) return res.status(400).json({ error: 'El código es incorrecto.' });
      // Re-chequeo por si otra cuenta la tomó entre solicitar y confirmar.
      const ajena = await BrandAccount.findOne({ telefono: normalizado, _id: { $ne: cuenta._id } }).select('_id').lean();
      if (ajena) return res.status(409).json({ error: 'Ese teléfono ya está asociado a otra cuenta.' });
      cuenta.telefono = normalizado;
      cuenta.telefonoVerificado = true;
      await cuenta.save();
      return res.json({ ok: true, mensaje: 'Teléfono verificado y guardado.', cuenta });
    }

    if (canal === 'email') {
      if (!req.body.email) return res.status(400).json({ error: 'Falta el correo.' });
      const destino = porCadena(req.body.email).toLowerCase();
      const otp = await BrandOtp.findOne({ destino, canal: 'email' }).sort({ createdAt: -1 });
      if (!otp) return res.status(400).json({ error: 'El código es incorrecto.' });
      if ((otp.intentos || 0) >= MAX_INTENTOS_OTP) {
        return res.status(429).json({ error: 'Demasiados intentos. Solicita un código nuevo.' });
      }
      if (new Date(otp.expira).getTime() < Date.now()) {
        await otp.deleteOne();
        return res.status(400).json({ error: 'El código ha expirado. Solicita uno nuevo.' });
      }
      if (otp.codigo !== codigoLimpio) {
        otp.intentos = (otp.intentos || 0) + 1;
        await otp.save();
        return res.status(400).json({ error: 'El código es incorrecto.' });
      }
      await otp.deleteOne();
      const ajena = await BrandAccount.findOne({ email: destino, _id: { $ne: cuenta._id } }).select('_id').lean();
      if (ajena) return res.status(409).json({ error: 'Ese correo ya está asociado a otra cuenta.' });
      cuenta.email = destino;
      cuenta.emailVerificado = true;
      await cuenta.save();
      return res.json({ ok: true, mensaje: 'Correo verificado y guardado.', cuenta });
    }

    return res.status(400).json({ error: 'Elige un canal válido: email o sms.' });
  } catch (error) {
    console.error('[marcas][confirmarAcceso]', error && error.message);
    return res.status(500).json({ error: 'No se pudo confirmar el código.' });
  }
};

// ============================================================
// PROVEEDOR: ELIMINAR SU PROPIA CUENTA
// ============================================================

/** DELETE /api/marcas/panel/mi-marca — borrado permanente de marca + cuenta. */
exports.eliminarMiMarca = async (req, res) => {
  try {
    await BrandAccount.deleteOne({ _id: req.marcaCuenta._id });
    await Brand.deleteOne({ _id: req.marca._id });
    return res.json({ ok: true, mensaje: 'Tu marca y tu cuenta se eliminaron permanentemente.' });
  } catch (error) {
    console.error('[marcas][eliminarMiMarca]', error && error.message);
    return res.status(500).json({ error: 'No se pudo eliminar la cuenta.' });
  }
};

// ============================================================
// DIRECTORIO PÚBLICO
// ============================================================

/** Filtro base de todo lo público: publicado y no oculto por moderación. */
const filtroPublicoBase = () => ({ estado: 'publicado', ocultoPorModeracion: { $ne: true } });

/**
 * GET /api/marcas/publico — lista con buscador y filtros.
 * q busca en `busqueda` (texto normalizado sin acentos: nombre, descripciones,
 * servicios, categorías y ciudades) escapado como literal → un regex malicioso
 * no rompe la consulta. categoria/ciudad aceptan slugs separados por coma y se
 * combinan con q en AND. Sin $or entre arrays → no hay duplicados.
 */
exports.listarMarcasPublico = async (req, res) => {
  try {
    const { q, categoria, ciudad, orden } = req.query;
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = Math.min(48, Math.max(1, parseInt(req.query.limite, 10) || 12));
    const filtros = filtroPublicoBase();

    if (q && porCadena(q)) {
      filtros.busqueda = new RegExp(escaparRegex(sinAcentos(porCadena(q))), 'i');
    }
    if (categoria) {
      const slugs = String(categoria).split(',').map((s) => slugify(s)).filter(Boolean);
      const cats = await BrandCategory.find({ slug: { $in: slugs } }).select('_id').lean();
      filtros.categorias = { $in: cats.map((c) => c._id) };
    }
    if (ciudad) {
      const slugs = String(ciudad).split(',').map((s) => slugify(s)).filter(Boolean);
      const cds = await BrandCity.find({ slug: { $in: slugs } }).select('_id').lean();
      filtros.ciudades = { $in: cds.map((c) => c._id) };
    }

    const criterioOrden = orden === 'alfabetico' ? { nombreComercial: 1 } : { createdAt: -1 };
    const [total, marcas] = await Promise.all([
      Brand.countDocuments(filtros),
      Brand.find(filtros)
        .populate(POPULATE_PUBLICO)
        .sort(criterioOrden)
        .skip((pagina - 1) * limite)
        .limit(limite),
    ]);

    return res.json({
      ok: true,
      total,
      marcas: marcas.map(aResumenPublico),
      pagina,
      paginas: Math.max(1, Math.ceil(total / limite)),
    });
  } catch (error) {
    console.error('[marcas][listarMarcasPublico]', error && error.message);
    return res.status(500).json({ error: 'No se pudo cargar el directorio.' });
  }
};

/**
 * GET /api/marcas/publico/filtros — conteos REALES sobre marcas publicadas:
 * sólo ciudades/categorías con al menos una marca visible.
 */
exports.obtenerFiltrosPublico = async (req, res) => {
  try {
    const base = filtroPublicoBase();
    const [total, marcas] = await Promise.all([
      Brand.countDocuments(base),
      Brand.find(base)
        .select('categorias ciudades')
        .populate('categorias', 'nombre slug')
        .populate('ciudades', 'nombre slug')
        .lean(),
    ]);

    const porCiudad = new Map();
    const porCategoria = new Map();
    for (const m of marcas) {
      for (const c of m.ciudades || []) {
        const k = String(c._id);
        const e = porCiudad.get(k) || { id: k, nombre: c.nombre, slug: c.slug, total: 0 };
        e.total += 1;
        porCiudad.set(k, e);
      }
      for (const c of m.categorias || []) {
        const k = String(c._id);
        const e = porCategoria.get(k) || { id: k, nombre: c.nombre, slug: c.slug, total: 0 };
        e.total += 1;
        porCategoria.set(k, e);
      }
    }

    const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
    return res.json({
      ok: true,
      total,
      ciudades: [...porCiudad.values()].sort(porNombre),
      categorias: [...porCategoria.values()].sort(porNombre),
    });
  } catch (error) {
    console.error('[marcas][obtenerFiltrosPublico]', error && error.message);
    return res.status(500).json({ error: 'No se pudieron cargar los filtros.' });
  }
};

/**
 * GET /api/marcas/publico/catalogos — catálogos ACTIVOS para formularios.
 * v7 — AUTOCURACIÓN REFORZADA:
 *   - Dispara si EITHER (cualquiera de los dos) está vacío; v6 exigía que
 *     AMBOS lo estuvieran y una BD medio sembrada seguía mostrando huecos.
 *   - El rescate usa la base EMBEBIDA (sembrarCatalogoBase): ya NO depende
 *     de la versión de utils/seed.js que haya en producción.
 *   - Última red: si tras el rescate SIGUE vacío (Mongo readOnly, etc.), se
 *     entrega la base SIN _id marcada temporal:true — el panel la pinta y
 *     el guardado la resuelve por slug (resolverListaCatalogo).
 */
exports.obtenerCatalogos = async (req, res) => {
  try {
    const activos = () => Promise.all([
      BrandCategory.find({ activa: true }).sort({ nombre: 1 }),
      BrandCity.find({ activa: true }).sort({ nombre: 1 }),
    ]);
    let [categorias, ciudades] = await activos();
    if (!categorias.length || !ciudades.length) {
      try {
        await sembrarCatalogoBase();
      } catch (e) {
        console.error('[marcas][obtenerCatalogos] autocuración:', e && e.message);
      }
      [categorias, ciudades] = await activos();
    }
    if (!categorias.length) {
      categorias = CATALOGO_CATEGORIAS.map((nombre) => ({ nombre, slug: slugify(nombre), temporal: true }));
    }
    if (!ciudades.length) {
      ciudades = CATALOGO_CIUDADES.map(({ nombre, estado }) => ({ nombre, estado, slug: slugify(nombre), temporal: true }));
    }
    return res.json({ ok: true, categorias, ciudades });
  } catch (error) {
    console.error('[marcas][obtenerCatalogos]', error && error.message);
    return res.status(500).json({ error: 'No se pudieron cargar los catálogos.' });
  }
};

/** GET /api/marcas/publico/:slug — perfil público cerrado (serializer propio). */
exports.obtenerMarcaPublico = async (req, res) => {
  try {
    const slug = porCadena(req.params.slug).toLowerCase();
    if (!slug || slug.length > 200) return res.status(404).json({ error: 'Marca no encontrada.' });
    const marca = await Brand.findOne({ slug, ...filtroPublicoBase() }).populate(POPULATE_PUBLICO);
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada.' });
    return res.json({ ok: true, marca: aPerfilPublico(marca) });
  } catch (error) {
    console.error('[marcas][obtenerMarcaPublico]', error && error.message);
    return res.status(404).json({ error: 'Marca no encontrada.' });
  }
};

// ============================================================
// PANEL ADMINISTRATIVO
// (montado en app.js tras authMiddleware + requireRole('admin'))
// ============================================================

/** adminEmail desde BD (no del token): la bitácora es evidencia, no promesa. */
const emailDeAdmin = async (req) => {
  try {
    if (req.user && req.user.id) {
      const u = await User.findById(req.user.id).select('email').lean();
      if (u && u.email) return u.email;
    }
  } catch (error) {
    console.error('[marcas][emailDeAdmin]', error && error.message);
  }
  return (req.user && req.user.email) || 'sistema';
};

const registrarAuditoria = async (req, marcaId, accion, detalle) => {
  try {
    await BrandAuditLog.create({
      brand: marcaId,
      accion,
      adminId: req.user && req.user.id ? req.user.id : undefined,
      adminEmail: await emailDeAdmin(req),
      detalle: String(detalle || '').slice(0, 1000),
    });
  } catch (error) {
    console.error('[marcas][auditoria]', accion, error && error.message);
  }
};

/**
 * GET /api/admin/marcas?q=&estado=
 * q busca por nombre, descripciones, texto normalizado, categoría, ciudad y
 * credenciales de la cuenta (correo completo o dígitos del teléfono).
 */
exports.adminListarMarcas = async (req, res) => {
  try {
    const { q, estado } = req.query;
    const filtro = {};
    if (estado && ESTADOS_MARCA.includes(String(estado))) {
      filtro.estado = String(estado);
    } else {
      filtro.estado = { $ne: 'eliminado' }; // por defecto NO se listan eliminadas
    }

    if (q && porCadena(q)) {
      const texto = porCadena(q);
      const rx = new RegExp(escaparRegex(texto), 'i');
      const rxn = new RegExp(escaparRegex(sinAcentos(texto)), 'i');
      const digitos = texto.replace(/\D/g, '');
      const condicionesCuenta = [{ email: rx }];
      if (digitos.length >= 4) condicionesCuenta.push({ telefono: { $regex: escaparRegex(digitos) } });
      const [cats, cds, cuentas] = await Promise.all([
        BrandCategory.find({ $or: [{ nombre: rx }, { slug: rxn }] }).select('_id').lean(),
        BrandCity.find({ $or: [{ nombre: rx }, { slug: rxn }] }).select('_id').lean(),
        BrandAccount.find({ $or: condicionesCuenta }).select('_id').lean(),
      ]);
      filtro.$or = [
        { nombreComercial: rx },
        { descripcionCorta: rx },
        { descripcion: rx },
        { busqueda: rxn },
        { categorias: { $in: cats.map((c) => c._id) } },
        { ciudades: { $in: cds.map((c) => c._id) } },
        { cuenta: { $in: cuentas.map((c) => c._id) } },
      ];
    }

    const [total, marcas] = await Promise.all([
      Brand.countDocuments(filtro),
      Brand.find(filtro)
        .populate('cuenta', 'email telefono emailVerificado telefonoVerificado')
        .populate('categorias', 'nombre slug')
        .populate('ciudades', 'nombre slug')
        .sort({ createdAt: -1 })
        .limit(200),
    ]);
    return res.json({ ok: true, total, marcas });
  } catch (error) {
    console.error('[marcas][adminListarMarcas]', error && error.message);
    return res.status(500).json({ error: 'No se pudo cargar el listado.' });
  }
};

/** GET /api/admin/marcas/:id — marca + cuenta + solicitudes + bitácora. */
exports.adminObtenerMarca = async (req, res) => {
  try {
    const marca = await Brand.findById(req.params.id)
      .populate('cuenta', 'email telefono emailVerificado telefonoVerificado')
      .populate(POPULATE_PUBLICO);
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada.' });
    const bitacora = await BrandAuditLog.find({ brand: marca._id }).sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ ok: true, marca, solicitudes: marca.solicitudesModeracion || [], bitacora });
  } catch (error) {
    console.error('[marcas][adminObtenerMarca]', error && error.message);
    return res.status(500).json({ error: 'No se pudo cargar la marca.' });
  }
};

/**
 * POST /api/admin/marcas/:id/solicitudes — pedir cambios al proveedor.
 * ocultarMientras=true saca la marca del directorio hasta que la atienda.
 * 201 con la solicitud creada.
 */
exports.adminCrearSolicitud = async (req, res) => {
  try {
    const marca = await Brand.findById(req.params.id);
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada.' });
    const { campo, motivo, mensaje, ocultarMientras } = req.body || {};
    if (!porCadena(motivo)) return res.status(400).json({ error: 'Indica el motivo de la solicitud.' });

    marca.solicitudesModeracion.push({
      campo: porCadena(campo).slice(0, 60),
      motivo: porCadena(motivo).slice(0, 300),
      mensaje: porCadena(mensaje).slice(0, 1000),
      ocultarMientras: !!ocultarMientras,
      adminId: req.user && req.user.id ? req.user.id : undefined,
      estado: 'abierta',
    });
    if (ocultarMientras) marca.ocultoPorModeracion = true;
    await marca.save();

    const creada = marca.solicitudesModeracion[marca.solicitudesModeracion.length - 1];
    await registrarAuditoria(
      req,
      marca._id,
      'solicitud-cambios',
      `campo: ${porCadena(campo) || 'general'}; motivo: ${porCadena(motivo)}${ocultarMientras ? '; perfil oculto mientras tanto' : ''}`
    );
    return res.status(201).json({ ok: true, mensaje: 'Solicitud enviada al proveedor.', solicitud: creada });
  } catch (error) {
    console.error('[marcas][adminCrearSolicitud]', error && error.message);
    return res.status(500).json({ error: 'No se pudo crear la solicitud.' });
  }
};

/**
 * PATCH /api/admin/marcas/:id/solicitudes/:solicitudId  { accion: 'resolver' }
 * Cerrar la solicitud desde el panel admin. Si el perfil sigue oculto y no
 * queda ninguna solicitud abierta que oculte, se devuelve al directorio.
 */
exports.adminResolverSolicitud = async (req, res) => {
  try {
    const marca = await Brand.findById(req.params.id);
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada.' });
    const solicitud = (marca.solicitudesModeracion || []).id(req.params.solicitudId);
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada.' });

    const accion = (req.body && req.body.accion) || 'resolver';
    if (accion === 'reabrir') {
      solicitud.estado = 'abierta';
      solicitud.resueltaEn = undefined;
      if (solicitud.ocultarMientras) marca.ocultoPorModeracion = true;
    } else {
      solicitud.estado = 'resuelta';
      solicitud.resueltaEn = new Date();
      if (marca.ocultoPorModeracion) {
        const quedanOcultando = (marca.solicitudesModeracion || []).some(
          (s) => s.estado === 'abierta' && s.ocultarMientras && String(s._id) !== String(solicitud._id)
        );
        if (!quedanOcultando) marca.ocultoPorModeracion = false;
      }
    }
    await marca.save();
    await registrarAuditoria(req, marca._id, `solicitud-${accion}`, `solicitud ${solicitud._id} → ${solicitud.estado}`);
    return res.json({ ok: true, mensaje: 'Solicitud actualizada.', solicitudes: marca.solicitudesModeracion });
  } catch (error) {
    console.error('[marcas][adminResolverSolicitud]', error && error.message);
    return res.status(500).json({ error: 'No se pudo actualizar la solicitud.' });
  }
};

/** POST /api/admin/marcas/:id/bloquear — motivo OBLIGATORIO (400 si falta). */
exports.adminBloquear = async (req, res) => {
  try {
    const marca = await Brand.findById(req.params.id);
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada.' });
    if (marca.estado === 'eliminado') return res.status(400).json({ error: 'La marca ya está eliminada.' });
    const motivo = porCadena(req.body && req.body.motivo);
    if (!motivo) return res.status(400).json({ error: 'Debes indicar el motivo del bloqueo.' });

    marca.estado = 'bloqueado';
    marca.motivoBloqueo = motivo.slice(0, 300);
    marca.bloqueadoEn = new Date();
    marca.ocultoPorModeracion = false; // bloqueado ya la saca del directorio
    await marca.save();
    await registrarAuditoria(req, marca._id, 'bloquear', motivo);
    return res.json({ ok: true, mensaje: 'Marca bloqueada.', marca });
  } catch (error) {
    console.error('[marcas][adminBloquear]', error && error.message);
    return res.status(500).json({ error: 'No se pudo bloquear la marca.' });
  }
};

/** POST /api/admin/marcas/:id/reactivar — bloqueada/desactivada → despublicada. */
exports.adminReactivar = async (req, res) => {
  try {
    const marca = await Brand.findById(req.params.id);
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada.' });
    if (!['bloqueado', 'desactivado'].includes(marca.estado)) {
      return res.status(400).json({ error: 'Sólo se pueden reactivar marcas bloqueadas o desactivadas.' });
    }
    marca.estado = 'despublicado'; // el proveedor decide cuándo republicar
    marca.motivoBloqueo = '';
    marca.motivoDesactivacion = '';
    marca.ocultoPorModeracion = false;
    await marca.save();
    await registrarAuditoria(req, marca._id, 'reactivar', `estado anterior: ${marca.estado}; la marca quedó despublicada`);
    return res.json({ ok: true, mensaje: 'Marca reactivada (despublicada).', marca });
  } catch (error) {
    console.error('[marcas][adminReactivar]', error && error.message);
    return res.status(500).json({ error: 'No se pudo reactivar la marca.' });
  }
};

/** POST /api/admin/marcas/:id/desactivar — retiro temporal a petición. */
exports.adminDesactivar = async (req, res) => {
  try {
    const marca = await Brand.findById(req.params.id);
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada.' });
    if (marca.estado === 'eliminado') return res.status(400).json({ error: 'La marca ya está eliminada.' });
    const motivo = porCadena(req.body && req.body.motivo) || 'Sin motivo indicado';
    marca.estado = 'desactivado';
    marca.motivoDesactivacion = motivo.slice(0, 300);
    marca.ocultoPorModeracion = false;
    await marca.save();
    await registrarAuditoria(req, marca._id, 'desactivar', motivo);
    return res.json({ ok: true, mensaje: 'Marca desactivada.', marca });
  } catch (error) {
    console.error('[marcas][adminDesactivar]', error && error.message);
    return res.status(500).json({ error: 'No se pudo desactivar la marca.' });
  }
};

/**
 * DELETE /api/admin/marcas/:id — borrado en DOS pasos:
 *   1) sin query  → borrado LÓGICO (estado 'eliminado'; datos conservados,
 *      panel del proveedor en 410, listado admin la omite salvo ?estado=eliminado)
 *   2) ?definitivo=true + body { confirmar: true } y estado 'eliminado'
 *      → purga marca + cuenta; la BITÁCORA se conserva siempre.
 */
exports.adminEliminarMarca = async (req, res) => {
  try {
    const marca = await Brand.findById(req.params.id);
    if (!marca) return res.status(404).json({ error: 'Marca no encontrada.' });

    if (req.query.definitivo === 'true') {
      if (marca.estado !== 'eliminado') {
        return res.status(400).json({ error: 'La marca debe estar eliminada (borrado lógico) antes de purgarla definitivamente.' });
      }
      if (!(req.body && req.body.confirmar === true)) {
        return res.status(400).json({ error: 'Confirma la purga definitiva enviando { confirmar: true }.' });
      }
      const idCuenta = marca.cuenta;
      await Brand.deleteOne({ _id: marca._id });
      if (idCuenta) await BrandAccount.deleteOne({ _id: idCuenta });
      await registrarAuditoria(req, marca._id, 'purgar', 'Marca y cuenta eliminadas definitivamente; la bitácora se conserva.');
      return res.json({ ok: true, mensaje: 'Marca purgada definitivamente. La bitácora se conserva.' });
    }

    if (marca.estado === 'eliminado') {
      return res.status(400).json({ error: 'La marca ya está eliminada.' });
    }
    marca.estado = 'eliminado';
    marca.eliminadoEn = new Date();
    marca.ocultoPorModeracion = false;
    await marca.save();
    await registrarAuditoria(req, marca._id, 'eliminar', 'Borrado lógico; los datos se conservan.');
    return res.json({
      ok: true,
      mensaje: 'Marca eliminada (borrado lógico). Usa ?definitivo=true con { confirmar: true } para purgarla.',
      marca,
    });
  } catch (error) {
    console.error('[marcas][adminEliminarMarca]', error && error.message);
    return res.status(500).json({ error: 'No se pudo eliminar la marca.' });
  }
};

// ============================================================
// ADMIN: CATÁLOGOS
// ============================================================

/** POST /api/admin/marcas/catalogos/categorias — duplicada por slug → 409. */
exports.adminCrearCategoria = async (req, res) => {
  try {
    const nombre = porCadena(req.body && req.body.nombre);
    if (nombre.length < 3 || nombre.length > 60) {
      return res.status(400).json({ error: 'El nombre debe tener entre 3 y 60 caracteres.' });
    }
    const slug = slugify(nombre);
    if (!slug) return res.status(400).json({ error: 'El nombre no genera un slug válido.' });
    const existente = await BrandCategory.findOne({ slug }).select('_id').lean();
    if (existente) return res.status(409).json({ error: 'Ya existe una categoría con ese nombre.' });
    const categoria = await BrandCategory.create({
      nombre,
      slug,
      icono: porCadena(req.body && req.body.icono).slice(0, 8),
      activa: true,
    });
    return res.status(201).json({ ok: true, mensaje: 'Categoría creada.', categoria });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ error: 'Ya existe una categoría con ese nombre.' });
    }
    console.error('[marcas][adminCrearCategoria]', error && error.message);
    return res.status(500).json({ error: 'No se pudo crear la categoría.' });
  }
};

/** PUT /api/admin/marcas/catalogos/categorias/:id — activar/desactivar/renombrar. */
exports.adminActualizarCategoria = async (req, res) => {
  try {
    const categoria = await BrandCategory.findById(req.params.id);
    if (!categoria) return res.status(404).json({ error: 'Categoría no encontrada.' });
    const b = req.body || {};

    if (b.activa !== undefined) categoria.activa = !!b.activa;
    if (b.icono !== undefined) categoria.icono = porCadena(b.icono).slice(0, 8);
    if (b.nombre !== undefined) {
      const nombre = porCadena(b.nombre);
      if (nombre.length < 3 || nombre.length > 60) {
        return res.status(400).json({ error: 'El nombre debe tener entre 3 y 60 caracteres.' });
      }
      const slug = slugify(nombre);
      const choque = await BrandCategory.findOne({ slug, _id: { $ne: categoria._id } }).select('_id').lean();
      if (choque) return res.status(409).json({ error: 'Ya existe otra categoría con ese nombre.' });
      categoria.nombre = nombre;
      categoria.slug = slug;
    }

    await categoria.save();
    return res.json({ ok: true, mensaje: 'Categoría actualizada.', categoria });
  } catch (error) {
    console.error('[marcas][adminActualizarCategoria]', error && error.message);
    return res.status(500).json({ error: 'No se pudo actualizar la categoría.' });
  }
};
