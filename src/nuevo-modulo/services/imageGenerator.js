// @napi-rs/canvas en vez de "canvas": trae binarios precompilados y no
// necesita compilar nada nativo (importante en hosting compartido como
// Hostinger, donde no hay acceso root para instalar libcairo/libpango).
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const axios = require('axios');
const path = require('path');

// Registramos Poppins (misma familia tipográfica que el logo/branding de
// SomosViveMás) para que la ficha se vea igual en cualquier servidor. Sin
// esto, @napi-rs/canvas usa la fuente por default del sistema operativo
// (en Linux normalmente NO tiene "Arial" instalada, así que el texto podía
// salir con una tipografía genérica fea o incluso no renderizar bien).
const FONTS_DIR = path.join(__dirname, '../../../assets/fonts');
let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  try {
    GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Poppins-Regular.ttf'), 'Poppins');
    GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Poppins-SemiBold.ttf'), 'Poppins SemiBold');
    GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Poppins-Bold.ttf'), 'Poppins Bold');
    GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Poppins-ExtraBold.ttf'), 'Poppins ExtraBold');
    fontsRegistered = true;
  } catch (e) {
    console.error('No se pudieron registrar las fuentes Poppins, se usará la fuente por default:', e.message);
  }
}

// Paleta de marca SomosViveMás (navy + dorado, tomada del logo real)
const BRAND = {
  navy: '#12202E',
  navyLight: '#1B3145',
  gold: '#C9982E',
  goldLight: '#E4C15C',
  white: '#FFFFFF',
  greyText: '#9CA9B4',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Trunca con "…" si el texto no cabe en maxWidth con la fuente ya activa
// en ctx (evita que ubicaciones largas se salgan del canvas).
function truncateToWidth(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let low = 0, high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = text.slice(0, mid) + '…';
    if (ctx.measureText(candidate).width <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return text.slice(0, low) + '…';
}

// Ícono de casa simple (mismo trazo que el logo) — dibujado a mano en vez
// de depender de un archivo de imagen externo, para que nunca falle.
function drawHouseIcon(ctx, cx, cy, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.09;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.55, cy - size * 0.05);
  ctx.lineTo(cx, cy - size * 0.55);
  ctx.lineTo(cx + size * 0.55, cy - size * 0.05);
  ctx.stroke();
  ctx.strokeRect(cx - size * 0.32, cy - size * 0.05, size * 0.64, size * 0.55);
  ctx.restore();
}

// Iconos vectoriales simples (nunca dependen de que el servidor tenga
// fuentes con emoji instaladas — en el servidor de Hostinger los emoji
// como 🛏/🚿/📍 se veían como cuadros vacíos por esto mismo).
function drawBedIcon(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeRect(x, y + s * 0.35, s * 1.7, s * 0.55);
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.lineTo(x, y - s * 0.05);
  ctx.lineTo(x + s * 0.55, y - s * 0.05);
  ctx.lineTo(x + s * 0.55, y + s * 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + s * 0.25, y + s * 0.08, s * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBathIcon(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.12;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Tina: arco completo (la "bañera") + base
  ctx.beginPath();
  ctx.arc(x + s * 0.75, y + s * 0.15, s * 0.7, Math.PI, Math.PI * 2);
  ctx.lineTo(x + s * 1.45, y + s * 0.55);
  ctx.lineTo(x + s * 0.05, y + s * 0.55);
  ctx.closePath();
  ctx.stroke();
  // Chorro de agua
  ctx.beginPath();
  ctx.moveTo(x + s * 0.75, y - s * 0.65);
  ctx.lineTo(x + s * 0.75, y - s * 0.35);
  ctx.stroke();
  ctx.restore();
}

function drawPinIcon(ctx, x, y, s, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.5, Math.PI * 0.15, Math.PI * 0.85, true);
  ctx.lineTo(x, y + s * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = BRAND.navy;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

async function generatePropertyCard(propertyData, imageBufferOrNull = null) {
  ensureFonts();

  const width = 1000;
  const height = 1250;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const F = (weight) => `Poppins ${weight}`.trim();

  // Fondo general
  ctx.fillStyle = BRAND.navy;
  ctx.fillRect(0, 0, width, height);

  // ── Encabezado con logo ──
  const headerH = 130;
  ctx.fillStyle = BRAND.navy;
  ctx.fillRect(0, 0, width, headerH);
  drawHouseIcon(ctx, 60, headerH / 2, 46, BRAND.gold);

  ctx.textBaseline = 'middle';
  ctx.font = `bold 34px ${F('Bold')}`;
  ctx.fillStyle = BRAND.white;
  ctx.fillText('Somos', 100, headerH / 2 - 2);
  const wSomos = ctx.measureText('Somos').width;
  ctx.fillStyle = BRAND.gold;
  ctx.fillText('ViveMás', 100 + wSomos + 4, headerH / 2 - 2);
  ctx.font = `18px ${F('Regular')}`;
  ctx.fillStyle = BRAND.greyText;
  ctx.fillText('INMOBILIARIA', 100, headerH / 2 + 26);

  // Franja dorada bajo el encabezado
  ctx.fillStyle = BRAND.gold;
  ctx.fillRect(0, headerH, width, 4);

  // ── Foto de la propiedad ──
  const photoY = headerH + 4;
  const photoH = 620;
  ctx.save();
  roundRect(ctx, 30, photoY + 26, width - 60, photoH, 20);
  ctx.clip();
  try {
    let image;
    if (imageBufferOrNull) {
      image = await loadImage(imageBufferOrNull); // Subida desde celular/PC
    } else if (propertyData.imageUrl) {
      const response = await axios.get(propertyData.imageUrl, { responseType: 'arraybuffer', timeout: 8000 });
      image = await loadImage(Buffer.from(response.data, 'binary'));
    } else {
      throw new Error('sin imagen');
    }
    // "cover": recorta la imagen para llenar el rectángulo sin deformarla
    const targetW = width - 60, targetH = photoH;
    const scale = Math.max(targetW / image.width, targetH / image.height);
    const drawW = image.width * scale, drawH = image.height * scale;
    const dx = 30 + (targetW - drawW) / 2, dy = (photoY + 26) + (targetH - drawH) / 2;
    ctx.drawImage(image, dx, dy, drawW, drawH);
  } catch (error) {
    // Placeholder de marca en vez de un gris genérico
    ctx.fillStyle = BRAND.navyLight;
    ctx.fillRect(30, photoY + 26, width - 60, photoH);
    drawHouseIcon(ctx, width / 2, photoY + 26 + photoH / 2 - 20, 110, BRAND.gold);
    ctx.font = `600 26px ${F('SemiBold')}`;
    ctx.fillStyle = BRAND.greyText;
    ctx.textAlign = 'center';
    ctx.fillText('Foto no disponible', width / 2, photoY + 26 + photoH / 2 + 70);
    ctx.textAlign = 'left';
  }
  ctx.restore();

  // Sutil degradado oscuro abajo de la foto para que el precio resalte si se sobrepone
  const grad = ctx.createLinearGradient(0, photoY + 26 + photoH - 140, 0, photoY + 26 + photoH);
  grad.addColorStop(0, 'rgba(18,32,46,0)');
  grad.addColorStop(1, 'rgba(18,32,46,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(30, photoY + 26 + photoH - 140, width - 60, 140);

  // ── Etiqueta de operación (Renta/Venta) ──
  const badgeText = (propertyData.type === 'venta' ? 'EN VENTA' : 'EN RENTA');
  ctx.font = `bold 22px ${F('Bold')}`;
  const badgeW = ctx.measureText(badgeText).width + 40;
  ctx.fillStyle = BRAND.gold;
  roundRect(ctx, 50, photoY + 46, badgeW, 44, 22);
  ctx.fill();
  ctx.fillStyle = BRAND.navy;
  ctx.textAlign = 'left';
  ctx.fillText(badgeText, 70, photoY + 46 + 22);

  // ── Bloque de datos ── (usamos un "cursor" vertical para no encimar líneas)
  let cursorY = photoY + 26 + photoH + 75;

  ctx.font = `800 62px ${F('ExtraBold')}`;
  ctx.fillStyle = BRAND.gold;
  const precioTexto = `$${Number(propertyData.price || 0).toLocaleString('es-MX')}`;
  ctx.fillText(precioTexto, 50, cursorY);
  const precioW = ctx.measureText(precioTexto).width;
  ctx.font = `600 24px ${F('SemiBold')}`;
  ctx.fillStyle = BRAND.greyText;
  ctx.fillText(propertyData.type === 'venta' ? 'MXN' : 'MXN / mes', 50 + precioW + 14, cursorY);

  // Recámaras / Baños (íconos vectoriales, no emoji)
  cursorY += 85;
  drawBedIcon(ctx, 52, cursorY - 15, 24, BRAND.gold);
  ctx.font = `600 30px ${F('SemiBold')}`;
  ctx.fillStyle = BRAND.white;
  ctx.fillText(`${propertyData.rooms || 0} Recámaras`, 105, cursorY);

  drawBathIcon(ctx, 445, cursorY - 15, 24, BRAND.gold);
  ctx.fillText(`${propertyData.baths || 0} Baños`, 498, cursorY);

  // Ubicación
  cursorY += 65;
  drawPinIcon(ctx, 60, cursorY - 10, 20, BRAND.gold);
  ctx.font = `500 28px ${F('Regular')}`;
  ctx.fillStyle = BRAND.greyText;
  const ubicacionTexto = truncateToWidth(ctx, propertyData.location || '', width - 90 - 50);
  ctx.fillText(ubicacionTexto, 90, cursorY);

  // Línea separadora
  cursorY += 55;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(50, cursorY);
  ctx.lineTo(width - 50, cursorY);
  ctx.stroke();

  // ── Pie: dominio + CTA ──
  cursorY += 55;
  ctx.font = `bold 26px ${F('Bold')}`;
  ctx.fillStyle = BRAND.white;
  ctx.fillText('somosvivemas.com', 50, cursorY);
  cursorY += 38;
  ctx.font = `500 20px ${F('Regular')}`;
  ctx.fillStyle = BRAND.gold;
  ctx.fillText('Contáctame por WhatsApp →', 50, cursorY);

  return canvas.toBuffer('image/png');
}

module.exports = { generatePropertyCard };
