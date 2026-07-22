require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

const SiteConfig = require('./src/models/SiteConfig');

const init = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/vivemas');
    console.log('✅ Conectado a MongoDB local');

    // Crear configuración por defecto
    const existente = await SiteConfig.findOne();
    if (existente) {
      console.log('⚠️ Ya existe configuración');
      process.exit(0);
    }

    await SiteConfig.create({
      tema: {
        nombre: 'default',
        primary: '#1a472a',
        primaryLight: '#2d6a4f',
        accent: '#f4a261',
        accentDark: '#e76f51',
        bgDark: '#0f1923'
      },
      destacadas: [],
      temasPersonalizados: []
    });

    console.log('✅ Configuración del sitio creada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

init();