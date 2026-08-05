// ==========================================
// RE-SEED: 10,000 propiedades con fotos ÚNICAS y realistas
// Cada propiedad tiene fotos visualmente distintas gracias a:
//  - Pool amplio de IDs de Unsplash (casas, interiores, terrenos, locales)
//  - Variaciones de crop/zoom (fit, crop, w, h, q) para la misma foto
//  - Asignación por tipo de propiedad (casa/departamento/terreno/local)
// ==========================================
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Property = require('./src/models/Property');

const USUARIOS = [
  { nombre: 'Inmobiliaria Norte', email: 'norte@vive-mas.mx', telefono: '5511111111' },
  { nombre: 'Inmobiliaria Sur', email: 'sur@vive-mas.mx', telefono: '5522222222' },
  { nombre: 'Inmobiliaria Este', email: 'este@vive-mas.mx', telefono: '5533333333' },
  { nombre: 'Inmobiliaria Oeste', email: 'oeste@vive-mas.mx', telefono: '5544444444' },
  { nombre: 'Inmobiliaria Centro', email: 'centro@vive-mas.mx', telefono: '5555555555' },
  { nombre: 'Desarrollos del Bajío', email: 'bajio@vive-mas.mx', telefono: '5566666666' },
  { nombre: 'Residencial México', email: 'residencial@vive-mas.mx', telefono: '5577777777' },
  { nombre: 'Vive Premium', email: 'premium@vive-mas.mx', telefono: '5588888888' },
  { nombre: 'Casas del Pacífico', email: 'pacifico@vive-mas.mx', telefono: '5599999999' },
  { nombre: 'Terrenos del Golfo', email: 'golfo@vive-mas.mx', telefono: '5510101010' },
];

const PASSWORD = 'ViveMas2025!';

const ESTADOS = [
  { estado: 'Ciudad de México', ciudades: ['Benito Juárez', 'Coyoacán', 'Miguel Hidalgo', 'Álvaro Obregón'], colonias: ['Del Valle', 'Condesa', 'Polanco', 'Roma', 'Nápoles', 'Narvarte'] },
  { estado: 'Jalisco', ciudades: ['Guadalajara', 'Zapopan', 'Tlaquepaque'], colonias: ['Chapalita', 'Providencia', 'Andares', 'Colinas de San Javier', 'Lomas del Valle'] },
  { estado: 'Nuevo León', ciudades: ['Monterrey', 'San Pedro Garza García', 'San Nicolás'], colonias: ['Cumbres', 'Valle Alto', 'San Agustín', 'Zona Tec', 'Del Valle'] },
  { estado: 'Puebla', ciudades: ['Puebla', 'Cholula', 'Atlixco'], colonias: ['Lomas de Angelópolis', 'La Paz', 'El Mirador', 'San Baltazar'] },
  { estado: 'Guanajuato', ciudades: ['León', 'Guanajuato', 'San Miguel de Allende'], colonias: ['Arboleda', 'Valle de Campestre', 'Los Arcos', 'El Centro'] },
  { estado: 'Querétaro', ciudades: ['Querétaro', 'El Marqués', 'Corregidora'], colonias: ['Juriquilla', 'Zibatá', 'El Refugio', 'Lomas de Casa Blanca'] },
  { estado: 'Yucatán', ciudades: ['Mérida', 'Progreso', 'Umán'], colonias: ['Montebello', 'Paseo de Montejo', 'Temozón Norte', 'Las Américas'] },
  { estado: 'Oaxaca', ciudades: ['Oaxaca', 'Puerto Escondido', 'Huatulco'], colonias: ['Reforma', 'La Cascada', 'Brisas de Zicatela', 'El Marqués'] },
  { estado: 'Quintana Roo', ciudades: ['Cancún', 'Playa del Carmen', 'Tulum', 'Cozumel'], colonias: ['Zona Hotelera', 'Playa Paraíso', 'Aldea Zama', 'Centro'] },
  { estado: 'Baja California Sur', ciudades: ['La Paz', 'Cabo San Lucas', 'San José del Cabo'], colonias: ['El Cortés', 'Palmilla', 'Puerto Paraíso', 'Centro'] },
  { estado: 'Baja California', ciudades: ['Tijuana', 'Mexicali', 'Ensenada'], colonias: ['Playas de Tijuana', 'Zona Río', 'Chapultepec', 'Carrizal'] },
  { estado: 'Sonora', ciudades: ['Hermosillo', 'Ciudad Obregón', 'Navojoa'], colonias: ['Pitic', 'Lomas de Madrid', 'Centro', 'Real del Sol'] },
  { estado: 'Sinaloa', ciudades: ['Culiacán', 'Mazatlán', 'Los Mochis'], colonias: ['Chapultepec', 'Lomas de Mazatlán', 'Palos Verdes', 'Centro'] },
  { estado: 'Veracruz', ciudades: ['Veracruz', 'Xalapa', 'Boca del Río'], colonias: ['Costa Verde', 'Reforma', 'Las Ánimas', 'Playa Linda'] },
  { estado: 'Estado de México', ciudades: ['Toluca', 'Naucalpan', 'Huixquilucan'], colonias: ['Lomas de Tecamachalco', 'Fracc. La Herradura', 'Zona Esmeralda', 'Centro'] },
  { estado: 'Morelos', ciudades: ['Cuernavaca', 'Cuautla', 'Tepoztlán'], colonias: ['Rancho Cortés', 'Club de Golf', 'El Mirador', 'Centro'] },
  { estado: 'Michoacán', ciudades: ['Morelia', 'Uruapan', 'Pátzcuaro'], colonias: ['Chapultepec Norte', 'Lomas del Valle', 'Centro', 'Félix Ireta'] },
];

