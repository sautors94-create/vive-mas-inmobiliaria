// Siembra los 5 Payment Links de Stripe reales que ya tienes activos para
// el Plan Básico, como registros de Cupon (tipo 'stripe'), para que
// aparezcan en Panel Admin > Cupones con su link listo para copiar.
//
// Es seguro correrlo varias veces: si el código ya existe, actualiza sus
// datos en vez de duplicarlo (upsert).
//
// Uso: node seed-payment-links.js
require('dotenv').config();
const mongoose = require('mongoose');
const Cupon = require('./src/models/Cupon');

const LINKS = [
  {
    codigo: 'PLAN-1MES-GRATIS',
    descripcion: 'PLAN BASICO VIVE MAS 1 MES GRATIS — Prueba de 30 días (luego MXN 99.00/mes)',
    stripe_price_link: 'https://buy.stripe.com/14AfZic36fSf6jYcnE2Ji04',
    createdAt: new Date('2026-08-07T06:06:00-06:00'),
  },
  {
    codigo: 'PLAN-15-ANUAL',
    descripcion: 'Plan Básico 15% Anual — MXN 849.00',
    stripe_price_link: 'https://buy.stripe.com/3cI5kEc36bBZ37MfzQ2Ji03',
    createdAt: new Date('2026-08-07T05:25:00-06:00'),
  },
  {
    codigo: 'PLAN-10-ANUAL',
    descripcion: 'Plan Básico 10% Anual — MXN 899.00',
    stripe_price_link: 'https://buy.stripe.com/00wfZic36fSffUycnE2Ji02',
    createdAt: new Date('2026-08-07T05:23:00-06:00'),
  },
  {
    codigo: 'PLAN-ANUAL-999',
    descripcion: 'Plan Básico Anual ($999) — MXN 999.00',
    stripe_price_link: 'https://buy.stripe.com/14AaEYaZ20Xl0ZEcnE2Ji01',
    createdAt: new Date('2026-08-06T09:18:00-06:00'),
  },
  {
    codigo: 'PLAN-MENSUAL-99',
    descripcion: 'PLAN BASICO VIVE MAS — MXN 99.00/mes',
    stripe_price_link: 'https://buy.stripe.com/3cIeVeebe5dBfUyevM2Ji00',
    createdAt: new Date('2026-08-06T09:18:00-06:00'),
  },
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  for (const link of LINKS) {
    const existente = await Cupon.findOne({ codigo: link.codigo });
    if (existente) {
      existente.descripcion = link.descripcion;
      existente.stripe_price_link = link.stripe_price_link;
      existente.tipo = 'stripe';
      existente.activo = true;
      await existente.save();
      console.log(`Actualizado: ${link.codigo}`);
    } else {
      await Cupon.create({
        codigo: link.codigo,
        tipo: 'stripe',
        descripcion: link.descripcion,
        stripe_price_link: link.stripe_price_link,
        activo: true,
        createdAt: link.createdAt,
      });
      console.log(`Creado: ${link.codigo}`);
    }
  }

  console.log('Listo.');
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
