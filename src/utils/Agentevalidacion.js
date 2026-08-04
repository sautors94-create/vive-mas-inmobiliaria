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

const validarPropiedadBasico = ({ titulo, descripcion, precio, tipo, ubicacion, caracteristicas }) => {
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
  }

  // ---- DESCRIPCIÓN ----
  if (descripcion) {
    if (REGEX_TELEFONO.test(descripcion)) issues.push({ severity: 'HIGH', category: 'TEXT', field: 'descripcion', message: 'Parece contener un número de teléfono.' });
    if (REGEX_EMAIL.test(descripcion)) issues.push({ severity: 'HIGH', category: 'TEXT', field: 'descripcion', message: 'Parece contener un correo electrónico.' });
    if (REGEX_URL.test(descripcion)) issues.push({ severity: 'HIGH', category: 'TEXT', field: 'descripcion', message: 'Parece contener una URL o sitio web.' });
    if (PALABRAS_CONTACTO.test(descripcion)) issues.push({ severity: 'HIGH', category: 'TEXT', field: 'descripcion', message: 'Contiene lenguaje que invita a contactar fuera de la plataforma (WhatsApp, redes sociales, etc.).' });
    if (tieneTextoRepetido(descripcion)) issues.push({ severity: 'MEDIUM', category: 'TEXT', field: 'descripcion', message: 'Texto con repetición excesiva, parece spam.' });
    if (descripcion.trim().length < 20) issues.push({ severity: 'LOW', category: 'TEXT', field: 'descripcion', message: 'Descripción muy corta para evaluar con confianza.' });
  }

  // ---- PRECIO ----
  const precioNum = Number(precio);
  if (!Number.isFinite(precioNum) || precioNum <= 0) {
    issues.push({ severity: 'HIGH', category: 'PRICE', field: 'precio', message: 'El precio no es un número válido o positivo.' });
  } else if (precioNum < 1000) {
    issues.push({ severity: 'HIGH', category: 'PRICE', field: 'precio', message: 'Precio sospechosamente bajo.' });
  } else if (precioNum > 500000000) {
    issues.push({ severity: 'MEDIUM', category: 'PRICE', field: 'precio', message: 'Precio inusualmente alto, verificar.' });
  }

  // ---- DIRECCIÓN ----
  const ciudad = (ubicacion?.ciudad || '').trim();
  const estadoUb = (ubicacion?.estado || '').trim();
  if (!ciudad || !estadoUb) {
    issues.push({ severity: 'HIGH', category: 'ADDRESS', field: 'ubicacion', message: 'Falta ciudad o estado.' });
  } else if (PLACEHOLDERS_DIRECCION.test(ciudad) || PLACEHOLDERS_DIRECCION.test(estadoUb)) {
    issues.push({ severity: 'HIGH', category: 'ADDRESS', field: 'ubicacion', message: 'La ciudad o el estado parecen un valor de relleno, no una ubicación real.' });
  }

  // ---- CARACTERÍSTICAS ----
  if (caracteristicas && ['casa', 'departamento'].includes(tipo)) {
    const { recamaras, banos, m2 } = caracteristicas;
    if (!recamaras || recamaras <= 0) issues.push({ severity: 'MEDIUM', category: 'TEXT', field: 'caracteristicas.recamaras', message: `${tipo === 'casa' ? 'Casa' : 'Departamento'} con 0 recámaras, revisar.` });
    if (!banos || banos <= 0) issues.push({ severity: 'MEDIUM', category: 'TEXT', field: 'caracteristicas.banos', message: 'Sin baños registrados, revisar.' });
    if (recamaras > 20 || banos > 20) issues.push({ severity: 'MEDIUM', category: 'TEXT', field: 'caracteristicas', message: 'Número de recámaras/baños fuera de rango razonable.' });
    if (m2 && (m2 < 10 || m2 > 20000)) issues.push({ severity: 'MEDIUM', category: 'TEXT', field: 'caracteristicas.m2', message: 'Superficie fuera de un rango razonable.' });
  }

  const bloqueaAutomatico = issues.some(i => i.severity === 'HIGH');
  return { issues, bloqueaAutomatico };
};

module.exports = { validarPropiedadBasico };