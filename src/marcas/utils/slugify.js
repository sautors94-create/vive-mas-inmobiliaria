'use strict';

/**
 * src/marcas/utils/slugify.js — Slugificador compartido del módulo Marcas.
 * ---------------------------------------------------------------------------
 * Conserva los arreglos de la v2 (Task 11):
 *   - Tolerante a null/undefined (String(text == null ? '' : text))
 *   - Colapsa guiones repetidos y recorta bordes ('Foto - video' → 'foto-video')
 *     para no violar el patrón ^[a-z0-9]+(?:-[a-z0-9]+)*$
 *   - Quita acentos por NFD: 'Querétaro' → 'queretaro', 'Tepoztlán' → 'tepoztlán'→...
 */

const slugify = (text) =>
  String(text == null ? '' : text)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

module.exports = slugify;
