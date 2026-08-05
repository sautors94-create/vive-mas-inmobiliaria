// ==========================================
// LIMPIEZA: Eliminar las 769 propiedades originales de prueba
// Criterio: moderacionIA.decision = null (sin moderación IA completada)
// Las 10,000 nuevas tienen decision='APPROVED' y agentesEjecutados
// ==========================================
require('dotenv').config();
const mongoose = require('mongoose');
const Property = require('./src/models/Property');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Contar antes
    const totalAntes = await Property.countDocuments();
    console.log(`📊 Total propiedades antes de limpiar: ${totalAntes}`);

    // Eliminar las propiedades originales de prueba (sin moderación IA)
    const resultado = await Property.deleteMany({
      'moderacionIA.decision': null
    });
    console.log(`🗑️ Eliminadas: ${resultado.deletedCount} propiedades originales de prueba`);

    // Contar después
    const totalDespues = await Property.countDocuments();
    console.log(`📊 Total propiedades después de limpiar: ${totalDespues}`);

    // Verificar que quedan las 10,000 nuevas
    const aprobadas = await Property.countDocuments({ status: 'aprobada' });
    console.log(`✅ Propiedades aprobadas restantes: ${aprobadas}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

run();
