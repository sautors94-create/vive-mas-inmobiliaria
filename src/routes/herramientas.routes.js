'use strict';

/**
 * src/routes/herramientas.routes.js — Herramientas públicas del sitio (v1)
 * ---------------------------------------------------------------------------
 * Cura el 404: "GET /api/herramientas/ciudades-disponibles 404 (Not Found)"
 * que lanzaba pages/calculadora-renta.html:134 — la página llama este endpoint
 * pero el backend nunca lo registró.
 *
 * RUTA:
 *   GET /api/herramientas/ciudades-disponibles
 *
 * RESPUESTA (defensiva: la página recibirá el dato en la forma que lo espere):
 *   {
 *     ok: true,
 *     fuente: 'propiedades' | 'catalogo' | 'vacia',
 *     total: 12,
 *     ciudades: ["Querétaro", "CDMX"],            // strings (forma estándar)
 *     nombres:  ["Querétaro", "CDMX"],            // alias
 *     slugs:    ["queretaro", "cdmx"],
 *     detalle:  [{ nombre: "Querétaro", slug: "queretaro", total: 4 }]
 *   }
 *
 * DISEÑO TOLERANTE (anti-mezcla de versiones):
 *  - El modelo Property vive en el repo grande; aquí NO se requiere por nombre
 *    fijo: se toma de mongoose.models.Property si existe (y en el banco de
 *    pruebas se puede registrar uno mínimo).
 *  - Se prueban varias rutas de campo (ciudad, ubicacion.ciudad,
 *    direccion.ciudad, estado) porque el modelo puede variar entre versiones.
 *  - Si no hay propiedades aprobadas, se cae al catálogo BrandCity activo del
 *    módulo Marcas; y si tampoco existe, respuesta vacía pero 200 (NUNCA 500).
 */

const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

/** 'Querétaro' → 'queretaro' (slug simple, sin dependencias). */
const slugBonito = (texto) => String(texto || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

/** Ciudades distintas desde Property con el campo indicado (o [] si no hay).
 *  Usa aggregate para traer el TOTAL real de propiedades por ciudad; si el
 *  modelo no soporta aggregate (stub), cae a distinct con total 1 por ciudad. */
const distintosDesdePropiedades = async (campo, filtro) => {
  const Property = mongoose.models.Property;
  if (!Property || !campo) return [];
  try {
    if (typeof Property.aggregate === 'function') {
      const filas = await Property.aggregate([
        { $match: { ...filtro, [campo]: { $nin: [null, ''] } } },
        { $group: { _id: `$${campo}`, total: { $sum: 1 } } },
      ]);
      return (filas || [])
        .filter((f) => f && typeof f._id === 'string' && f._id.trim())
        .map((f) => ({ nombre: f._id.trim(), total: f.total || 1 }));
    }
    if (typeof Property.distinct === 'function') {
      const valores = await Property.distinct(campo, filtro);
      return (valores || [])
        .filter((v) => typeof v === 'string' && v.trim())
        .map((v) => ({ nombre: v.trim(), total: 1 }));
    }
    return [];
  } catch {
    return []; // campo inexistente / modelo stub / sin conexión: intento siguiente
  }
};

/** Catálogo de ciudades del módulo Marcas (BrandCity activas). */
const ciudadesDesdeCatalogo = async () => {
  const BrandCity = mongoose.models.BrandCity;
  if (!BrandCity) return [];
  try {
    // Tolerante a ambas convenciones del catálogo (activa/activo)
    const filas = await BrandCity.find({ $or: [{ activa: true }, { activo: true }] })
      .select('nombre slug')
      .lean();
    return (filas || [])
      .filter((c) => c && c.nombre)
      .map((c) => ({ nombre: String(c.nombre).trim(), slug: c.slug || slugBonito(c.nombre) }))
      .filter((c) => c.nombre);
  } catch {
    return [];
  }
};

router.get('/ciudades-disponibles', async (req, res) => {
  try {
    // Mapa clave normalizada → { nombre, slug, total } (dedupe insensible)
    const acumulado = new Map();
    const sumar = (nombre, incremento = 1) => {
      const limpio = String(nombre || '').trim();
      if (!limpio || limpio.length > 80) return;
      const clave = slugBonito(limpio);
      if (!clave) return;
      const previo = acumulado.get(clave);
      if (previo) previo.total += incremento;
      else acumulado.set(clave, { nombre: limpio, slug: clave, total: incremento });
    };

    let fuente = 'vacia';

    // 1) Propiedades aprobadas (filtro canónico del sitio: status='aprobada')
    const filtroAprobadas = { status: 'aprobada' };
    for (const campo of ['ciudad', 'ubicacion.ciudad', 'direccion.ciudad', 'municipio']) {
      const lista = await distintosDesdePropiedades(campo, filtroAprobadas);
      if (lista.length > 0) {
        lista.forEach((f) => sumar(f.nombre, f.total));
        fuente = 'propiedades';
        break;
      }
    }

    // 2) Intento sin filtro de estado si el filtro canónico no arrojó nada
    if (acumulado.size === 0) {
      for (const campo of ['ciudad', 'ubicacion.ciudad', 'direccion.ciudad', 'municipio']) {
        const lista = await distintosDesdePropiedades(campo, {});
        if (lista.length > 0) {
          lista.forEach((f) => sumar(f.nombre, f.total));
          fuente = 'propiedades';
          break;
        }
      }
    }

    // 3) Catálogo del directorio de marcas
    if (acumulado.size === 0) {
      const catalogo = await ciudadesDesdeCatalogo();
      if (catalogo.length > 0) {
        catalogo.forEach((c) => sumar(c.nombre));
        fuente = 'catalogo';
      }
    }

    const detalle = [...acumulado.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const nombres = detalle.map((d) => d.nombre);

    return res.json({
      ok: true,
      fuente,
      total: detalle.length,
      ciudades: nombres,
      nombres,
      slugs: detalle.map((d) => d.slug),
      detalle,
    });
  } catch (error) {
    // La herramienta NUNCA debe tumbar la página: 200 con lista vacía + aviso.
    console.error('[herramientas][ciudadesDisponibles]', error && error.message);
    return res.json({
      ok: true,
      fuente: 'vacia',
      total: 0,
      ciudades: [],
      nombres: [],
      slugs: [],
      detalle: [],
      advertencia: 'No se pudieron leer las ciudades en este momento.',
    });
  }
});

module.exports = router;
