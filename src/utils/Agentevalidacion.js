// ==========================================
// AGENTE 1 — VALIDACIÓN (reglas, sin IA, instantáneo y gratis)
// ==========================================
// Revisa título, descripción, precio, dirección y características contra
// reglas deterministas. No decide aprobar/rechazar por sí solo: solo junta
// "issues" que se le pasan al Agente 2 (Moderación IA) como contexto, y que
// también puede usar el admin para entender por qué algo llegó a revisión.

const REGEX_TELEFONO = /(\+?\d[\d\s.\-()]{7,}\d)/;
const REGEX_EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const REGEX_URL = /(https?:\/\/|www\.|\.(com|mx|net|org|info)\b)/i;
const PALABRAS_CONTACTO = /(whatsapp|wasap|telegram|instagram|facebook|\bfb\b|tiktok|\bllámame\b|\bllamame\b|contáctame|contactame|escríbeme|escribeme|mándame\s+mensaje|mandame\s+mensaje|agenda\s+cita|visítanos|visitanos|\bcel(ular)?:?\s*\d|\btel(éfono|efono)?:?\s*\d)/i;
const PLACEHOLDERS_DIRECCION = /^(centro|méxico|mexico|sin dirección|sin direccion|n\/a|na|asdf+|x+|\d+)$/i;
// Emojis: se detectan los rangos emoji más comunes (incluye clave de emojis estándar).
const REGEX_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F0FF}]/gu;
// Lenguaje ofensivo / contenido inapropiado (palabras clave en español).
const REGEX_OFENSIVO = /(puta|pendej|mierda|chinga|estúpid|estupid|culo|ojete|hijo\s*de\s*su\s*p\w+|imb\w*cil|malparid|verga|pinche|joder|naco|maric|fuck|shit|bitch)/i;
// Rango razonable de estacionamientos por propiedad.
const ESTACIONAMIENTOS_MAX = 20;

const contarMayusculas = (texto) => {
  const letras = texto.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  if (!letras.length) return 0;
  const mayus = letras.replace(/[^A-ZÀ-Ý]/g, '').length;
  return mayus / letras.length;
};

const tieneTextoRepetido = (texto) => {
  const palabras = texto.toLowerCase().split(/\s+/).filter(Boolean);
  if (palabras.length < 8) return false;
  const frecuencia = {};
  palabras.forEach(p => { frecuencia[p] = (frecuencia[p] || 0) + 1; });
  const maxRepeticion = Math.max(...Object.values(frecuencia));
  return maxRepeticion > palabras.length * 0.35; // una palabra domina >35% del texto
};