const ADJETIVOS = ['Excelente', 'Hermosa', 'Moderno', 'Cómodo', 'Elegante', 'Funcional', 'Amplio', 'Precioso', 'Lujoso', 'Acogedor', 'Espacioso', 'Encantador', 'Impecable', 'Exclusivo', 'Familiar', 'Premium'];
const TIPOS = ['casa', 'departamento', 'terreno', 'local'];
const OPERACIONES = ['venta', 'renta'];

// ==========================================
// POOL DE IDS DE FOTOS REALES DE INMUEBLES (Unsplash)
// ==========================================

const IDS_CASA_EXTERIOR = [
  '1564013799919-ab600027ffc6', '1570129477492-45c003edd2be', '1568605114967-8130f3a36994',
  '1576941089067-2de3c901e126', '1580587771525-78b9dba3b914', '1600585154340-be6161a56a0c',
  '1600566753086-00f18fb6b3ea', '1600607687939-ce8a6c25118c', '1600566753190-17f0baa2a6c3',
  '1600047509807-ba8f99d2cdde', '1600047509358-9dc75507daeb', '1600585154526-990dced4db0d',
  '1600585153490-76fb20a32601', '1600596542815-ffad4c1539a9', '1600573472591-ee6981cf35b6',
  '1598928506311-c55ded91a20c', '1600210492486-724fe5c67fb0', '1600121848594-d8644e57abab',
  '1613490493576-7fde63acd811', '1615873968403-89e068629265', '1605276374104-dee2a0ed3cd6',
  '1600585152220-90363fe7e115', '1583608205776-bfd35f0d9f83', '1512917774080-9991f1c4c750',
  '1493809842364-78817add7ffb', '1502005229762-cf1b2da7c5d6', '1518780664697-55e3ad937233',
  '1523217582562-09d0def993a6', '1600210491369-e753d80a41f3', '1513584684374-8bab748fbf90',
  '1575517111478-7f6afd0973db', '1600210491892-03d54c0aaf87', '1600607687920-4e2a09cf159d',
  '1600566752355-35792bedcfea', '1600494603989-9650cf6ddd3d',
];

const IDS_DEPARTAMENTO = [
  '1545324418-cc1a3fa10c00', '1522708323590-d24dbb6b0267', '1502672260266-1c1ef2d93688',
  '1560448204-e02f11c3d0e2', '1560185007-cde436f6a4d0', '1560184897-ae75f418493e',
  '1560185127-6ed189bf02f4', '1554995207-c18c203602cb', '1556912173-3bb406ef7e77',
  '1556909114-f6e7ad7d3136', '1556911220-bff31c812dba', '1556909212-d5b604d0c90d',
  '1556909211-36987daf7b4d', '1556912167-f556f1f39fdf', '1584622650111-993a426fbf0a',
  '1584646098378-0874589d76b1', '1552321554-5fefe8c9ef14', '1571508601891-ca5e7a713859',
  '1616594039964-ae9021a400a0', '1616486338812-3dadae4b4ace', '1618221195710-dd6b41faaea6',
  '1616137466211-f939a420be84', '1616593969747-4799df5b0e0e', '1600210491892-03d54c0aaf87',
  '1600607687920-4e2a09cf159d', '1600566752355-35792bedcfea', '1600494603989-9650cf6ddd3d',
];

