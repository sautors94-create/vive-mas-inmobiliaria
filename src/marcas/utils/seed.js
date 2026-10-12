const { BrandCategory, BrandCity } = require('../models');

const categoriasIniciales = [
  'Arquitectura y diseño de interiores',
  'Notarías y servicios legales',
  'Persianas, cortinas y decoración',
  'Remodelación, construcción y mantenimiento',
  'Mudanzas y logística',
  'Fotografía y servicios inmobiliarios',
  'Servicios para el hogar',
  'Otros servicios profesionales'
];

const ciudadesIniciales = [
  'Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Querétaro', 
  'Tijuana', 'Mérida', 'Cancún', 'Aguascalientes', 'León'
  // Puedes agregar más ciudades aquí
];

const slugify = (text) => text.toString().toLowerCase().trim()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');

async function sembrarCatalogos() {
  try {
    for (const nombre of categoriasIniciales) {
      const exists = await BrandCategory.findOne({ nombre });
      if (!exists) await BrandCategory.create({ nombre, slug: slugify(nombre) });
    }
    for (const nombre of ciudadesIniciales) {
      const exists = await BrandCity.findOne({ nombre });
      if (!exists) await BrandCity.create({ nombre, slug: slugify(nombre) });
    }
    console.log('✅ Catálogos de Marcas sembrados correctamente.');
  } catch (error) {
    console.error('❌ Error sembrando catálogos de marcas:', error.message);
  }
}

module.exports = { sembrarCatalogos };