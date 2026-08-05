// ==========================================
// VALIDADOR DE IMÁGENES PARA PUBLISHERS
// ==========================================
// Verifica que una imagen cumpla con los requisitos de
// Facebook e Instagram antes de enviarla a la Graph API.
//
// Requisitos:
// - Facebook: JPG/PNG/GIF, máx 10 MB, mín 200x200
// - Instagram: JPG/PNG, máx 8 MB, mín 320x320, ratio 4:5 a 1.91:1
//
// Como Node no puede inspeccionar la imagen directamente desde una URL,
// validamos el formato por extensión/tipo y el tamaño por HEAD request.
// Para dimensiones reales se necesitaría un paquete como 'image-size'.

const VALID_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

const getExtension = (url) => {
  try {
    const path = new URL(url).pathname;
    const ext = path.split('.').pop().toLowerCase();
    return ext;
  } catch {
    return '';
  }
};

// Valida formato y accesibilidad de la URL (HEAD request)
const validarImagen = async (url, platform = 'facebook') => {
  const errores = [];

  if (!url) {
    errores.push('La URL de la imagen es obligatoria');
    return { valida: false, errores };
  }

  // 1. URL válida
  try {
    new URL(url);
  } catch {
    errores.push('URL de imagen inválida');
    return { valida: false, errores };
  }

  // 2. Formato por extensión
  const ext = getExtension(url);
  if (ext && !VALID_EXTENSIONS.includes(ext)) {
    errores.push(`Formato de imagen no soportado: .${ext}. Usa JPG, PNG${platform === 'facebook' ? ', GIF' : ''}.`);
  }

  // 3. Accesibilidad y tamaño (HEAD request)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      errores.push(`La imagen no es accesible públicamente (HTTP ${res.status}). Debe ser una URL pública sin autenticación.`);
    } else {
      const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
      const maxBytes = platform === 'instagram' ? 8 * 1024 * 1024 : 10 * 1024 * 1024;
      if (contentLength && contentLength > maxBytes) {
        errores.push(`La imagen excede el tamaño máximo de ${platform === 'instagram' ? '8' : '10'} MB (${(contentLength / 1024 / 1024).toFixed(1)} MB).`);
      }
      const contentType = res.headers.get('content-type') || '';
      if (contentType && !contentType.includes('image/')) {
        errores.push(`La URL no apunta a una imagen (Content-Type: ${contentType}).`);
      }
    }
  } catch (e) {
    errores.push(`No se pudo verificar la imagen: ${e.message}`);
  }

  return { valida: errores.length === 0, errores };
};

module.exports = { validarImagen, VALID_EXTENSIONS };
