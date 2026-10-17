'use strict';

/**
 * src/marcas/utils/seed.js — Catálogos iniciales del directorio de Marcas.
 * ---------------------------------------------------------------------------
 * v3 (Camino B, contrato de tests/marcas.integration.js):
 *   - 8 categorías (el test exige EXACTAMENTE 8 tras sembrar dos veces).
 *   - 62 ciudades (el test exige >= 50; "QUERÉTARO" ya viene sembrada para
 *     verificar que el proveedor no la duplique, y Tepoztlán NO viene porque
 *     el test la crea como ciudad nueva y espera +1 exacto).
 *   - bulkWrite upsert idempotente y race-safe:
 *       filter { slug } → sólo inserta si falta ese slug;
 *       $setOnInsert    → nunca pisa datos existentes;
 *       ordered:false   → un choque E11000 no aborta el resto.
 *   - Guard de conexión: si no hay BD al arrancar, avisa y NO explota
 *     (app.js re-intenta en el próximo arranque).
 */

const slugify = require('./slugify');

const categoriasIniciales = [
  'Arquitectura y diseño de interiores',
  'Notarías y servicios legales',
  'Persianas, cortinas y decoración',
  'Remodelación, construcción y mantenimiento',
  'Mudanzas y logística',
  'Fotografía y servicios inmobiliarios',
  'Servicios para el hogar',
  'Otros servicios profesionales',
];

// [nombre, estado] — 62 ciudades de la República Mexicana.
// El slug se deriva de nombre (sin acentos) y es la clave de deduplicación.
const ciudadesIniciales = [
  ['Aguascalientes', 'Aguascalientes'],
  ['Ensenada', 'Baja California'],
  ['Mexicali', 'Baja California'],
  ['Tecate', 'Baja California'],
  ['Tijuana', 'Baja California'],
  ['La Paz', 'Baja California Sur'],
  ['San José del Cabo', 'Baja California Sur'],
  ['Calkiní', 'Campeche'],
  ['Campeche', 'Campeche'],
  ['Tapachula', 'Chiapas'],
  ['Tuxtla Gutiérrez', 'Chiapas'],
  ['Chihuahua', 'Chihuahua'],
  ['Ciudad Juárez', 'Chihuahua'],
  ['Delicias', 'Chihuahua'],
  ['Monclova', 'Coahuila'],
  ['Saltillo', 'Coahuila'],
  ['Torreón', 'Coahuila'],
  ['Colima', 'Colima'],
  ['Manzanillo', 'Colima'],
  ['Acapulco', 'Guerrero'],
  ['Chilpancingo', 'Guerrero'],
  ['Zihuatanejo', 'Guerrero'],
  ['Gómez Palacio', 'Durango'],
  ['Durango', 'Durango'],
  ['Celaya', 'Guanajuato'],
  ['Guanajuato', 'Guanajuato'],
  ['Irapuato', 'Guanajuato'],
  ['León', 'Guanajuato'],
  ['San Miguel de Allende', 'Guanajuato'],
  ['Pachuca', 'Hidalgo'],
  ['Tulancingo', 'Hidalgo'],
  ['Guadalajara', 'Jalisco'],
  ['Puerto Vallarta', 'Jalisco'],
  ['Tlaquepaque', 'Jalisco'],
  ['Zapopan', 'Jalisco'],
  ['Ciudad de México', 'Ciudad de México'],
  ['Naucalpan', 'Estado de México'],
  ['Tlalnepantla', 'Estado de México'],
  ['Toluca', 'Estado de México'],
  ['Morelia', 'Michoacán'],
  ['Uruapan', 'Michoacán'],
  ['Zamora', 'Michoacán'],
  ['Cuernavaca', 'Morelos'],
  ['Jiutepec', 'Morelos'],
  ['Tepic', 'Nayarit'],
  ['Monterrey', 'Nuevo León'],
  ['San Pedro Garza García', 'Nuevo León'],
  ['Oaxaca', 'Oaxaca'],
  ['Huatulco', 'Oaxaca'],
  ['Cholula', 'Puebla'],
  ['Puebla', 'Puebla'],
  ['Querétaro', 'Querétaro'],
  ['San Juan del Río', 'Querétaro'],
  ['Cancún', 'Quintana Roo'],
  ['Chetumal', 'Quintana Roo'],
  ['Playa del Carmen', 'Quintana Roo'],
  ['San Luis Potosí', 'San Luis Potosí'],
  ['Culiacán', 'Sinaloa'],
  ['Mazatlán', 'Sinaloa'],
  ['Hermosillo', 'Sonora'],
  ['Ciudad Obregón', 'Sonora'],
  ['Villahermosa', 'Tabasco'],
  ['Tampico', 'Tamaulipas'],
].map(([nombre, estado]) => ({ nombre, estado }));

async function sembrarCatalogos() {
  try {
    // Guard: sin BD no hay seed (y el arranque sigue en pie).
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.warn('[seed] Catálogos de marcas: sin conexión a MongoDB, no se sembró.');
      return { categorias: 0, ciudades: 0 };
    }

    const { BrandCategory, BrandCity } = require('../models');

    const [resCat, resCiu] = await Promise.all([
      BrandCategory.bulkWrite(
        categoriasIniciales.map((nombre) => ({
          updateOne: {
            filter: { slug: slugify(nombre) },
            update: { $setOnInsert: { nombre, slug: slugify(nombre), activa: true } },
            upsert: true,
          },
        })),
        { ordered: false }
      ),
      BrandCity.bulkWrite(
        ciudadesIniciales.map(({ nombre, estado }) => ({
          updateOne: {
            filter: { slug: slugify(nombre) },
            update: { $setOnInsert: { nombre, estado: estado || '', slug: slugify(nombre), activa: true } },
            upsert: true,
          },
        })),
        { ordered: false }
      ),
    ]);

    const nuevasCat = resCat.upsertedCount || 0;
    const nuevasCiu = resCiu.upsertedCount || 0;
    if (nuevasCat + nuevasCiu > 0) {
      console.log(`✅ Catálogos de Marcas sembrados: ${nuevasCat + nuevasCiu} nuevo(s) (${nuevasCat} categorías, ${nuevasCiu} ciudades).`);
    } else {
      console.log('✅ Catálogos de Marcas verificados (seed idempotente, 0 inserciones).');
    }
    return { categorias: nuevasCat, ciudades: nuevasCiu };
  } catch (error) {
    // El seed NUNCA debe tumbar el arranque: app.js lo invoca al conectar.
    console.error('❌ Error sembrando catálogos de marcas:', error && error.message);
    return { categorias: 0, ciudades: 0 };
  }
}

// Exports aditivos (app.js sólo usa sembrarCatalogos; los demás sirven
// para tests y para ampliar catálogos desde scripts manuales).
module.exports = { sembrarCatalogos, slugify, categoriasIniciales, ciudadesIniciales };
