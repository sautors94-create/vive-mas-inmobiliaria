// ==========================================
// DIAGNÓSTICO: Identificar las propiedades originales
// ==========================================
require('dotenv').config();
const mongoose = require('mongoose');
const Property = require('./src/models/Property');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Total
    const total = await Property.countDocuments();
    console.log(`📊 Total propiedades: ${total}`);

    // Por decisión de moderación
    const conDecision = await Property.countDocuments({ 'moderacionIA.decision': { $ne: null } });
    const sinDecision = await Property.countDocuments({ 'moderacionIA.decision': null });
    console.log(`✅ Con moderación IA (decision != null): ${conDecision}`);
    console.log(`❌ Sin moderación IA (decision = null): ${sinDecision}`);

    // Por propietario
    const porPropietario = await Property.aggregate([
      { $group: { _id: '$propietario', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 15 }
    ]);
    console.log('\n📊 Propiedades por propietario:');
    for (const p of porPropietario) {
      console.log(`  → ${p._id}: ${p.total}`);
    }

    // Muestra de propiedades sin moderación IA
    const sinMod = await Property.find({ 'moderacionIA.decision': null }).limit(3);
    console.log('\n📋 Muestra de propiedades sin moderación IA:');
    for (const p of sinMod) {
      console.log(`  - ${p.titulo} | propietario: ${p.propietario} | fotos: ${(p.fotos||[]).length} | status: ${p.status}`);
    }

    // Muestra de propiedades del Admin original
    const adminProps = await Property.find({ propietario: '6a5c5147f78530855a4d7482' }).limit(3);
    console.log('\n📋 Muestra de propiedades del Admin original:');
    for (const p of adminProps) {
      console.log(`  - ${p.titulo} | moderacionIA.decision: ${p.moderacionIA?.decision} | fotos: ${(p.fotos||[]).length}`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

run();
