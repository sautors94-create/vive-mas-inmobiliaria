// ==========================================
// SEED: 5 usuarios + 5,000 propiedades (1,000 c/u)
// Fotos únicas con Picsum Photos
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
];

const PASSWORD = 'ViveMas2025!';

const ESTADOS = [
  { estado: 'Ciudad de México', ciudades: ['Benito Juárez', 'Coyoacán', 'Miguel Hidalgo', 'Álvaro Obregón'], colonias: ['Del Valle', 'Condesa', 'Polanco', 'Roma', 'Nápoles', 'Narvarte', 'Santa María la Ribera', 'Doctores', 'Tacubaya', 'Escandón'] },
  { estado: 'Jalisco', ciudades: ['Guadalajara', 'Zapopan', 'Tlaquepaque'], colonias: ['Chapalita', 'Providencia', 'Andares', 'Colinas de San Javier', 'Lomas del Valle', 'Monraz', 'Americana'] },
  { estado: 'Nuevo León', ciudades: ['Monterrey', 'San Pedro Garza García', 'San Nicolás'], colonias: ['Cumbres', 'Valle Alto', 'San Agustín', 'Zona Tec', 'Del Valle', 'Obispado'] },
  { estado: 'Puebla', ciudades: ['Puebla', 'Cholula', 'Atlixco'], colonias: ['Lomas de Angelópolis', 'La Paz', 'El Mirador', 'San Baltazar', 'Juárez'] },
  { estado: 'Guanajuato', ciudades: ['León', 'Guanajuato', 'San Miguel de Allende'], colonias: ['Arboleda', 'Valle de Campestre', 'Los Arcos', 'El Centro', 'Jardines de Jerez'] },
  { estado: 'Querétaro', ciudades: ['Querétaro', 'El Marqués', 'Corregidora'], colonias: ['Juriquilla', 'Zibatá', 'El Refugio', 'Lomas de Casa Blanca', 'Balcones del Valle'] },
  { estado: 'Yucatán', ciudades: ['Mérida', 'Progreso', 'Umán'], colonias: ['Montebello', 'Paseo de Montejo', 'Temozón Norte', 'Las Américas', 'García Ginerés'] },
  { estado: 'Quintana Roo', ciudades: ['Cancún', 'Playa del Carmen', 'Tulum', 'Cozumel'], colonias: ['Zona Hotelera', 'Playa Paraíso', 'Aldea Zama', 'Centro', 'Puerto Juárez'] },
  { estado: 'Baja California Sur', ciudades: ['La Paz', 'Cabo San Lucas', 'San José del Cabo'], colonias: ['El Cortés', 'Palmilla', 'Puerto Paraíso', 'Centro', 'Chileno Bay'] },
  { estado: 'Estado de México', ciudades: ['Toluca', 'Naucalpan', 'Huixquilucan'], colonias: ['Lomas de Tecamachalco', 'Fracc. La Herradura', 'Zona Esmeralda', 'Centro', 'Interlomas'] },
  { estado: 'Morelos', ciudades: ['Cuernavaca', 'Cuautla', 'Tepoztlán'], colonias: ['Rancho Cortés', 'Club de Golf', 'El Mirador', 'Centro', 'Lomas de Cortés'] },
  { estado: 'Michoacán', ciudades: ['Morelia', 'Uruapan', 'Pátzcuaro'], colonias: ['Chapultepec Norte', 'Lomas del Valle', 'Centro', 'Félix Ireta', 'Juárez'] },
  { estado: 'Veracruz', ciudades: ['Veracruz', 'Xalapa', 'Boca del Río'], colonias: ['Costa Verde', 'Reforma', 'Las Ánimas', 'Playa Linda', 'Fracc. Costa de Oro'] },
  { estado: 'Sinaloa', ciudades: ['Culiacán', 'Mazatlán', 'Los Mochis'], colonias: ['Chapultepec', 'Lomas de Mazatlán', 'Palos Verdes', 'Centro', 'Marina Mazatlán'] },
  { estado: 'Sonora', ciudades: ['Hermosillo', 'Ciudad Obregón', 'Navojoa'], colonias: ['Pitic', 'Lomas de Madrid', 'Centro', 'Real del Sol', 'Villas del Sol'] },
  { estado: 'Tabasco', ciudades: ['Villahermosa', 'Cárdenas', 'Comalcalco'], colonias: ['Tabasco 2000', 'Real de Minas', 'Centro', 'Lomas del Estadio', 'Gregorio Méndez'] },
  { estado: 'Tamaulipas', ciudades: ['Tampico', 'Reynosa', 'Matamoros'], colonias: ['Altamira', 'Lomas de Tampico', 'Centro', 'Río Bravo', 'Prados del Este'] },
  { estado: 'Chihuahua', ciudades: ['Chihuahua', 'Ciudad Juárez'], colonias: ['Campos Elíseos', 'Nombre de Dios', 'Centro', 'Solarres'] },
  { estado: 'Aguascalientes', ciudades: ['Aguascalientes', 'Jesús María'], colonias: ['Villa Bonita', 'Lomas del Campestre', 'Centro', 'San José'] },
  { estado: 'Hidalgo', ciudades: ['Pachuca', 'Tula', 'Real del Monte'], colonias: ['Zona Plateada', 'El Paraíso', 'Centro', 'La Paz', 'Mineral de la Reforma'] },
];

