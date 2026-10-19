// Pruebas de integración del módulo Marcas y Profesionales Aliados.
// Uso:  MONGO_TEST_URI=mongodb://127.0.0.1:27018/marcas_test node tests/marcas.integration.js
// Simula: envío de correo, Twilio Verify y Cloudinary (no se envían correos/SMS reales).
process.env.JWT_SECRET = 'test-secret-user';
process.env.JWT_REFRESH_SECRET = 'test-secret-refresh';
const path = require('path');
const root = path.join(__dirname, '..');
const assert = require('node:assert/strict');

// ---- Simulaciones (antes de cargar el módulo) ----
const correos = [];
const email = require(path.join(root, 'src/utils/email'));
email.transporter.sendMail = async (o) => { correos.push(o); };

const smsEnviados = [];
const twilioPath = require.resolve(path.join(root, 'src/utils/twilioVerify'));
const twilioReal = require(twilioPath); // solo para reutilizar normalizarTelefono tal como está en producción
let twilioActivo = false;
require.cache[twilioPath].exports = {
  twilioVerifyConfigurado: () => twilioActivo,
  normalizarTelefono: twilioReal.normalizarTelefono,
  enviarOTP: async (t) => { smsEnviados.push(t); return { ok: true }; },
  verificarOTP: async (t, c) => ({ ok: c === '654321' }),
};

const cloud = require(path.join(root, 'src/config/cloudinary'));
const subidas = [];
cloud.subirACloudinary = async (buf, mime, folder) => { const u = `https://res.cloudinary.com/demo/image/upload/v1/${folder}/img${subidas.length}.png`; subidas.push(u); return u; };
const borradas = [];
cloud.cloudinary.uploader.destroy = async (id) => { borradas.push(id); return { result: 'ok' }; };

const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const supertest = require('supertest');
const jwt = require('jsonwebtoken');
const authMiddleware = require(path.join(root, 'src/middleware/auth.middleware'));
const requireRole = require(path.join(root, 'src/middleware/role.middleware'));
const { marcasRouter, adminMarcasRouter } = require(path.join(root, 'src/marcas/routes'));
const { sembrarCatalogos } = require(path.join(root, 'src/marcas/utils/seed'));
const BrandCategory = require(path.join(root, 'src/marcas/models/BrandCategory'));
const BrandCity = require(path.join(root, 'src/marcas/models/BrandCity'));
const BrandAccount = require(path.join(root, 'src/marcas/models/BrandAccount'));
const BrandOtp = require(path.join(root, 'src/marcas/models/BrandOtp'));
const Brand = require(path.join(root, 'src/marcas/models/Brand'));
const BrandAuditLog = require(path.join(root, 'src/marcas/models/BrandAuditLog'));
const User = require(path.join(root, 'src/models/User'));

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());
app.use('/api/marcas', marcasRouter);
app.use('/api/admin/marcas', authMiddleware, requireRole('admin'), adminMarcasRouter);
// Cada petición simula una IP distinta (trust proxy) para no chocar con el límite por IP;
// la prueba del límite fija la IP explícitamente.
let ipN = 0;
const appIps = express();
appIps.set('trust proxy', 1);
appIps.use((req, res, next) => { if (!req.headers['x-forwarded-for']) req.headers['x-forwarded-for'] = `10.9.${Math.floor(ipN / 250)}.${ipN++ % 250}`; next(); });
appIps.use(app);

// PNG mínimo válido (firma real) y un archivo falso con mimetype de imagen
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const FALSO = Buffer.from('esto no es una imagen, es texto plano disfrazado');

let pasadas = 0; const fallos = [];
const prueba = async (nombre, fn) => {
  try { await fn(); pasadas++; console.log(`  ✅ ${nombre}`); }
  catch (e) { fallos.push(nombre); console.log(`  ❌ ${nombre}\n     ${String(e.message).split('\n').slice(0, 4).join('\n     ')}`); }
};

const ultimoCodigo = () => (correos[correos.length - 1].subject.match(/: (\d{6}) /) || [])[1];
const saltarCooldown = (destino) => BrandOtp.updateMany({ destino }, { $set: { ultimoEnvio: new Date(Date.now() - 120000) } });

const entrar = async (correo) => {
  await request(app).post('/api/marcas/auth/solicitar').send({ canal: 'email', email: correo }).expect(200);
  const r = await request(app).post('/api/marcas/auth/verificar').send({ canal: 'email', email: correo, codigo: ultimoCodigo() }).expect(200);
  return r.body.accessToken;
};
const A = (t) => ({ Authorization: `Bearer ${t}` });
const request = (a) => supertest(a === app ? appIps : a);

