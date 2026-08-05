// ==========================================
// GENERADOR DE CONTENIDO PARA PUBLICACIONES
// ==========================================
// Genera automáticamente el texto de las publicaciones en redes sociales
// usando la información del inmueble. No usa textos fijos.
//
// Reglas:
// - Texto atractivo, profesional y optimizado para redes sociales.
// - Hashtags automáticos (#SomosViveMas, #CasaEnVenta, #CasaEnRenta, etc.)
// - Se genera según el tipo de operación (renta/venta).
//
// Preparado para IA: esta interfaz puede ser reemplazada por un generador
// basado en IA sin modificar el resto del módulo.

const OPERACION_LABEL = {
  renta: 'Renta',
  venta: 'Venta',
};

const TIPO_LABEL = {
  casa: 'Casa',
  departamento: 'Departamento',
  terreno: 'Terreno',
  local: 'Local',
};

const formatPrecio = (precio) => {
  if (!precio && precio !== 0) return '';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(precio);
};

// Genera hashtags automáticos según el tipo de operación y ubicación
const generarHashtags = (data) => {
  const tags = ['SomosViveMas'];

  if (data.tipoOperacion === 'renta') {
    tags.push('CasaEnRenta', 'DepartamentoEnRenta', 'RentaDeInmuebles');
  } else if (data.tipoOperacion === 'venta') {
    tags.push('CasaEnVenta', 'DepartamentoEnVenta', 'VentaDeInmuebles');
  }

  tags.push('Inmuebles', 'BienesRaices');

  // Añadir ciudad/estado normalizado (sin acentos para hashtag válido)
  const ciudad = (data.ciudad || data.municipio || '').trim();
  if (ciudad) {
    const norm = ciudad
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .replace(/\s+/g, '');
    if (norm) tags.push(norm.charAt(0).toUpperCase() + norm.slice(1));
  }

  // Hashtags únicos preservando orden
  return [...new Set(tags)];
};

// Construye el texto de la publicación completo
const generarPublicacion = (data) => {
  if (!data || !data.titulo) {
    throw new Error('Datos de inmueble incompletos para generar contenido');
  }

  const operacion = OPERACION_LABEL[data.tipoOperacion] || data.tipoOperacion || '';
  const tipo = TIPO_LABEL[data.tipoInmueble] || data.tipoInmueble || 'Inmueble';
  const precio = formatPrecio(data.precio);
  const partes = [];

  // Título
  let titulo = `🏠 ${data.titulo}`;
  if (operacion) titulo += ` en ${operacion}`;
  partes.push(titulo);

  // Ubicación
  const ubicacion = [data.colonia, data.ciudad || data.municipio, data.estado]
    .filter(Boolean)
    .join(', ');
  if (ubicacion) partes.push(`📍 ${ubicacion}`);

  // Características principales
  const caract = [];
  if (data.recamaras) caract.push(`${data.recamaras} recámara${data.recamaras > 1 ? 's' : ''}`);
  if (data.banos) caract.push(`${data.banos} baño${data.banos > 1 ? 's' : ''}`);
  if (data.estacionamientos) caract.push(`${data.estacionamientos} estacionamiento${data.estacionamientos > 1 ? 's' : ''}`);
  if (data.superficieConstruccion) caract.push(`${data.superficieConstruccion} m² construcción`);
  if (data.superficieTerreno) caract.push(`${data.superficieTerreno} m² terreno`);
  if (caract.length) partes.push(`• ${caract.join(' • ')}`);

  // Precio
  if (precio) {
    if (data.tipoOperacion === 'renta') partes.push(`💵 ${precio} mensuales`);
    else partes.push(`💵 ${precio}`);
  }

  // Descripción corta (primeras 2 frases o 200 caracteres)
  if (data.descripcion) {
    const desc = data.descripcion.replace(/\s+/g, ' ').trim();
    const corta = desc.length > 200 ? desc.slice(0, 200).trim() + '…' : desc;
    partes.push(corta);
  }

  // Amenidades
  if (Array.isArray(data.amenities) && data.amenities.length) {
    partes.push(`✨ Amenidades: ${data.amenities.slice(0, 5).join(', ')}`);
  }

  // Asesor / Inmobiliaria
  const asesor = data.nombreAsesor || data.nombreInmobiliaria;
  if (asesor) partes.push(`👤 ${asesor}`);

  // Contacto
  const contacto = [];
  if (data.whatsapp) contacto.push(`WhatsApp: ${data.whatsapp}`);
  if (data.telefono) contacto.push(`Tel: ${data.telefono}`);
  if (contacto.length) partes.push(`📞 ${contacto.join(' · ')}`);

  // Enlace
  if (data.urlPublica) partes.push(`🔗 ${data.urlPublica}`);

  // Hashtags
  const hashtags = generarHashtags(data);
  if (hashtags.length) partes.push(hashtags.map(h => `#${h}`).join(' '));

  return partes.join('\n\n');
};

// Interfaz común (contrato) para futuros generadores IA
class ContentGenerator {
  generate(data) {
    // Implementación básica por defecto
    return generarPublicacion(data);
  }
}

module.exports = {
  generarPublicacion,
  generarHashtags,
  formatPrecio,
  ContentGenerator,
};
