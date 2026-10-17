'use strict';

/**
 * src/config/cloudinary.js — Configuración y helpers de Cloudinary.
 * ---------------------------------------------------------------------------
 * Contrato que consumen los controladores de Marcas y el test de integración:
 *   - `cloudinary`: instancia SDK (v2). El test sustituye
 *     cloud.cloudinary.uploader.destroy → el objeto debe ser mutable/exportado.
 *   - subirACloudinary(buffer, mimetype, folder) → secure_url
 *   - eliminarDeCloudinary(url|public_id) → destruye por public_id derivado
 *     de la URL (sin extensión y sin el segmento de versión /v123/), de modo
 *     que el test pueda afirmar `url.includes(publicId)`.
 *
 * Sin credenciales el módulo NO truena al importarse: los errores de subida se
 * reportan al controller y este responde 500 con mensaje genérico.
 */

let cloudinary;
try {
  const lib = require('cloudinary');
  cloudinary = lib.v2 || lib;
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config(true);
  } else if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
} catch (error) {
  // SDK no instalado: stubs que fallan tarde, al usarse, no al importarse.
  const noDisponible = async () => {
    throw new Error('Cloudinary no está instalado en el servidor');
  };
  cloudinary = { uploader: { upload: noDisponible, destroy: noDisponible } };
}

const FORMATOS_PERMITIDOS = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * https://res.cloudinary.com/demo/image/upload/v1712345/vive-mas/marcas/abc/img0.png
 *   → 'vive-mas/marcas/abc/img0'   (subcadena de la URL original)
 */
const publicIdDesdeUrl = (url) => {
  const partes = String(url || '').split('/upload/');
  if (partes.length < 2) return null;
  const ruta = partes[1].split('?')[0];
  const segmentos = ruta.split('/').filter(Boolean);
  if (segmentos.length && /^v\d+$/.test(segmentos[0])) segmentos.shift();
  const archivo = segmentos.pop();
  if (!archivo) return null;
  segmentos.push(archivo.replace(/\.[a-z0-9]+$/i, ''));
  return segmentos.join('/');
};

const subirACloudinary = async (buffer, mimetype, folder) => {
  const b64 = Buffer.from(buffer).toString('base64');
  const dataURI = `data:${mimetype || 'application/octet-stream'};base64,${b64}`;
  const resultado = await cloudinary.uploader.upload(dataURI, {
    folder: folder || 'vive-mas/marcas',
    resource_type: 'image',
  });
  return resultado.secure_url;
};

const eliminarDeCloudinary = async (urlOId) => {
  const publicId = String(urlOId || '').includes('/upload/')
    ? publicIdDesdeUrl(urlOId)
    : urlOId;
  if (!publicId) return null;
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.warn('[cloudinary] No se pudo eliminar', publicId, error && error.message);
    return null;
  }
};

module.exports = {
  cloudinary,
  subirACloudinary,
  eliminarDeCloudinary,
  publicIdDesdeUrl,
  FORMATOS_PERMITIDOS,
};