(async () => {
  await mongoose.connect(process.env.MONGO_TEST_URI || 'mongodb://127.0.0.1:27018/marcas_test');
  await mongoose.connection.dropDatabase();
  await Promise.all([BrandAccount, Brand, BrandOtp, BrandCategory, BrandCity, User, BrandAuditLog].map((m) => m.init().catch(() => {})));
  await sembrarCatalogos();

  const cat = async (slug) => (await BrandCategory.findOne({ slug }))._id.toString();
  const ciu = async (slug) => (await BrandCity.findOne({ slug }))._id.toString();
  const admin = await User.create({ nombre: 'Admin Prueba', email: 'admin@test.com', password: 'Aa1!aaaaaa', role: 'admin' });
  const usuario = await User.create({ nombre: 'Usuario Normal', email: 'user@test.com', password: 'Aa1!aaaaaa', role: 'user' });
  const tAdmin = jwt.sign({ id: admin._id, role: 'admin', plan: 'premium' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const tUser = jwt.sign({ id: usuario._id, role: 'user', plan: 'gratuito' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  console.log('\n▶ Semilla y catálogos');
  await prueba('semilla crea 8 categorías y es idempotente', async () => {
    await sembrarCatalogos();
    assert.equal(await BrandCategory.countDocuments(), 8);
    assert.ok(await BrandCity.countDocuments() >= 50);
  });
  await prueba('catálogos públicos devuelven categorías y ciudades activas', async () => {
    const r = await request(app).get('/api/marcas/publico/catalogos').expect(200);
    assert.equal(r.body.categorias.length, 8);
    assert.ok(r.body.ciudades.some((c) => c.slug === 'queretaro'));
  });

  console.log('\n▶ Registro y verificación (correo)');
  await prueba('correo inválido se rechaza', async () => {
    await request(app).post('/api/marcas/auth/solicitar').send({ canal: 'email', email: 'no-es-correo' }).expect(400);
  });
  await prueba('solicitar código NO crea la cuenta todavía', async () => {
    await request(app).post('/api/marcas/auth/solicitar').send({ canal: 'email', email: 'persianas@test.com' }).expect(200);
    assert.equal(await BrandAccount.countDocuments({ email: 'persianas@test.com' }), 0);
    assert.match(ultimoCodigo(), /^\d{6}$/);
  });
  await prueba('no se puede pedir otro código antes de 60 s (cooldown)', async () => {
    const r = await request(app).post('/api/marcas/auth/solicitar').send({ canal: 'email', email: 'persianas@test.com' });
    assert.equal(r.status, 429);
  });
  await prueba('código incorrecto se rechaza y no crea cuenta', async () => {
    const r = await request(app).post('/api/marcas/auth/verificar').send({ canal: 'email', email: 'persianas@test.com', codigo: '000000' });
    assert.equal(r.status, 400); assert.match(r.body.error, /incorrecto/i);
    assert.equal(await BrandAccount.countDocuments({ email: 'persianas@test.com' }), 0);
  });
  await prueba('tras 5 intentos fallidos el código queda bloqueado aunque luego sea el correcto', async () => {
    for (let i = 0; i < 4; i++) await request(app).post('/api/marcas/auth/verificar').send({ canal: 'email', email: 'persianas@test.com', codigo: '111111' });
    const r = await request(app).post('/api/marcas/auth/verificar').send({ canal: 'email', email: 'persianas@test.com', codigo: ultimoCodigo() });
    assert.equal(r.status, 429);
  });
  let tokenA;
  await prueba('con un código nuevo y correcto se crea la cuenta verificada y se entra', async () => {
    await saltarCooldown('persianas@test.com');
    await request(app).post('/api/marcas/auth/solicitar').send({ canal: 'email', email: 'persianas@test.com' }).expect(200);
    const r = await request(app).post('/api/marcas/auth/verificar').send({ canal: 'email', email: 'persianas@test.com', codigo: ultimoCodigo() }).expect(200);
    assert.ok(r.body.accessToken); assert.equal(r.body.esNueva, true);
    assert.equal(r.body.cuenta.emailVerificado, true);
    tokenA = r.body.accessToken;
    assert.ok((r.headers['set-cookie'] || []).some((c) => c.startsWith('vm_brand_refresh=') && /HttpOnly/i.test(c)));
  });
  await prueba('el mismo código no sirve dos veces', async () => {
    const r = await request(app).post('/api/marcas/auth/verificar').send({ canal: 'email', email: 'persianas@test.com', codigo: ultimoCodigo() });
    assert.equal(r.status >= 400, true);
  });
  await prueba('volver a entrar con el mismo correo reutiliza la cuenta (no la duplica)', async () => {
    await saltarCooldown('persianas@test.com');
    await request(app).post('/api/marcas/auth/solicitar').send({ canal: 'email', email: 'PERSIANAS@test.com' }).expect(200);
    const r = await request(app).post('/api/marcas/auth/verificar').send({ canal: 'email', email: 'persianas@test.com', codigo: ultimoCodigo() }).expect(200);
    assert.equal(r.body.esNueva, false);
    assert.equal(await BrandAccount.countDocuments({ email: 'persianas@test.com' }), 1);
  });

  console.log('\n▶ Verificación por teléfono (Twilio Verify simulado)');
  await prueba('SMS no disponible si Twilio no está configurado (no se finge)', async () => {
    const c = await request(app).get('/api/marcas/auth/canales').expect(200);
    assert.equal(c.body.sms, false);
    const r = await request(app).post('/api/marcas/auth/solicitar').send({ canal: 'sms', telefono: '+52 55 1234 5678' });
    assert.equal(r.status, 503);
  });
  twilioActivo = true;
  let tokenTel;
  await prueba('con Twilio activo: código incorrecto falla y correcto crea cuenta con teléfono E.164', async () => {
    await request(app).post('/api/marcas/auth/solicitar').send({ canal: 'sms', telefono: '55 1234 5678' }).expect(200);
    assert.deepEqual(smsEnviados, ['+525512345678']);
    const mal = await request(app).post('/api/marcas/auth/verificar').send({ canal: 'sms', telefono: '55 1234 5678', codigo: '123456' });
    assert.equal(mal.status, 400);
    const ok = await request(app).post('/api/marcas/auth/verificar').send({ canal: 'sms', telefono: '55 1234 5678', codigo: '654321' }).expect(200);
    assert.equal(ok.body.cuenta.telefono, '+525512345678'); assert.equal(ok.body.cuenta.telefonoVerificado, true);
    tokenTel = ok.body.accessToken;
  });
  await prueba('teléfono inválido se rechaza', async () => {
    await request(app).post('/api/marcas/auth/solicitar').send({ canal: 'sms', telefono: '123' }).expect(400);
  });

  console.log('\n▶ Límite de abuso por IP');
  await prueba('más de 10 solicitudes de código por hora desde la misma IP → 429', async () => {
    const ip = '203.0.113.7';
    let ultimo;
    for (let i = 0; i < 12; i++) ultimo = await request(app).post('/api/marcas/auth/solicitar').set('X-Forwarded-For', ip).send({ canal: 'email', email: `abuso${i}@test.com` });
    assert.equal(ultimo.status, 429);
  });

  console.log('\n▶ Separación de sesiones y permisos');
  await prueba('token de marca NO sirve en el panel admin', async () => {
    assert.equal((await request(app).get('/api/admin/marcas').set(A(tokenA))).status, 401);
  });
  await prueba('usuario normal (no admin) recibe 403 en el panel admin', async () => {
    assert.equal((await request(app).get('/api/admin/marcas').set(A(tUser))).status, 403);
  });
  await prueba('token de usuario normal ni de admin sirve en el panel de marca', async () => {
    assert.equal((await request(app).get('/api/marcas/panel/mi-marca').set(A(tUser))).status, 401);
    assert.equal((await request(app).get('/api/marcas/panel/mi-marca').set(A(tAdmin))).status, 401);
  });
  await prueba('panel de marca sin sesión es 401', async () => {
    assert.equal((await request(app).get('/api/marcas/panel/mi-marca')).status, 401);
  });

  console.log('\n▶ Panel del proveedor');
  await prueba('primera visita crea el borrador vacío con lista de faltantes', async () => {
    const r = await request(app).get('/api/marcas/panel/mi-marca').set(A(tokenA)).expect(200);
    assert.equal(r.body.marca.estado, 'borrador'); assert.equal(r.body.marca.puedePublicar, false);
    assert.ok(r.body.marca.faltantes.length >= 5);
    assert.equal(await Brand.countDocuments(), 1);
  });
  await prueba('no se puede publicar un perfil incompleto', async () => {
    const r = await request(app).post('/api/marcas/panel/mi-marca/publicar').set(A(tokenA));
    assert.equal(r.status, 400); assert.ok(r.body.faltantes.length);
  });
  await prueba('validaciones: nombre corto, correo, web y teléfono inválidos', async () => {
    const put = (b) => request(app).put('/api/marcas/panel/mi-marca').set(A(tokenA)).send(b);
    assert.equal((await put({ nombreComercial: 'A' })).status, 400);
    assert.equal((await put({ contacto: { email: 'malo' } })).status, 400);
    assert.equal((await put({ contacto: { sitioWeb: 'javascript:alert(1)' } })).status, 400);
    assert.equal((await put({ contacto: { whatsapp: 'abc' } })).status, 400);
    assert.equal((await put({ categorias: ['no-es-id'] })).status, 400);
  });
  await prueba('guarda información con VARIAS categorías y VARIAS ciudades', async () => {
    const r = await request(app).put('/api/marcas/panel/mi-marca').set(A(tokenA)).send({
      nombreComercial: 'Persianas Aurora', responsable: 'Laura Mendoza',
      descripcionCorta: 'Persianas, cortinas y decoración a la medida para tu hogar u oficina.',
      descripcion: 'Fabricamos persianas enrollables, cortinas blackout y accesorios de decoración con instalación incluida.',
      categorias: [await cat('persianas-cortinas-y-decoracion'), await cat('servicios-para-el-hogar')],
      categoriaPrincipal: await cat('persianas-cortinas-y-decoracion'),
      servicios: ['Persianas enrollables', 'Cortinas blackout', 'Instalación'],
      ciudades: [await ciu('ciudad-de-mexico'), await ciu('queretaro'), await ciu('puebla')],
      ciudadPrincipal: await ciu('ciudad-de-mexico'),
      zonasAdicionales: ['Toluca y alrededores'],
      contacto: { telefono: '55 1234 5678', whatsapp: '5512345678', email: 'ventas@persianasaurora.mx', sitioWeb: 'persianasaurora.mx', redes: { instagram: 'https://instagram.com/aurora' } },
    }).expect(200);
    assert.equal(r.body.marca.categorias.length, 2); assert.equal(r.body.marca.ciudades.length, 3);
    assert.equal(r.body.marca.contacto.sitioWeb, 'https://persianasaurora.mx/');
    assert.match(r.body.marca.slug, /^persianas-aurora/);
  });
  await prueba('ciudad nueva del proveedor se normaliza y no duplica una existente', async () => {
    const antes = await BrandCity.countDocuments();
    const r = await request(app).put('/api/marcas/panel/mi-marca').set(A(tokenA)).send({ nuevasCiudades: [{ nombre: 'QUERÉTARO' }, { nombre: 'Tepoztlán', estado: 'Morelos' }] }).expect(200);
    assert.equal(await BrandCity.countDocuments(), antes + 1);
    assert.equal(r.body.marca.ciudades.length, 4);
    assert.equal((await request(app).put('/api/marcas/panel/mi-marca').set(A(tokenA)).send({ nuevasCiudades: [{ nombre: '<script>' }] })).status, 400);
  });
  await prueba('aún falta logo/foto: no puede publicar', async () => {
    const r = await request(app).post('/api/marcas/panel/mi-marca/publicar').set(A(tokenA));
    assert.equal(r.status, 400); assert.ok(r.body.faltantes.some((f) => /Logotipo/.test(f)));
  });
  await prueba('rechaza archivo que dice ser imagen pero no lo es (firma inválida)', async () => {
    const r = await request(app).post('/api/marcas/panel/mi-marca/imagenes/logo').set(A(tokenA)).attach('imagen', FALSO, { filename: 'x.png', contentType: 'image/png' });
    assert.equal(r.status, 400);
  });
  await prueba('rechaza formatos no permitidos (svg/gif) y tipo de imagen inválido', async () => {
    const r1 = await request(app).post('/api/marcas/panel/mi-marca/imagenes/logo').set(A(tokenA)).attach('imagen', PNG, { filename: 'x.svg', contentType: 'image/svg+xml' });
    assert.equal(r1.status, 400);
    const r2 = await request(app).post('/api/marcas/panel/mi-marca/imagenes/avatar').set(A(tokenA)).attach('imagen', PNG, { filename: 'x.png', contentType: 'image/png' });
    assert.equal(r2.status, 400);
  });
  await prueba('sube logo, portada y galería; reemplazar el logo borra el anterior', async () => {
    const sube = (tipo) => request(app).post(`/api/marcas/panel/mi-marca/imagenes/${tipo}`).set(A(tokenA)).attach('imagen', PNG, { filename: 'x.png', contentType: 'image/png' });
    const r1 = await sube('logo').expect(200);
    const logo1 = r1.body.marca.logo;
    await sube('portada').expect(200);
    await sube('galeria').expect(200);
    const r2 = await sube('logo').expect(200);
    assert.notEqual(r2.body.marca.logo, logo1);
    assert.ok(borradas.some((id) => logo1.includes(id)));
    assert.equal(r2.body.marca.galeria.length, 1);
  });
  await prueba('la galería admite máximo 8 fotos', async () => {
    const sube = () => request(app).post('/api/marcas/panel/mi-marca/imagenes/galeria').set(A(tokenA)).attach('imagen', PNG, { filename: 'x.png', contentType: 'image/png' });
    for (let i = 0; i < 7; i++) await sube().expect(200);
    assert.equal((await sube()).status, 400);
  });
  await prueba('publica sin aprobación administrativa y aparece en el directorio', async () => {
    const r = await request(app).post('/api/marcas/panel/mi-marca/publicar').set(A(tokenA)).expect(200);
    assert.equal(r.body.marca.estado, 'publicado'); assert.equal(r.body.marca.visiblePublicamente, true);
    const l = await request(app).get('/api/marcas/publico').expect(200);
    assert.equal(l.body.total, 1);
  });
  await prueba('un perfil publicado no puede quedar incompleto con una edición', async () => {
    const r = await request(app).put('/api/marcas/panel/mi-marca').set(A(tokenA)).send({ categorias: [], categoriaPrincipal: null });
    assert.equal(r.status, 400); assert.ok(r.body.faltantes.some((f) => /categoría/.test(f)));
    // sin fotoPerfil, borrar el único logo de un perfil publicado se rechaza
    assert.equal((await request(app).delete('/api/marcas/panel/mi-marca/imagenes/logo').set(A(tokenA))).status, 400);
    assert.ok((await Brand.findOne({ nombreComercial: 'Persianas Aurora' })).logo);
  });
  await prueba('la categoría principal siempre queda dentro de las categorías de la marca', async () => {
    const b = await Brand.findOne({ nombreComercial: 'Persianas Aurora' });
    assert.ok(b.categorias.map(String).includes(String(b.categoriaPrincipal)));
    assert.ok(b.ciudades.map(String).includes(String(b.ciudadPrincipal)));
  });

  console.log('\n▶ Buscador y filtros (datos reales de la base de datos)');
  // Segunda marca para contrastar
  const tokenB = await entrar('arquitectos@test.com');
  const arqCat = await cat('arquitectura-y-diseno-de-interiores');
  await request(app).put('/api/marcas/panel/mi-marca').set(A(tokenB)).send({
    nombreComercial: 'Estudio Bruma Arquitectos', descripcionCorta: 'Proyectos de arquitectura residencial y diseño de interiores contemporáneo.',
    descripcion: 'Especialistas en remodelación de espacios pequeños y asesoría para compradores de departamentos.',
    categorias: [arqCat], ciudades: [await ciu('guadalajara')], ciudadPrincipal: await ciu('guadalajara'),
    contacto: { whatsapp: '3312345678' },
  }).expect(200);
  await request(app).post('/api/marcas/panel/mi-marca/imagenes/fotoPerfil').set(A(tokenB)).attach('imagen', PNG, { filename: 'x.png', contentType: 'image/png' }).expect(200);
  await request(app).post('/api/marcas/panel/mi-marca/publicar').set(A(tokenB)).expect(200);

  const lista = (qs) => request(app).get(`/api/marcas/publico?${qs}`).expect(200).then((r) => r.body);
  await prueba('sin filtros aparecen las 2 marcas (sin duplicados)', async () => {
    const r = await lista(''); assert.equal(r.total, 2); assert.equal(new Set(r.marcas.map((m) => m.id)).size, 2);
  });
  await prueba('persianas en Ciudad de México → aparece la de persianas', async () => {
    const r = await lista('categoria=persianas-cortinas-y-decoracion&ciudad=ciudad-de-mexico');
    assert.deepEqual(r.marcas.map((m) => m.nombre), ['Persianas Aurora']);
  });
  await prueba('misma marca por otras ciudades: Querétaro y Puebla', async () => {
    assert.equal((await lista('categoria=persianas-cortinas-y-decoracion&ciudad=queretaro')).total, 1);
    assert.equal((await lista('categoria=servicios-para-el-hogar&ciudad=puebla')).total, 1);
  });
  await prueba('misma ciudad pero categoría distinta → no aparece', async () => {
    assert.equal((await lista('categoria=notarias-y-servicios-legales&ciudad=queretaro')).total, 0);
  });
  await prueba('ciudad donde no presta servicio → no aparece', async () => {
    assert.equal((await lista('categoria=persianas-cortinas-y-decoracion&ciudad=guadalajara')).total, 0);
  });
  await prueba('varias categorías + varias ciudades a la vez: aparece UNA sola vez', async () => {
    const r = await lista('categoria=persianas-cortinas-y-decoracion,servicios-para-el-hogar&ciudad=ciudad-de-mexico,queretaro,puebla');
    assert.equal(r.total, 1); assert.equal(r.marcas.length, 1);
  });
  await prueba('buscar por nombre funciona sin importar ciudad o categoría', async () => {
    assert.equal((await lista('q=aurora')).total, 1);
    assert.equal((await lista('q=AURORA')).total, 1);
  });
  await prueba('buscar por servicio, categoría y palabra de la descripción (sin acentos)', async () => {
    assert.equal((await lista('q=blackout')).total, 1);               // servicio/descripción
    assert.equal((await lista('q=decoracion')).total, 1);              // categoría "decoración" sin acento
    assert.equal((await lista('q=remodelacion')).total, 1);            // descripción de la otra marca
    assert.equal((await lista('q=remodelacion&ciudad=guadalajara')).total, 1);
  });
  await prueba('texto + ciudad se combinan (AND): nombre correcto en ciudad equivocada no aparece', async () => {
    assert.equal((await lista('q=aurora&ciudad=guadalajara')).total, 0);
  });
  await prueba('búsqueda sin coincidencias devuelve total 0', async () => {
    assert.equal((await lista('q=zzzzzz')).total, 0);
  });
  await prueba('un regex malicioso en q no rompe la consulta', async () => {
    const r = await request(app).get('/api/marcas/publico?q=' + encodeURIComponent('.*(((')); assert.equal(r.status, 200);
  });
  await prueba('filtros: conteos reales y solo ciudades con marcas', async () => {
    const r = await request(app).get('/api/marcas/publico/filtros').expect(200);
    assert.equal(r.body.total, 2);
    assert.ok(r.body.ciudades.find((c) => c.slug === 'queretaro').total === 1);
    assert.ok(!r.body.ciudades.some((c) => c.slug === 'tijuana'));
  });
  await prueba('paginación', async () => {
    const r = await lista('limite=1&pagina=2'); assert.equal(r.marcas.length, 1); assert.equal(r.paginas, 2);
  });

  console.log('\n▶ Perfil público y privacidad');
  await prueba('detalle público incluye contacto publicado y NO datos privados', async () => {
    const lst = await lista('q=aurora');
    const r = await request(app).get(`/api/marcas/publico/${lst.marcas[0].slug}`).expect(200);
    const m = r.body.marca;
    assert.equal(m.contacto.email, 'ventas@persianasaurora.mx');
    const txt = JSON.stringify(r.body);
    assert.ok(!('estado' in m) && !('cuenta' in m), 'el perfil público no incluye el estado interno ni la cuenta');
    for (const prohibido of ['persianas@test.com', 'busqueda', 'bloqueadoPor', 'motivoBloqueo', 'ocultoPorModeracion', 'emailVerificado']) {
      assert.ok(!txt.includes(prohibido), `no debe exponer ${prohibido}`);
    }
  });
  await prueba('slug inexistente o malicioso → 404', async () => {
    assert.equal((await request(app).get('/api/marcas/publico/no-existe')).status, 404);
    assert.equal((await request(app).get('/api/marcas/publico/..%2F..%2Fetc')).status, 404);
  });

  console.log('\n▶ Promociones');
  let promoId;
  await prueba('crea promoción válida y aparece pública', async () => {
    const r = await request(app).post('/api/marcas/panel/mi-marca/promociones').set(A(tokenA)).send({
      tipo: 'porcentaje', porcentaje: 15, descripcion: '15% en cortinas blackout para la comunidad SomosViveMás.', condiciones: 'No acumulable', vigenciaFin: '2099-12-31',
    }).expect(201);
    promoId = r.body.marca.promociones[0].id;
    const lst = await lista('q=aurora');
    assert.equal(lst.marcas[0].promocion.etiqueta, '15% de descuento');
  });
  await prueba('valida porcentaje, descripción y fechas', async () => {
    const post = (b) => request(app).post('/api/marcas/panel/mi-marca/promociones').set(A(tokenA)).send(b);
    assert.equal((await post({ tipo: 'porcentaje', porcentaje: 150, descripcion: 'x'.repeat(20) })).status, 400);
    assert.equal((await post({ tipo: 'porcentaje', porcentaje: 10, descripcion: 'corta' })).status, 400);
    assert.equal((await post({ tipo: 'otro', descripcion: 'x'.repeat(20), vigenciaInicio: '2030-02-01', vigenciaFin: '2030-01-01' })).status, 400);
    assert.equal((await post({ tipo: 'inventado', descripcion: 'x'.repeat(20) })).status, 400);
  });
  await prueba('promoción vencida o inactiva no se muestra públicamente', async () => {
    await request(app).post('/api/marcas/panel/mi-marca/promociones').set(A(tokenA)).send({ tipo: 'otro', titulo: 'Vencida', descripcion: 'Promoción que ya venció hace tiempo.', vigenciaFin: '2020-01-01' }).expect(201);
    await request(app).put(`/api/marcas/panel/mi-marca/promociones/${promoId}`).set(A(tokenA)).send({ activa: false }).expect(200);
    const lst = await lista('q=aurora');
    assert.equal(lst.marcas[0].promocion, null);
    const det = await request(app).get(`/api/marcas/publico/${lst.marcas[0].slug}`).expect(200);
    assert.equal(det.body.marca.promociones.length, 0);
    await request(app).put(`/api/marcas/panel/mi-marca/promociones/${promoId}`).set(A(tokenA)).send({ activa: true }).expect(200);
  });
  await prueba('el proveedor puede eliminar su promoción y se persiste en la base de datos', async () => {
    const extra = await request(app).post('/api/marcas/panel/mi-marca/promociones').set(A(tokenA)).send({ tipo: 'cortesia', descripcion: 'Cotización a domicilio sin costo para la comunidad.' }).expect(201);
    const id = extra.body.marca.promociones.find((p) => p.tipo === 'cortesia').id;
    const antes = (await Brand.findOne({ nombreComercial: 'Persianas Aurora' })).promociones.length;
    const r = await request(app).delete(`/api/marcas/panel/mi-marca/promociones/${id}`).set(A(tokenA)).expect(200);
    assert.equal(r.body.marca.promociones.length, antes - 1);
    assert.equal((await Brand.findOne({ nombreComercial: 'Persianas Aurora' })).promociones.length, antes - 1);
  });
  await prueba('el proveedor puede eliminar una foto de su galería y se persiste', async () => {
    const b = await Brand.findOne({ nombreComercial: 'Persianas Aurora' });
    const url = b.galeria[0]; const n = b.galeria.length;
    await request(app).delete('/api/marcas/panel/mi-marca/imagenes/galeria').set(A(tokenA)).send({ url }).expect(200);
    assert.equal((await Brand.findById(b._id)).galeria.length, n - 1);
  });
  await prueba('IDOR: otra cuenta NO puede editar ni borrar la promoción ajena (404)', async () => {
    assert.equal((await request(app).put(`/api/marcas/panel/mi-marca/promociones/${promoId}`).set(A(tokenB)).send({ activa: false })).status, 404);
    assert.equal((await request(app).delete(`/api/marcas/panel/mi-marca/promociones/${promoId}`).set(A(tokenB))).status, 404);
    assert.equal((await Brand.findOne({ nombreComercial: 'Persianas Aurora' })).promociones.length, 2);
  });
  await prueba('IDOR: imagen de galería ajena no se puede borrar', async () => {
    const urlA = (await Brand.findOne({ nombreComercial: 'Persianas Aurora' })).galeria[0];
    assert.equal((await request(app).delete('/api/marcas/panel/mi-marca/imagenes/galeria').set(A(tokenB)).send({ url: urlA })).status, 404);
  });
  await prueba('cada cuenta ve solo su marca; el body no puede cambiar la propiedad', async () => {
    const otraCuenta = await BrandAccount.findOne({ email: 'arquitectos@test.com' });
    await request(app).put('/api/marcas/panel/mi-marca').set(A(tokenA)).send({ cuenta: otraCuenta._id, estado: 'publicado', slug: 'hack', nombreComercial: 'Persianas Aurora' }).expect(200);
    const a = await Brand.findOne({ nombreComercial: 'Persianas Aurora' });
    assert.notEqual(String(a.cuenta), String(otraCuenta._id));
    assert.notEqual(a.slug, 'hack');
    const rb = await request(app).get('/api/marcas/panel/mi-marca').set(A(tokenB)).expect(200);
    assert.equal(rb.body.marca.nombreComercial, 'Estudio Bruma Arquitectos');
  });

  console.log('\n▶ Medios de acceso adicionales (verificación antes de guardar)');
  await prueba('agregar teléfono exige código; no se guarda sin verificar', async () => {
    await request(app).post('/api/marcas/panel/cuenta/acceso/solicitar').set(A(tokenA)).send({ canal: 'sms', telefono: '+52 33 9999 0000' }).expect(200);
    assert.equal((await BrandAccount.findOne({ email: 'persianas@test.com' })).telefono, undefined);
    assert.equal((await request(app).post('/api/marcas/panel/cuenta/acceso/confirmar').set(A(tokenA)).send({ canal: 'sms', telefono: '+52 33 9999 0000', codigo: '000000' })).status, 400);
    const ok = await request(app).post('/api/marcas/panel/cuenta/acceso/confirmar').set(A(tokenA)).send({ canal: 'sms', telefono: '+52 33 9999 0000', codigo: '654321' }).expect(200);
    assert.equal(ok.body.cuenta.telefonoVerificado, true); assert.equal(ok.body.cuenta.email, 'persianas@test.com');
  });
  await prueba('un teléfono ya usado por otra cuenta se rechaza (409)', async () => {
    const r = await request(app).post('/api/marcas/panel/cuenta/acceso/solicitar').set(A(tokenB)).send({ canal: 'sms', telefono: '+52 33 9999 0000' });
    assert.equal(r.status, 409);
  });
  await prueba('el contacto público NO se mezcla con las credenciales de acceso', async () => {
    const b = await Brand.findOne({ nombreComercial: 'Persianas Aurora' });
    assert.equal(b.contacto.telefono, '55 1234 5678');
    const lst = await lista('q=aurora');
    assert.ok(!JSON.stringify(lst).includes('+523399990000'));
  });

  console.log('\n▶ Moderación posterior (admin)');
  const idA = (await Brand.findOne({ nombreComercial: 'Persianas Aurora' }))._id.toString();
  const adm = (m, url, body) => request(app)[m](`/api/admin/marcas${url}`).set(A(tAdmin)).send(body || {});
  await prueba('admin lista y busca por nombre, correo de cuenta, teléfono de cuenta, ciudad y categoría', async () => {
    for (const q of ['aurora', 'persianas@test.com', '3399990000', 'querétaro', 'arquitectura']) {
      const r = await adm('get', `?q=${encodeURIComponent(q)}`).expect(200);
      assert.ok(r.body.total >= 1, `sin resultados para ${q}`);
    }
  });
  await prueba('detalle admin trae cuenta, solicitudes y bitácora', async () => {
    const r = await adm('get', `/${idA}`).expect(200);
    assert.equal(r.body.marca.cuenta.email, 'persianas@test.com'); assert.ok(Array.isArray(r.body.solicitudes));
  });
  await prueba('solicitar cambios SIN ocultar: la marca sigue pública y el proveedor ve el aviso', async () => {
    await adm('post', `/${idA}/solicitudes`, { campo: 'portada', motivo: 'Portada inadecuada', mensaje: 'Reemplaza la fotografía de portada por una de tu trabajo.', ocultarMientras: false }).expect(201);
    assert.equal((await lista('q=aurora')).total, 1);
    const s = await request(app).get('/api/marcas/panel/mi-marca/solicitudes').set(A(tokenA)).expect(200);
    assert.equal(s.body.solicitudes[0].campo, 'portada'); assert.equal(s.body.solicitudes[0].de, 'Equipo SomosViveMás');
    assert.ok(!JSON.stringify(s.body).includes('Admin Prueba'));
  });
  let sid;
  await prueba('solicitar cambios OCULTANDO: sale del directorio hasta que el proveedor la atiende', async () => {
    const c = await adm('post', `/${idA}/solicitudes`, { campo: 'descripcion', motivo: 'Descripción engañosa', mensaje: 'Corrige la descripción para reflejar los servicios reales.', ocultarMientras: true }).expect(201);
    sid = c.body.solicitud._id;
    assert.equal((await lista('q=aurora')).total, 0);
    assert.equal((await request(app).get('/api/marcas/publico/' + (await Brand.findById(idA)).slug)).status, 404);
    const panel = await request(app).get('/api/marcas/panel/mi-marca').set(A(tokenA)).expect(200);
    assert.equal(panel.body.marca.ocultoPorModeracion, true); assert.equal(panel.body.marca.solicitudesAbiertas, 2);
    await request(app).post(`/api/marcas/panel/mi-marca/solicitudes/${sid}/atender`).set(A(tokenA)).send({ nota: 'Ya corregí la descripción' }).expect(200);
    assert.equal((await lista('q=aurora')).total, 1);
  });
  await prueba('otra cuenta no puede atender la solicitud ajena', async () => {
    assert.equal((await request(app).post(`/api/marcas/panel/mi-marca/solicitudes/${sid}/atender`).set(A(tokenB)).send({})).status, 404);
  });
  await prueba('admin cierra una solicitud (resolver) y se registra en la bitácora', async () => {
    await adm('patch', `/${idA}/solicitudes/${sid}`, { accion: 'resolver' }).expect(200);
    const s = await adm('get', `/${idA}`).expect(200);
    assert.equal(s.body.solicitudes.find((x) => x._id === sid).estado, 'resuelta');
  });
  await prueba('bloquear exige motivo; al bloquear desaparece del directorio, filtros y detalle', async () => {
    assert.equal((await adm('post', `/${idA}/bloquear`, { motivo: '' })).status, 400);
    await adm('post', `/${idA}/bloquear`, { motivo: 'Información engañosa reiterada' }).expect(200);
    assert.equal((await lista('q=aurora')).total, 0);
    assert.equal((await lista('categoria=persianas-cortinas-y-decoracion&ciudad=queretaro')).total, 0);
    assert.ok(!(await request(app).get('/api/marcas/publico/filtros')).body.ciudades.some((c) => c.slug === 'queretaro'));
    assert.equal((await request(app).get('/api/marcas/publico/' + (await Brand.findById(idA)).slug)).status, 404);
  });
  await prueba('bloqueada: el proveedor NO puede republicar y editar tampoco la vuelve a mostrar', async () => {
    const p = await request(app).post('/api/marcas/panel/mi-marca/publicar').set(A(tokenA));
    assert.equal(p.status, 403);
    await request(app).put('/api/marcas/panel/mi-marca').set(A(tokenA)).send({ descripcionCorta: 'Persianas, cortinas y decoración a la medida, texto actualizado hoy.' }).expect(200);
    assert.equal((await Brand.findById(idA)).estado, 'bloqueado');
    assert.equal((await lista('q=aurora')).total, 0);
    const panel = await request(app).get('/api/marcas/panel/mi-marca').set(A(tokenA)).expect(200);
    assert.equal(panel.body.marca.puedePublicar, false); assert.match(panel.body.marca.motivoBloqueo, /engañosa/);
    assert.equal((await request(app).post('/api/marcas/panel/mi-marca/despublicar').set(A(tokenA))).status, 400);
  });
  await prueba('reactivar la deja despublicada; el proveedor decide republicar', async () => {
    await adm('post', `/${idA}/reactivar`).expect(200);
    assert.equal((await Brand.findById(idA)).estado, 'despublicado');
    assert.equal((await lista('q=aurora')).total, 0);
    await request(app).post('/api/marcas/panel/mi-marca/publicar').set(A(tokenA)).expect(200);
    assert.equal((await lista('q=aurora')).total, 1);
  });
  await prueba('desactivar retira del directorio, conserva datos y bloquea la republicación', async () => {
    await adm('post', `/${idA}/desactivar`, { motivo: 'A petición' }).expect(200);
    assert.equal((await lista('q=aurora')).total, 0);
    assert.equal((await request(app).post('/api/marcas/panel/mi-marca/publicar').set(A(tokenA))).status, 403);
    assert.ok((await Brand.findById(idA)).nombreComercial);
    await adm('post', `/${idA}/reactivar`).expect(200);
    await request(app).post('/api/marcas/panel/mi-marca/publicar').set(A(tokenA)).expect(200);
  });
  await prueba('eliminar (lógico) oculta todo y el proveedor recibe 410; no se purga sin pasos previos', async () => {
    assert.equal((await adm('delete', `/${idA}?definitivo=true`, { confirmar: true })).status, 400); // aún no está eliminada
    await adm('delete', `/${idA}`).expect(200);
    assert.equal((await lista('q=aurora')).total, 0);
    assert.equal((await request(app).get('/api/marcas/panel/mi-marca').set(A(tokenA))).status, 410);
    assert.ok(await Brand.findById(idA), 'los datos se conservan tras la eliminación lógica');
    assert.equal((await adm('get', '?q=aurora')).body.total, 0);
    assert.equal((await adm('get', '?q=aurora&estado=eliminado')).body.total, 1);
  });
  await prueba('purga definitiva exige confirmación explícita y conserva la bitácora', async () => {
    assert.equal((await adm('delete', `/${idA}?definitivo=true`, {})).status, 400);
    await adm('delete', `/${idA}?definitivo=true`, { confirmar: true }).expect(200);
    assert.equal(await Brand.findById(idA), null);
    assert.ok(await BrandAuditLog.countDocuments({ brand: idA }) >= 6);
  });
  await prueba('la bitácora registra QUIÉN y CUÁNDO', async () => {
    const reg = await BrandAuditLog.findOne({ accion: 'bloquear' }).lean();
    assert.equal(reg.adminEmail, 'admin@test.com'); assert.ok(reg.createdAt); assert.match(reg.detalle, /engañosa/);
  });
  await prueba('acciones de moderación exigen rol admin (usuario normal y sin sesión)', async () => {
    const idB = (await Brand.findOne({ nombreComercial: 'Estudio Bruma Arquitectos' }))._id;
    assert.equal((await request(app).post(`/api/admin/marcas/${idB}/bloquear`).set(A(tUser)).send({ motivo: 'prueba de permisos' })).status, 403);
    assert.equal((await request(app).post(`/api/admin/marcas/${idB}/bloquear`).set(A(tokenB)).send({ motivo: 'prueba de permisos' })).status, 401);
    assert.equal((await request(app).delete(`/api/admin/marcas/${idB}`)).status, 401);
    assert.equal((await Brand.findById(idB)).estado, 'publicado');
  });
  await prueba('catálogos admin: crear categoría nueva y que los proveedores puedan usarla', async () => {
    const r = await adm('post', '/catalogos/categorias', { nombre: 'Paisajismo y jardinería', icono: '🌿' }).expect(201);
    assert.equal((await adm('post', '/catalogos/categorias', { nombre: 'Paisajismo y jardinería' })).status, 409);
    const pub = await request(app).get('/api/marcas/publico/catalogos').expect(200);
    assert.ok(pub.body.categorias.some((c) => c._id === r.body.categoria._id));
    await adm('put', `/catalogos/categorias/${r.body.categoria._id}`, { activa: false }).expect(200);
    const pub2 = await request(app).get('/api/marcas/publico/catalogos').expect(200);
    assert.ok(!pub2.body.categorias.some((c) => c._id === r.body.categoria._id));
    const bad = await request(app).put('/api/marcas/panel/mi-marca').set(A(tokenB)).send({ categorias: [r.body.categoria._id] });
    assert.equal(bad.status, 400);
  });

  console.log(`\nResultado: ${pasadas} pruebas OK, ${fallos.length} con fallo`);
  if (fallos.length) { console.log('Fallaron:\n - ' + fallos.join('\n - ')); }
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.error('ERROR FATAL', e); process.exit(2); });