// ==========================================
// SEED: 10 usuarios + 10,000 propiedades (1,000 c/u)
// Rol: basico_plus → propiedades ilimitadas
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
  { estado: 'Chiapas', ciudades: ['Tuxtla Gutiérrez', 'San Cristóbal', 'Tapachula'], colonias: ['La Marimba', 'El Cerrillo', 'Moctezuma', 'Centro'] },
  { estado: 'Estado de México', ciudades: ['Toluca', 'Naucalpan', 'Huixquilucan'], colonias: ['Lomas de Tecamachalco', 'Fracc. La Herradura', 'Zona Esmeralda', 'Centro'] },
  { estado: 'Morelos', ciudades: ['Cuernavaca', 'Cuautla', 'Tepoztlán'], colonias: ['Rancho Cortés', 'Club de Golf', 'El Mirador', 'Centro'] },
  { estado: 'Hidalgo', ciudades: ['Pachuca', 'Tula', 'Real del Monte'], colonias: ['Zona Plateada', 'El Paraíso', 'Centro', 'La Paz'] },
  { estado: 'Tabasco', ciudades: ['Villahermosa', 'Cárdenas', 'Comalcalco'], colonias: ['Tabasco 2000', 'Real de Minas', 'Centro', 'Lomas del Estadio'] },
  { estado: 'Michoacán', ciudades: ['Morelia', 'Uruapan', 'Pátzcuaro'], colonias: ['Chapultepec Norte', 'Lomas del Valle', 'Centro', 'Félix Ireta'] },
];

const ADJETIVOS = ['Excelente', 'Hermosa', 'Moderno', 'Cómodo', 'Elegante', 'Funcional', 'Amplio', 'Precioso', 'Lujoso', 'Acogedor', 'Espacioso', 'Encantador', 'Impecable', 'Exclusivo', 'Familiar', 'Premium'];
const TIPOS = ['casa', 'departamento', 'terreno', 'local'];
const OPERACIONES = ['venta', 'renta'];

const FOTOS_UNSPLASH = [
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800',
  'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800',
  'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800',
  'https://images.unsplash.com/photo-1576941089067-2de3c901e126?w=800',
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800',
  'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800',
  'https://images.unsplash.com/photo-1600047509358-9dc75507daeb?w=800',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800',
  'https://images.unsplash.com/photo-1600585153490-76fb20a32601?w=800',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
  'https://images.unsplash.com/photo-1600573472591-ee6981cf35b6?w=800',
  'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800',
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800',
  'https://images.unsplash.com/photo-1600121848594-d8644e57abab?w=800',
  'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800',
  'https://images.unsplash.com/photo-1615873968403-89e068629265?w=800',
];

const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDecimal = (min, max) => Math.round((Math.random() * (max - min) + min) * 100) / 100;

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

const elegirFotos = () => {
  const numFotos = randomInt(3, 6);
  const fotos = [];
  const copia = [...FOTOS_UNSPLASH];
  for (let i = 0; i < numFotos; i++) {
    const idx = randomInt(0, copia.length - 1);
    fotos.push(copia.splice(idx, 1)[0]);
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

  // Precio según operación y tipo
  let precio;
  if (operacion === 'renta') {
    precio = tipo === 'terreno' ? randomInt(8000, 40000) : randomInt(12000, 90000);
  } else {
    precio = tipo === 'terreno' ? randomInt(500000, 5000000) : randomInt(1500000, 25000000);
  }

  return {
    titulo: generarTitulo(adjetivo, tipo, colonia),
    descripcion: generarDescripcion(tipo, colonia, ciudad, loc.estado),
    precio,
    operacion,
    tipo,
    status: 'aprobada',
    fotos: elegirFotos(),
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
    planPeso: 3, // basico_plus (prioridad máxima)
    destacada: propIdx % 10 === 0, // 10% destacadas
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

    // 1. Crear/actualizar usuarios
    const usuariosCreados = [];
    for (let i = 0; i < USUARIOS.length; i++) {
      const u = USUARIOS[i];
      // Buscar o crear
      let user = await User.findOne({ email: u.email });
      if (!user) {
        user = await User.create({
          nombre: u.nombre,
          email: u.email,
          password: PASSWORD,
          telefono: u.telefono,
          role: 'basico_plus', // ← Propiedades ilimitadas
          plan: 'basico',
          verificado: true,
          identidadVerificada: true,
          status: 'activo',
        });
        console.log(`✅ Usuario creado: ${u.email} / ${PASSWORD}`);
      } else {
        // Asegurar rol correcto
        user.role = 'basico_plus';
        user.verificado = true;
        user.identidadVerificada = true;
        await user.save();
        console.log(`ℹ️ Usuario existente actualizado: ${u.email}`);
      }
      usuariosCreados.push({ user, indice: i });
    }

    // 2. Generar 10,000 propiedades (1,000 por usuario)
    const PROPS_POR_USUARIO = 1000;
    let totalInsertadas = 0;

    for (const { user, indice } of usuariosCreados) {
      const batch = [];
      for (let p = 0; p < PROPS_POR_USUARIO; p++) {
        const prop = generarPropiedad(indice, p);
        prop.propietario = user._id;
        batch.push(prop);
      }
      // Insertar en lotes de 100 para no saturar
      for (let i = 0; i < batch.length; i += 100) {
        const lote = batch.slice(i, i + 100);
        await Property.insertMany(lote);
        totalInsertadas += lote.length;
      }
      console.log(`📊 ${user.nombre}: +${PROPS_POR_USUARIO} propiedades ({totalInsertadas}/10000)`);
    }

    console.log(`\n========================================`);
    console.log(`🎉 SEED COMPLETADO`);
    console.log(`👥 Usuarios: ${usuariosCreados.length}`);
    console.log(`🏠 Propiedades: ${totalInsertadas}`);
    console.log(`========================================\n`);

    console.log(`🔑 CREDENCIALES DE ADMINISTRACIÓN`);
    console.log(`   Contraseña común: ${PASSWORD}\n`);
    for (const { user } of usuariosCreados) {
      console.log(`   → ${user.email}`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en seed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

run();