const ADJETIVOS = ['Excelente', 'Hermosa', 'Moderno', 'Cómodo', 'Elegante', 'Funcional', 'Amplio', 'Precioso', 'Lujoso', 'Acogedor', 'Espacioso', 'Encantador', 'Impecable', 'Exclusivo', 'Familiar', 'Premium', 'Magnífico', 'Soñado', 'Privilegiado', 'Único'];
const TIPOS = ['casa', 'departamento', 'terreno', 'local', 'casa', 'departamento', 'casa', 'departamento']; // Más casas y deps
const OPERACIONES = ['venta', 'renta', 'venta', 'venta']; // Más ventas

// Fotos base de Unsplash (casas, departamentos, interiores)
const FOTOS_BASE = [
  'photo-1564013799919-ab600027ffc6', // casa moderna
  'photo-1570129477492-45c003edd2be', // casa grande
  'photo-1568605114967-8130f3a36994', // casa lujosa
  'photo-1576941089067-2de3c901e126', // departamento
  'photo-1580587771525-78b9dba3b914', // fachada
  'photo-1600585154340-be6161a56a0c', // casa estilo
  'photo-1600566753086-00f18fb6b3ea', // interior moderno
  'photo-1600607687939-ce8a6c25118c', // sala
  'photo-1600566753190-17f0baa2a6c3', // cocina
  'photo-1600047509807-ba8f99d2cdde', // baño
  'photo-1600047509358-9dc75507daeb', // recámara
  'photo-1600585154526-990dced4db0d', // casa blanca
  'photo-1600585153490-76fb20a32601', // jardín
  'photo-1600596542815-ffad4c1539a9', // alberca
  'photo-1600573472591-ee6981cf35b6', // edificio
  'photo-1598928506311-c55ded91a20c', // departamento moderno
  'photo-1600210492486-724fe5c67fb0', // interior elegante
  'photo-1600121848594-d8644e57abab', // casa contemp.
  'photo-1613490493576-7fde63acd811', // propiedad
  'photo-1615873968403-89e068629265', // terreno
  'photo-1512917774080-9991f1c4c750', // casa lujo
  'photo-1600596542815-ffad4c1539a9', // alberca casa
  'photo-1600607687644-aac4c3eac7f4', // living
  'photo-1600566753376-12c8ab7fb75b', // casa dos pisos
  'photo-1600585154363-67eb9e2e2099', // entrada
  'photo-1560448204-e02f11c3d0e2', // casa colonial
  'photo-1583608205776-bfd35f0d9f83', // depa vista
  'photo-1600573472550-8090b5e0745e', // construcción
  'photo-1600047508788-782f5e8a7e21', // recámara principal
  'photo-1600585154084-4e5fe7c39198', // fachada moderna
];

const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDecimal = (min, max) => Math.round((Math.random() * (max - min) + min) * 100) / 100;

