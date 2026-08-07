// ==========================================
// SEED: Cupones iniciales del sitio
// Asegura SOMOSASESORES (Básico Plus, uso ilimitado, sin pago)
// y crea cupones Stripe de referencia (mensual/anual/descuentos).
//
// Es idempotente: si el cupón ya existe lo actualiza (upsert por codigo),
// no duplica registros.
// ==========================================
require('dotenv').config();
const mongoose = require('mongoose');
const Cupon = require('./src/models/Cupon');

// ==========================================
// DEFINICIÓN DE CUPONES A SEMBRAR
// ==========================================
const CUPONES = [
  {
    // Acceso gratuito Básico Plus para asesores inmobiliarios
    codigo: 'SOMOSASESORES',
    tipo: 'basico_plus',
    descripcion: 'Acceso Básico Plus por 1 año para asesores inmobiliarios (gratuito, sin pago).',
    dias: 360,
    activo: true,
    expiraEn: null,           // sin expiración
    usosMaximos: null,        // null = ilimitado
  },
  {
    // Referencia: cupón mensual (requiere crear el cupón en Stripe)
    codigo: 'BASICO_MENSUAL',
    tipo: 'stripe',
    descripcion: 'Descuento aplicado vía Stripe para el plan Básico mensual.',
    stripe_coupon_id: null,   // reemplaza con el ID real en Stripe
    stripe_price_link: 'https://buy.stripe.com/3cIeVeebe5dBfUyevM2Ji00',
    activo: false,            // desactivado por defecto (solo referencia)
    expiraEn: null,
    usosMaximos: null,
  },
  {
    // Referencia: cupón anual (requiere crear el cupón en Stripe)
    codigo: 'BASICO_ANUAL',
    tipo: 'stripe',
    descripcion: 'Descuento aplicado vía Stripe para el plan Básico anual.',
    stripe_coupon_id: null,   // reemplaza con el ID real en Stripe
    stripe_price_link: 'https://buy.stripe.com/14AaEYaZ20Xl0ZEcnE2Ji01',
    activo: false,            // desactivado por defecto (solo referencia)
    expiraEn: null,
    usosMaximos: null,
  },
];

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    let creados = 0;
    let actualizados = 0;

    for (const data of CUPONES) {
      const codigo = data.codigo.toUpperCase().trim();
      const existente = await Cupon.findOne({ codigo });

      if (existente) {
        // Actualizar campos relevantes (upsert)
        Object.assign(existente, data, { codigo });
        await existente.save();
        actualizados++;
        console.log(`♻️  Actualizado: ${codigo} (${existente.tipo})`);
      } else {
        await Cupon.create({ ...data, codigo });
        creados++;
        console.log(`✅ Creado: ${codigo} (${data.tipo})`);
      }
    }

    console.log(`\n========================================`);
    console.log(`🎉 SEED DE CUPONES COMPLETADO`);
    console.log(`   Creados: ${creados}`);
    console.log(`   Actualizados: ${actualizados}`);
    console.log(`========================================\n`);

    const somas = await Cupon.findOne({ codigo: 'SOMOSASESORES' });
    if (somas) {
      console.log(`ℹ️  SOMOSASESORES → tipo: ${somas.tipo}, activo: ${somas.activo}, usosMaximos: ${somas.usosMaximos ?? 'ilimitado'}, dias: ${somas.dias}, expiraEn: ${somas.expiraEn || 'sin expiración'}`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en seed de cupones:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

run();

