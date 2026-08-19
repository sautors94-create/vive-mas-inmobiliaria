// @napi-rs/canvas en vez de "canvas": trae binarios precompilados y no
// necesita compilar nada nativo (importante en hosting compartido como
// Hostinger, donde no hay acceso root para instalar libcairo/libpango).
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const axios = require('axios');
const path = require('path');

async function generatePropertyCard(propertyData, filePath = null) {
  const width = 800;
  const height = 800;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  try {
    let image;
    
    // LÓGICA NUEVA: ¿Llegó un archivo local o una URL?
    if (filePath) {
      image = await loadImage(filePath); // Viene del celular/computadora
    } else {
      const response = await axios.get(propertyData.imageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(response.data, 'binary');
      image = await loadImage(imageBuffer); // Viene de Facebook
    }
    
    ctx.drawImage(image, 0, 0, width, 500);
  } catch (error) {
    ctx.fillStyle = '#E0E0E0';
    ctx.fillRect(0, 0, width, 500);
    ctx.fillStyle = '#999999';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Imagen no disponible', width / 2, 260);
    ctx.textAlign = 'left';
  }

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 500, width, 300);

  ctx.fillStyle = '#00FF88';
  ctx.font = 'bold 50px Arial';
  ctx.fillText(`$${propertyData.price}`, 40, 580);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '30px Arial';
  ctx.fillText(`🛏 ${propertyData.rooms}  🚿 ${propertyData.baths || 'N/A'}`, 40, 640);

  ctx.fillStyle = '#AAAAAA';
  ctx.font = '25px Arial';
  ctx.fillText(`📍 ${propertyData.location}`, 40, 700);

  ctx.fillStyle = '#00FF88';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('somosvivemas.com', 40, 760);

  return canvas.toBuffer('image/png');
}

module.exports = { generatePropertyCard };