// Generar fotos únicas usando Picsum + Unsplash
const generarFotos = (propId) => {
  const numFotos = randomInt(4, 7);
  const fotos = [];
  
  // 2 fotos de Unsplash (variando parámetros para que se vean diferentes)
  for (let i = 0; i < 2; i++) {
    const fotoId = random(FOTOS_BASE);
    // Variar tamaño y crop para que parezcan fotos diferentes
    const anchos = [600, 700, 800, 900];
    const alturas = [400, 450, 500, 600];
    const w = random(anchos);
    const h = random(alturas);
    const fit = random(['crop', 'clamp', 'clip']);
    fotos.push(`https://images.unsplash.com/${fotoId}?w=${w}&h=${h}&fit=${fit}&q=80`);
  }
  
  // 2-5 fotos de Picsum (cada una única por seed)
  for (let i = 0; i < numFotos - 2; i++) {
    const seed = `vmas-${propId}-${i}-${Date.now()}`;
    fotos.push(`https://picsum.photos/seed/${seed}/800/600`);
  }
  
  return fotos;
};

const generarDescripcion = (tipo, colonia, ciudad, estado, caracteristicas) => {
  const descripciones = {
    casa: [
      `Hermosa casa en ${colonia}, ${ciudad}. ${caracteristicas.recamaras} recámaras, ${caracteristicas.banos} baños, estacionamiento para ${caracteristicas.estacionamientos} autos. Excelente ubicación cercana a escuelas y centros comerciales.`,
      `Casa con acabados de lujo en ${colonia}, ${ciudad}, ${estado}. Amplios espacios de ${caracteristicas.m2}m², ideal para familia. Seguridad 24 horas y áreas verdes.`,
      `Preciosa casa familiar en una de las mejores zonas de ${colonia}. ${caracteristicas.recamaras} recámaras con closet, cocina integral, sala y comedor amplios. ${caracteristicas.m2}m² de construcción.`,
    ],
    departamento: [
      `Moderno departamento en ${colonia}, ${ciudad}. ${caracteristicas.recamaras} recámaras, ${caracteristicas.banos} baños. Vista panorámica, gimnasio y alberca en el edificio.`,
      `Departamento de lujo en ${colonia}, ${estado}. ${caracteristicas.m2}m², acabados de primera, cocina equipada, balcón con vista. Incluye 1 lugar de estacionamiento.`,
      `Excelente oportunidad en ${ciudad}. Departamento de ${caracteristicas.recamaras} recámaras en zona privilegiada de ${colonia}. Cerca de transporte y servicios.`,
    ],
    terreno: [
      `Terreno de ${caracteristicas.m2}m² en ${colonia}, ${ciudad}. Ideal para construir tu casa soñada. Servicios disponibles, escrituras al corriente.`,
      `Excelente terreno en zona de plusvalía en ${colonia}, ${estado}. ${caracteristicas.m2}m² con todos los servicios. Ubicación privilegiada cerca de vialidades principales.`,
      `Terreno comercial/residencial en ${ciudad}. Superficie de ${caracteristicas.m2}m² en ${colonia}, perfecto para desarrollo o uso propio.`,
    ],
    local: [
      `Local comercial en ${colonia}, ${ciudad}. ${caracteristicas.m2}m², excelente ubicación con gran afluencia vehicular y peatonal. Ideal para negocio.`,
      `Amplio local en zona comercial de ${colonia}, ${estado}. ${caracteristicas.m2}m², estacionamiento propio, fachada amplia. Excelente visibilidad.`,
      `Local comercial a estrenar en ${ciudad}. Ubicado en ${colonia}, zona de alta plusvalía. ${caracteristicas.m2}m² de superficie, baños y estacionamiento incluidos.`,
    ],
  };
  
  return random(descripciones[tipo] || descripciones.casa);
};