const IDS_TERRENO = [
  '1500382017468-9049fed747ef', '1500076656116-558758c991c1', '1470071459604-3b5ec3a7fe05',
  '1441974231531-c6227db76b6e', '1472214103451-9374bd1c798e', '1469474968028-56623f02e42e',
  '1470770841072-f978cf4d019e', '1501854140801-50d01698950b', '1500530855697-b586d89ba3ee',
  '1509316785289-025f5b846b35', '1518173946687-a4c8892bbd9f', '1500534314209-a25ddb2bd429',
  '1506744038136-46273834b3fb', '1501785888041-af3ef285b470', '1482938289607-e9573fc25ebb',
  '1475924156734-496f6cac6ec1',
];

const IDS_LOCAL = [
  '1441986300917-64674bd600d8', '1441984904996-e0b6ba687e04', '1524758631624-e2822e304c36',
  '1497366216548-37526070297c', '1497366811353-6870744d04b2', '1486406146926-c627a92ad1ab',
  '1497215728101-856f4ea42174', '1519389950473-47ba0277781c', '1556742049-0cfed4f6a45d',
  '1555396273-367ea4eb4db5', '1554118811-1e0d58224f24', '1517248135467-4c7edcad34c4',
  '1559925393-8be0ec4767c8', '1497366754035-f200968a6e72', '1497493292307-31c376b6e479',
  '1495474472287-4d71bcdd2085',
];

const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDecimal = (min, max) => Math.round((Math.random() * (max - min) + min) * 100) / 100;

// Construye una URL única de Unsplash con variación de crop/zoom
const construirUrlFoto = (id, variante) => {
  const anchos = [600, 800, 1000, 1200];
  const alturas = [400, 500, 600, 700, 800];
  const fits = ['crop', 'fill', 'scale'];
  const w = anchos[Math.floor(Math.random() * anchos.length)];
  const h = alturas[Math.floor(Math.random() * alturas.length)];
  const fit = fits[Math.floor(Math.random() * fits.length)];
  const q = randomInt(70, 90);
  const crop = variante % 3 === 0 ? '&crop=entropy' : '';
  return `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=${fit}&q=${q}${crop}`;
};

const generarDescripcion = (tipo, colonia, ciudad, estado) => {
  const frases = [
    `Hermoso ${tipo} ubicado en la colonia ${colonia} de ${ciudad}, ${estado}.`,
    `Excelente oportunidad de inversión en ${ciudad}. ${tipo} con acabados de primera calidad.`,
    `Ubicación privilegiada en ${colonia}, ${ciudad}. Ideal para vivir o invertir.`,
    `Moderna construcción con excelentes acabados en la zona de ${colonia}.`,
    `Privilegiada ubicación, cerca de escuelas, hospitales y centros comerciales. ${colonia}, ${ciudad}.`,
    `Amplios espacios y gran iluminación natural en este ${tipo} de ${ciudad}.`,
    `Zona exclusiva en ${colonia}. Seguridad 24/7 y áreas comunes de lujo.`,
    `Perfecto para familia, con espacios funcionales y diseño contemporáneo. ${ciudad}, ${estado}.`,
  ];
  return random(frases);
};

const generarTitulo = (adjetivo, tipo, colonia) => {
  return `${adjetivo} ${tipo} en ${colonia}`;
};

// Elige fotos únicas según el tipo, con variaciones de crop/zoom
const elegirFotosPorTipo = (tipo, numFotos, varianteBase) => {
  let pool;
  switch (tipo) {
    case 'casa':
      pool = [...IDS_CASA_EXTERIOR, ...IDS_DEPARTAMENTO.slice(0, 8)];
      break;
    case 'departamento':
      pool = [...IDS_DEPARTAMENTO, ...IDS_CASA_EXTERIOR.slice(0, 5)];
      break;
    case 'terreno':
      pool = [...IDS_TERRENO];
      break;
    case 'local':
      pool = [...IDS_LOCAL];
      break;
    default:
      pool = [...IDS_CASA_EXTERIOR];
  }

  const fotos = [];
  const copia = [...pool];
  const cantidad = Math.min(numFotos, copia.length);
  for (let i = 0; i < cantidad; i++) {
    const idx = randomInt(0, copia.length - 1);
    const id = copia.splice(idx, 1)[0];
    const variante = varianteBase + i;
    fotos.push(construirUrlFoto(id, variante));
  }
  return fotos;
};

