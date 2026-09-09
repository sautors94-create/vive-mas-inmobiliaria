const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const axios = require('axios');
const path = require('path');

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
    console.error('No se pudieron registrar las fuentes Poppins:', e.message);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

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
  ctx.beginPath();
  ctx.arc(x + s * 0.75, y + s * 0.15, s * 0.7, Math.PI, Math.PI * 2);
  ctx.lineTo(x + s * 1.45, y + s * 0.55);
  ctx.lineTo(x + s * 0.05, y + s * 0.55);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + s * 0.75, y - s * 0.65);
  ctx.lineTo(x + s * 0.75, y - s * 0.35);
  ctx.stroke();
  ctx.restore();
}

function drawPinIcon(ctx, x, y, s, color, bgColor) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.5, Math.PI * 0.15, Math.PI * 0.85, true);
  ctx.lineTo(x, y + s * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = bgColor || '#0f172a';
  ctx.beginPath();
  ctx.arc(x, y, s * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

async function generatePropertyCard(propertyData, imageBufferOrNull = null, theme = {}) {
  ensureFonts();

  const width = 1080;
  const height = 1350;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const F = (weight) => `Poppins ${weight}`.trim();

  // COLORES DINÁMICOS
  const BRAND = {
    navy: theme.bgDark || '#0f172a',
    navyLight: '#1e293b',
    gold: theme.accent || '#fbbf24',
    primary: theme.primary || '#1a472a',
    white: '#ffffff',
    greyLight: '#94a3b8'
  };

  // 1. Fondo Degradado
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, BRAND.navy);
  bgGrad.addColorStop(1, BRAND.primary); 
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Header
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `bold 36px ${F('Bold')}`;
  ctx.fillStyle = BRAND.white;
  ctx.fillText('Somos', 50, 70);
  const wSomos = ctx.measureText('Somos').width;
  ctx.fillStyle = BRAND.gold;
  ctx.fillText('ViveMás', 50 + wSomos + 10, 70);

  // 3. Contenedor de la Foto
  const photoX = 40;
  const photoY = 120;
  const photoW = width - 80;
  const photoH = 700;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 15;
  ctx.fillStyle = BRAND.navyLight;
  roundRect(ctx, photoX, photoY, photoW, photoH, 24);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, photoX, photoY, photoW, photoH, 24);
  ctx.clip();
  try {
    let image;
    if (imageBufferOrNull) {
      image = await loadImage(imageBufferOrNull);
    } else if (propertyData.imageUrl) {
      const response = await axios.get(propertyData.imageUrl, { responseType: 'arraybuffer', timeout: 8000 });
      image = await loadImage(Buffer.from(response.data, 'binary'));
    } else {
      throw new Error('sin imagen');
    }
    const scale = Math.max(photoW / image.width, photoH / image.height);
    const drawW = image.width * scale, drawH = image.height * scale;
    const dx = photoX + (photoW - drawW) / 2, dy = photoY + (photoH - drawH) / 2;
    ctx.drawImage(image, dx, dy, drawW, drawH);
  } catch (error) {
    ctx.fillStyle = BRAND.navyLight;
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.font = `600 24px ${F('SemiBold')}`;
    ctx.fillStyle = BRAND.greyLight;
    ctx.textAlign = 'center';
    ctx.fillText('Foto no disponible', width / 2, photoY + photoH / 2);
    ctx.textAlign = 'left';
  }
  ctx.restore();

  // 4. Degradado inferior de la foto
  const fadeGrad = ctx.createLinearGradient(0, photoY + photoH - 300, 0, photoY + photoH);
  fadeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  fadeGrad.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
  ctx.fillStyle = fadeGrad;
  ctx.save();
  roundRect(ctx, photoX, photoY, photoW, photoH, 24);
  ctx.clip();
  ctx.fillRect(photoX, photoY + photoH - 300, photoW, 300);
  ctx.restore();

  // 5. Etiqueta Operación
  const badgeText = (propertyData.type === 'venta' ? 'EN VENTA' : 'EN RENTA');
  ctx.font = `bold 18px ${F('Bold')}`;
  const badgeW = ctx.measureText(badgeText).width + 36;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  roundRect(ctx, 60, photoY + 20, badgeW, 40, 20);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = BRAND.white;
  ctx.fillText(badgeText, 78, photoY + 20 + 20);

  // 6. Datos Inferiores
  let cursorY = photoY + photoH - 80;

  // Precio
  ctx.font = `800 64px ${F('ExtraBold')}`;
  ctx.fillStyle = BRAND.gold;
  const precioTexto = `$${Number(propertyData.price || 0).toLocaleString('es-MX')}`;
  ctx.fillText(precioTexto, 50, cursorY);
  const precioW = ctx.measureText(precioTexto).width;
  
  ctx.font = `600 22px ${F('SemiBold')}`;
  ctx.fillStyle = BRAND.greyLight;
  ctx.fillText(propertyData.type === 'venta' ? 'MXN' : 'MXN / mes', 50 + precioW + 12, cursorY);

  // Detalles (Recámaras / Baños)
  const tieneRecamaras = propertyData.rooms !== null && propertyData.rooms !== undefined;
  if (tieneRecamaras) {
    cursorY += 70;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    roundRect(ctx, 40, cursorY - 30, width - 80, 80, 16);
    ctx.fill();
    ctx.stroke();

    drawBedIcon(ctx, 70, cursorY - 5, 26, BRAND.gold);
    ctx.font = `600 26px ${F('SemiBold')}`;
    ctx.fillStyle = BRAND.white;
    ctx.fillText(`${propertyData.rooms || 0} Recámaras`, 120, cursorY);

    drawBathIcon(ctx, 480, cursorY - 5, 26, BRAND.gold);
    ctx.fillText(`${propertyData.baths || 0} Baños`, 530, cursorY);
  }

  // Ubicación (Texto blanco brillante para que se vea claro)
  cursorY += 110;
  drawPinIcon(ctx, 60, cursorY - 10, 22, BRAND.gold, BRAND.navy);
  ctx.font = `600 28px ${F('SemiBold')}`;
  ctx.fillStyle = BRAND.white;
  const ubicacionTexto = truncateToWidth(ctx, propertyData.location || 'Ubicación no especificada', width - 180);
  ctx.fillText(ubicacionTexto, 95, cursorY);

  // 7. Pie (Sin botón de WhatsApp, solo el dominio centrado)
  ctx.font = `bold 26px ${F('Bold')}`;
  ctx.fillStyle = BRAND.gold;
  ctx.textAlign = 'center';
  ctx.fillText('somosvivemas.com', width / 2, height - 60);
  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}

module.exports = { generatePropertyCard };