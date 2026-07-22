const mongoose = require('mongoose');
require('dotenv').config();

const USUARIO_ID = '6a5c5147f78530855a4d7482';

const estadosMexico = [
  { nombre: 'Ciudad de México', ciudad: 'Álvaro Obregón', lat: 19.3593, lng: -99.275, precioBase: 4500000, rentaBase: 18000 },
  { nombre: 'Jalisco', ciudad: 'Zapopan', lat: 20.7239, lng: -103.3848, precioBase: 3500000, rentaBase: 15000 },
  { nombre: 'Nuevo León', ciudad: 'Monterrey', lat: 25.6866, lng: -100.3161, precioBase: 4000000, rentaBase: 16000 },
  { nombre: 'Quintana Roo', ciudad: 'Cancún', lat: 21.1619, lng: -86.8515, precioBase: 3800000, rentaBase: 20000 },
  { nombre: 'Yucatán', ciudad: 'Mérida', lat: 20.9674, lng: -89.5926, precioBase: 2800000, rentaBase: 12000 },
  { nombre: 'Puebla', ciudad: 'Puebla', lat: 19.0414, lng: -98.2063, precioBase: 2200000, rentaBase: 10000 },
  { nombre: 'Guanajuato', ciudad: 'León', lat: 21.1167, lng: -101.6711, precioBase: 2500000, rentaBase: 11000 },
  { nombre: 'Querétaro', ciudad: 'Querétaro', lat: 20.5888, lng: -100.3899, precioBase: 3000000, rentaBase: 14000 },
  { nombre: 'Chihuahua', ciudad: 'Chihuahua', lat: 28.6353, lng: -106.0889, precioBase: 2400000, rentaBase: 11000 },
  { nombre: 'Baja California', ciudad: 'Tijuana', lat: 32.5149, lng: -117.0382, precioBase: 2800000, rentaBase: 13000 },
  { nombre: 'Sonora', ciudad: 'Hermosillo', lat: 29.0729, lng: -110.9559, precioBase: 2200000, rentaBase: 10000 },
  { nombre: 'Coahuila', ciudad: 'Saltillo', lat: 25.4385, lng: -100.9971, precioBase: 2300000, rentaBase: 10500 },
  { nombre: 'Veracruz', ciudad: 'Xalapa', lat: 19.5273, lng: -96.9205, precioBase: 1800000, rentaBase: 8000 },
  { nombre: 'Aguascalientes', ciudad: 'Aguascalientes', lat: 21.8853, lng: -102.2916, precioBase: 2100000, rentaBase: 9500 },
  { nombre: 'San Luis Potosí', ciudad: 'San Luis Potosí', lat: 22.1565, lng: -100.9855, precioBase: 2000000, rentaBase: 9000 },
  { nombre: 'Sinaloa', ciudad: 'Culiacán', lat: 24.7903, lng: -107.3878, precioBase: 1900000, rentaBase: 8500 },
  { nombre: 'Tamaulipas', ciudad: 'Tampico', lat: 22.2228, lng: -97.8686, precioBase: 1700000, rentaBase: 8000 },
  { nombre: 'Michoacán', ciudad: 'Morelia', lat: 19.7012, lng: -101.1944, precioBase: 1600000, rentaBase: 7000 },
  { nombre: 'Oaxaca', ciudad: 'Oaxaca', lat: 17.0732, lng: -96.7266, precioBase: 1500000, rentaBase: 6500 },
  { nombre: 'Guerrero', ciudad: 'Acapulco', lat: 16.8531, lng: -99.8237, precioBase: 2000000, rentaBase: 12000 },
  { nombre: 'Tabasco', ciudad: 'Villahermosa', lat: 17.9868, lng: -92.9303, precioBase: 1700000, rentaBase: 7500 },
  { nombre: 'Hidalgo', ciudad: 'Pachuca', lat: 20.1011, lng: -98.7639, precioBase: 1600000, rentaBase: 7000 },
  { nombre: 'Nayarit', ciudad: 'Tepic', lat: 21.4773, lng: -104.8953, precioBase: 1800000, rentaBase: 8000 },
  { nombre: 'Colima', ciudad: 'Manzanillo', lat: 19.0514, lng: -104.3186, precioBase: 2200000, rentaBase: 10000 },
  { nombre: 'Morelos', ciudad: 'Cuernavaca', lat: 18.9194, lng: -99.2348, precioBase: 2800000, rentaBase: 13000 },
  { nombre: 'Durango', ciudad: 'Durango', lat: 24.0277, lng: -104.6532, precioBase: 1600000, rentaBase: 7000 },
  { nombre: 'Zacatecas', ciudad: 'Zacatecas', lat: 22.7709, lng: -102.5833, precioBase: 1200000, rentaBase: 5500 },
  { nombre: 'Tlaxcala', ciudad: 'Tlaxcala', lat: 19.3181, lng: -98.2375, precioBase: 1300000, rentaBase: 6000 },
  { nombre: 'Chiapas', ciudad: 'Tuxtla', lat: 16.7569, lng: -93.1133, precioBase: 1400000, rentaBase: 6000 },
  { nombre: 'Campeche', ciudad: 'Campeche', lat: 19.8301, lng: -90.5349, precioBase: 1500000, rentaBase: 6500 },
  { nombre: 'Baja California Sur', ciudad: 'La Paz', lat: 24.1426, lng: -110.3128, precioBase: 2500000, rentaBase: 11000 },
  { nombre: 'Quintana Roo', ciudad: 'Tulum', lat: 20.2114, lng: -87.4654, precioBase: 5000000, rentaBase: 25000 }
];

