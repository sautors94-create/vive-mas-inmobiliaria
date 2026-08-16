const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const path = require('path');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — 5MB se quedaba corto para fotos de celulares modernos
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'), false);
    }
  },
});

// Para documentos KYB (Constancia de Situación Fiscal, Acta Constitutiva,
// Comprobante de domicilio): PDF. Identificaciones (INE/Pasaporte): imagen.
// Este middleware acepta ambos; cada endpoint valida qué campos son PDF y
// cuáles imagen según lo que realmente reciba.
const uploadDocumentos = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes o archivos PDF'), false);
    }
  },
});

const subirACloudinary = (buffer, mimetype, folder = 'vive-mas/propiedades') => {
  const esPdf = mimetype === 'application/pdf';
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      esPdf
        ? { folder, resource_type: 'auto' }
        : { folder, resource_type: 'image', quality: 'auto', fetch_format: 'auto' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
};

module.exports = { cloudinary, upload, uploadDocumentos, subirACloudinary };