const generarPropiedad = (userIdx, propIdx) => {
  const loc = random(ESTADOS);
  const ciudad = random(loc.ciudades);
  const colonia = random(loc.colonias);
  const tipo = random(TIPOS);
  const operacion = random(OPERACIONES);
  const adjetivo = random(ADJETIVOS);

  let precio;
  if (operacion === 'renta') {
    precio = tipo === 'terreno' ? randomInt(8000, 40000) : randomInt(12000, 90000);
  } else {
    precio = tipo === 'terreno' ? randomInt(500000, 5000000) : randomInt(1500000, 25000000);
  }

  const numFotos = randomInt(3, 6);
  const varianteBase = propIdx * 7 + userIdx * 13;

  return {
    titulo: generarTitulo(adjetivo, tipo, colonia),
    descripcion: generarDescripcion(tipo, colonia, ciudad, loc.estado),
    precio,
    operacion,
    tipo,
    status: 'aprobada',
    fotos: elegirFotosPorTipo(tipo, numFotos, varianteBase),
    ubicacion: {
      estado: loc.estado,
      ciudad,
      colonia,
      direccion: `Calle ${random(ADJETIVOS)} #${randomInt(100, 999)}`,
      lat: randomDecimal(15, 32),
      lng: randomDecimal(-117, -86),
    },
    caracteristicas: {
      recamaras: tipo === 'terreno' ? 0 : randomInt(1, 5),
      banos: tipo === 'terreno' ? 0 : randomInt(1, 4),
      mediosBanos: tipo === 'terreno' ? 0 : randomInt(0, 1),
      estacionamientos: tipo === 'terreno' ? 0 : randomInt(0, 4),
      m2: tipo === 'terreno' ? randomInt(100, 2000) : randomInt(45, 500),
    },
    planPeso: 3,
    destacada: propIdx % 10 === 0,
    vistas: randomInt(0, 350),
    moderacionIA: {
      decision: 'APPROVED',
      confidence: 0.95,
      riskScore: randomInt(5, 25),
      riskLevel: 'LOW',
      summary: 'Propiedad generada en seed automático. Datos consistentes y sin anomalías.',
      issues: [],
      analizadoEn: new Date(),
      agentesEjecutados: ['validacion', 'moderacion'],
    },
  };
};

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    const eliminadas = await Property.deleteMany({});
    console.log(`🗑️ Propiedades eliminadas: ${eliminadas.deletedCount}`);

    const usuarios = [];
    for (const u of USUARIOS) {
      let user = await User.findOne({ email: u.email });
      if (!user) {
        user = await User.create({
          nombre: u.nombre,
          email: u.email,
          password: PASSWORD,
          telefono: u.telefono,
          role: 'basico_plus',
          plan: 'basico',
          verificado: true,
          identidadVerificada: true,
          status: 'activo',
        });
        console.log(`✅ Usuario creado: ${u.email}`);
      } else {
        user.role = 'basico_plus';
        user.verificado = true;
        await user.save();
        console.log(`ℹ️ Usuario existente: ${u.email}`);
      }
      usuarios.push(user);
    }

    const PROPS_POR_USUARIO = 1000;
    let totalInsertadas = 0;

    for (let ui = 0; ui < usuarios.length; ui++) {
      const user = usuarios[ui];
      const batch = [];
      for (let p = 0; p < PROPS_POR_USUARIO; p++) {
        const prop = generarPropiedad(ui, p);
        prop.propietario = user._id;
        batch.push(prop);
      }
      for (let i = 0; i < batch.length; i += 100) {
        const lote = batch.slice(i, i + 100);
        await Property.insertMany(lote);
        totalInsertadas += lote.length;
      }
      console.log(`📊 ${user.nombre}: +${PROPS_POR_USUARIO} propiedades (${totalInsertadas}/10000)`);
    }

    console.log(`\n========================================`);
    console.log(`🎉 RE-SEED COMPLETADO`);
    console.log(`👥 Usuarios: ${usuarios.length}`);
    console.log(`🏠 Propiedades: ${totalInsertadas}`);
    console.log(`========================================\n`);

    const muestra = await Property.find().limit(5);
    console.log('📸 Muestra de fotos por propiedad:');
    for (const m of muestra) {
      console.log(`  - ${m.titulo} (${m.tipo}): ${m.fotos.length} fotos`);
      m.fotos.forEach(f => console.log(`      ${f}`));
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en re-seed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

run();
