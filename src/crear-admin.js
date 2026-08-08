// Crea (o promueve) un usuario administrador.
// Uso:  node src/crear-admin.js correo@ejemplo.com "MiPasswordSegura123"
// Se conecta a la MISMA base de datos que define MONGODB_URI en tu .env —
// apunta esa variable a tu Atlas de producción antes de correrlo si quieres
// crear el admin ahí, o a tu Mongo local si solo estás probando.

require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const User = require('./models/User');

const crearAdmin = async () => {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error('❌ Uso: node src/crear-admin.js correo@ejemplo.com "MiPasswordSegura123"');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('❌ La contraseña debe tener al menos 6 caracteres');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('❌ No se encontró MONGODB_URI en tu .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ Conectado a MongoDB (${mongoose.connection.host})`);

    const existente = await User.findOne({ email: email.toLowerCase().trim() });
    if (existente) {
      existente.role = 'admin';
      existente.verificado = true;
      existente.status = 'activo';
      await existente.save();
      console.log(`✅ El usuario ${email} ya existía — se le dio rol de admin.`);
      process.exit(0);
    }

    // No se hashea aquí a mano: el pre('save') del modelo User ya se encarga de eso.
    await User.create({
      nombre: 'Admin',
      email: email.toLowerCase().trim(),
      password,
      role: 'admin',
      plan: 'premium',
      verificado: true,
      status: 'activo'
    });

    console.log('✅ Usuario admin creado');
    console.log(`📧 Email: ${email}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

crearAdmin();