const tipos = ['casa', 'departamento', 'local', 'terreno'];
const operaciones = ['venta', 'renta'];
const colonias = ['Centro', 'Jardines del Valle', 'Residencial San Ángel', 'Villa Florida', 'Las Américas'];

const fotosPorTipo = {
  casa: ['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800', 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800'],
  departamento: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800'],
  local: ['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800', 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800'],
  terreno: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800', 'https://images.unsplash.com/photo-1416339306562-f3d12fefd36f?w=800']
};

async function seedDatabase() {
  try {
    // Conecta usando tu variable de entorno del .env
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🟢 Conectado a MongoDB');

    // Obtener la base de datos directamente (sin importar modelos)
    const db = mongoose.connection.db;
    
    // Forzar el nombre exacto de la colección que nos diste
    const collectionName = 'properties';
    const collection = db.collection(collectionName);
    console.log(`✅ Usando la colección: "${collectionName}"`);

    const propiedadesAGuardar = [];

    estadosMexico.forEach((estado) => {
      for (let i = 0; i < 5; i++) {
        const tipo = tipos[i % tipos.length];
        const operacion = operaciones[i % operaciones.length];
        
        const variacion = 0.8 + (Math.random() * 0.4); 
        const precio = operacion === 'venta' 
          ? Math.floor(estado.precioBase * variacion) 
          : Math.floor(estado.rentaBase * variacion);

        propiedadesAGuardar.push({
          titulo: `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} en ${operacion} en ${estado.ciudad}`,
          descripcion: `Excelente ${tipo} ubicado en la colonia ${colonias[i]} de ${estado.ciudad}, ${estado.nombre}. Ideal para familias o inversión. Cuenta con acabados de primer nivel y excelente ubicación.`,
          precio: precio,
          operacion: operacion,
          tipo: tipo,
          ubicacion: {
            estado: estado.nombre,
            ciudad: estado.ciudad,
            colonia: colonias[i],
            direccion: `Calle Principal #${Math.floor(Math.random() * 900) + 100}`,
            lat: estado.lat + (Math.random() * 0.02 - 0.01),
            lng: estado.lng + (Math.random() * 0.02 - 0.01)
          },
          caracteristicas: {
            recamaras: (tipo === 'terreno' || tipo === 'local') ? 0 : Math.floor(Math.random() * 3) + 1,
            banos: (tipo === 'terreno') ? 0 : Math.floor(Math.random() * 2) + 1,
            mediosBanos: (tipo === 'casa') ? 1 : 0,
            estacionamientos: (tipo === 'departamento') ? Math.floor(Math.random() * 2) : Math.floor(Math.random() * 3),
            m2: tipo === 'terreno' ? Math.floor(Math.random() * 400) + 200 : Math.floor(Math.random() * 150) + 60
          },
          propietario: new mongoose.Types.ObjectId(USUARIO_ID),
          fotos: fotosPorTipo[tipo],
          status: 'aprobada', 
          planPeso: 0,
          destacada: i === 0,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    });

    await collection.insertMany(propiedadesAGuardar);
    console.log(`✅ ¡Éxito! Se insertaron ${propiedadesAGuardar.length} propiedades de prueba en la colección "${collectionName}".`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

seedDatabase();