const generarTitulo = (adjetivo, tipo, colonia, ciudad) => {
  const titulos = [
    `${adjetivo} ${tipo} en ${colonia}`,
    `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} ${adjetivo.toLowerCase()} - ${colonia}, ${ciudad}`,
    `${adjetivo} ${tipo} de lujo en ${colonia}, ${ciudad}`,
    `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} en venta en ${colonia}`,
    `Oportunidad: ${adjetivo.toLowerCase()} ${tipo} ${colonia}`,
  ];
  return random(titulos);
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
    precio = tipo === 'terreno' ? randomInt(5000, 25000) : 
             tipo === 'local' ? randomInt(15000, 80000) :
             tipo === 'casa' ? randomInt(15000, 65000) : 
             randomInt(10000, 45000);
  } else {
    precio = tipo === 'terreno' ? randomInt(400000, 4500000) : 
             tipo === 'local' ? randomInt(800000, 12000000) :
             tipo === 'casa' ? randomInt(1200000, 18000000) : 
             randomInt(800000, 8000000);
  }

  const caracteristicas = {
    recamaras: tipo === 'terreno' || tipo === 'local' ? 0 : randomInt(1, 5),
    banos: tipo === 'terreno' || tipo === 'local' ? 0 : randomInt(1, 4),
    mediosBanos: tipo === 'terreno' || tipo === 'local' ? 0 : randomInt(0, 2),
    estacionamientos: tipo === 'terreno' ? 0 : randomInt(0, 3),
    m2: tipo === 'terreno' ? randomInt(100, 2000) : 
        tipo === 'local' ? randomInt(40, 300) :
        tipo === 'casa' ? randomInt(80, 450) : 
        randomInt(35, 200),
  };

  const propId = `u${userIdx}-p${propIdx}`;
  const CALLES = ['Reforma', 'Insurgentes', 'Álvaro Obregón', 'Juárez', 'Morelos', 'Hidalgo', 'Madero', '5 de Mayo', 'Allende', 'Guerrero', 'Libertad', 'Paz', 'Mirador', 'Lomas', 'Valle'];

  return {
    titulo: generarTitulo(adjetivo, tipo, colonia, ciudad),
    descripcion: generarDescripcion(tipo, colonia, ciudad, loc.estado, caracteristicas),
    precio,
    operacion,
    tipo,
    status: 'aprobada',
    fotos: generarFotos(propId),
    ubicacion: {
      estado: loc.estado,
      ciudad,
      colonia,
      direccion: `Calle ${random(CALLES)} #${randomInt(100, 999)}, ${colonia}`,
      lat: randomDecimal(15, 32),
      lng: randomDecimal(-117, -86),
    },
    caracteristicas,
    planPeso: 3,
    destacada: propIdx % 8 === 0, // ~12% destacadas
    vistas: randomInt(5, 500),
    contactos: randomInt(0, 15),
    moderacionIA: {
      decision: 'APPROVED',
      confidence: randomDecimal(0.90, 0.99),
      riskScore: randomInt(3, 20),
      riskLevel: 'LOW',
      summary: 'Propiedad verificada automáticamente. Datos consistentes.',
      issues: [],
      analizadoEn: new Date(),
      agentesEjecutados: ['validacion', 'moderacion'],
    },
  };
};

const run = async () => {
  console.time('⏱️ Tiempo total');
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // 1. Crear/actualizar usuarios
    const usuariosCreados = [];
    for (let i = 0; i < USUARIOS.length; i++) {
      const u = USUARIOS[i];
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
        user.identidadVerificada = true;
        await user.save();
        console.log(`ℹ️  Usuario actualizado: ${u.email}`);
      }
      usuariosCreados.push({ user, indice: i });
    }

    // 2. Generar 5,000 propiedades (1,000 por usuario)
    const PROPS_POR_USUARIO = 1000;
    let totalInsertadas = 0;
    const LOTE = 200; // Insertar de 200 en 200

    for (const { user, indice } of usuariosCreados) {
      console.log(`\n🏠 Procesando ${user.nombre}...`);
      
      for (let loteNum = 0; loteNum < PROPS_POR_USUARIO; loteNum += LOTE) {
        const batch = [];
        for (let p = loteNum; p < loteNum + LOTE && p < PROPS_POR_USUARIO; p++) {
          const prop = generarPropiedad(indice, p);
          prop.propietario = user._id;
          batch.push(prop);
        }
        
        await Property.insertMany(batch);
        totalInsertadas += batch.length;
        
        const progreso = ((totalInsertadas / 5000) * 100).toFixed(1);
        console.log(`   📊 ${totalInsertadas}/5000 (${progreso}%) - Lote de ${batch.length} insertado`);
      }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`🎉 SEED COMPLETADO EXITOSAMENTE`);
    console.log(`👥 Usuarios: ${usuariosCreados.length}`);
    console.log(`🏠 Propiedades: ${totalInsertadas}`);
    console.log(`${'='.repeat(50)}\n`);

    console.log(`🔑 CREDENCIALES DE PRUEBA:`);
    console.log(`   Contraseña: ${PASSWORD}\n`);
    for (const { user } of usuariosCreados) {
      console.log(`   → ${user.email}`);
    }

    console.timeEnd('⏱️ Tiempo total');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en seed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

run();