const validarPropiedadBasico = ({ titulo, descripcion, precio, tipo, operacion, ubicacion, caracteristicas, duplicado }) => {
  const issues = [];

  // ---- TÍTULO ----
  if (titulo) {
    if ((titulo.match(/!/g) || []).length >= 3) issues.push({ severity: 'MEDIUM', category: 'TITLE', field: 'titulo', message: 'Exceso de signos de exclamación.' });
    if ((titulo.match(/\$/g) || []).length >= 3) issues.push({ severity: 'MEDIUM', category: 'TITLE', field: 'titulo', message: 'Exceso de símbolos de dinero, parece spam.' });
    if (contarMayusculas(titulo) > 0.6 && titulo.length > 8) issues.push({ severity: 'MEDIUM', category: 'TITLE', field: 'titulo', message: 'Exceso de mayúsculas.' });
    if (REGEX_TELEFONO.test(titulo)) issues.push({ severity: 'HIGH', category: 'TITLE', field: 'titulo', message: 'Parece contener un número de teléfono.' });
    if (REGEX_EMAIL.test(titulo)) issues.push({ severity: 'HIGH', category: 'TITLE', field: 'titulo', message: 'Parece contener un correo electrónico.' });
    if (REGEX_URL.test(titulo)) issues.push({ severity: 'HIGH', category: 'TITLE', field: 'titulo', message: 'Parece contener una URL.' });
    if (PALABRAS_CONTACTO.test(titulo)) issues.push({ severity: 'HIGH', category: 'TITLE', field: 'titulo', message: 'Contiene lenguaje que invita a contactar fuera de la plataforma.' });
    if (REGEX_OFENSIVO.test(titulo)) issues.push({ severity: 'HIGH', category: 'TITLE', field: 'titulo', message: 'Contiene lenguaje ofensivo o inapropiado.' });
    // Emojis excesivos: permitimos hasta 2, más de 3 se considera spam.
    if ((titulo.match(REGEX_EMOJI) || []).length > 3) issues.push({ severity: 'MEDIUM', category: 'TITLE', field: 'titulo', message: 'Exceso de emojis en el título.' });
  }

  // ---- DESCRIPCIÓN ----
  if (descripcion) {
    if (REGEX_TELEFONO.test(descripcion)) issues.push({ severity: 'HIGH', category: 'TEXT', field: 'descripcion', message: 'Parece contener un número de teléfono.' });
    if (REGEX_EMAIL.test(descripcion)) issues.push({ severity: 'HIGH', category: 'TEXT', field: 'descripcion', message: 'Parece contener un correo electrónico.' });
    if (REGEX_URL.test(descripcion)) issues.push({ severity: 'HIGH', category: 'TEXT', field: 'descripcion', message: 'Parece contener una URL o sitio web.' });
    if (PALABRAS_CONTACTO.test(descripcion)) issues.push({ severity: 'HIGH', category: 'TEXT', field: 'descripcion', message: 'Contiene lenguaje que invita a contactar fuera de la plataforma (WhatsApp, redes sociales, etc.).' });
    if (REGEX_OFENSIVO.test(descripcion)) issues.push({ severity: 'HIGH', category: 'TEXT', field: 'descripcion', message: 'Contiene lenguaje ofensivo o inapropiado.' });
    if (tieneTextoRepetido(descripcion)) issues.push({ severity: 'MEDIUM', category: 'TEXT', field: 'descripcion', message: 'Texto con repetición excesiva, parece spam.' });
    if (descripcion.trim().length < 20) issues.push({ severity: 'LOW', category: 'TEXT', field: 'descripcion', message: 'Descripción muy corta para evaluar con confianza.' });
  }

  // ---- PRECIO ----
  const precioNum = Number(precio);
  if (!Number.isFinite(precioNum) || precioNum <= 0) {
    issues.push({ severity: 'HIGH', category: 'PRICE', field: 'precio', message: 'El precio no es un número válido o positivo.' });
  } else {
    // Umbrales según operación: renta suele ser mucho más baja que venta.
    const esRenta = operacion === 'renta';
    const minRazonable = esRenta ? 500 : 100000;
    const maxRazonable = esRenta ? 500000 : 500000000;
    if (precioNum < minRazonable) {
      issues.push({ severity: 'HIGH', category: 'PRICE', field: 'precio', message: `Precio sospechosamente bajo para ${esRenta ? 'una renta' : 'una venta'}.` });
    } else if (precioNum > maxRazonable) {
      issues.push({ severity: 'MEDIUM', category: 'PRICE', field: 'precio', message: 'Precio inusualmente alto, verificar.' });
    }
  }

  // ---- DIRECCIÓN ----
  const ciudad = (ubicacion?.ciudad || '').trim();
  const estadoUb = (ubicacion?.estado || '').trim();
  const colonia = (ubicacion?.colonia || '').trim();
  const direccion = (ubicacion?.direccion || '').trim();
  if (!ciudad || !estadoUb) {
    issues.push({ severity: 'HIGH', category: 'ADDRESS', field: 'ubicacion', message: 'Falta ciudad o estado.' });
  } else if (PLACEHOLDERS_DIRECCION.test(ciudad) || PLACEHOLDERS_DIRECCION.test(estadoUb)) {
    issues.push({ severity: 'HIGH', category: 'ADDRESS', field: 'ubicacion', message: 'La ciudad o el estado parecen un valor de relleno, no una ubicación real.' });
  }
  if (colonia && PLACEHOLDERS_DIRECCION.test(colonia)) {
    issues.push({ severity: 'MEDIUM', category: 'ADDRESS', field: 'ubicacion.colonia', message: 'La colonia parece un valor de relleno, no una ubicación real.' });
  }
  if (direccion && PLACEHOLDERS_DIRECCION.test(direccion)) {
    issues.push({ severity: 'MEDIUM', category: 'ADDRESS', field: 'ubicacion.direccion', message: 'La dirección parece un valor de relleno, no una ubicación real.' });
  }

  // ---- CARACTERÍSTICAS ----
  if (caracteristicas && ['casa', 'departamento'].includes(tipo)) {
    const { recamaras, banos, m2, estacionamientos } = caracteristicas;
    if (!recamaras || recamaras <= 0) issues.push({ severity: 'MEDIUM', category: 'TEXT', field: 'caracteristicas.recamaras', message: `${tipo === 'casa' ? 'Casa' : 'Departamento'} con 0 recámaras, revisar.` });
    if (!banos || banos <= 0) issues.push({ severity: 'MEDIUM', category: 'TEXT', field: 'caracteristicas.banos', message: 'Sin baños registrados, revisar.' });
    if (recamaras > 20 || banos > 20) issues.push({ severity: 'MEDIUM', category: 'TEXT', field: 'caracteristicas', message: 'Número de recámaras/baños fuera de rango razonable.' });
    if (m2 && (m2 < 10 || m2 > 20000)) issues.push({ severity: 'MEDIUM', category: 'TEXT', field: 'caracteristicas.m2', message: 'Superficie fuera de un rango razonable.' });
    if (estacionamientos && (estacionamientos < 0 || estacionamientos > ESTACIONAMIENTOS_MAX)) {
      issues.push({ severity: 'MEDIUM', category: 'TEXT', field: 'caracteristicas.estacionamientos', message: 'Número de estacionamientos fuera de rango razonable.' });
    }
  }

  // ---- DUPLICADO ----
  if (duplicado) {
    issues.push({ severity: 'HIGH', category: 'DUPLICATE', field: 'duplicado', message: duplicado });
  }

  const bloqueaAutomatico = issues.some(i => i.severity === 'HIGH');
  return { issues, bloqueaAutomatico };
};

module.exports = { validarPropiedadBasico };