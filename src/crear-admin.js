require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const crearAdmin = async () => {
  try {
    // Conectar a local
    await mongoose.connect('mongodb://localhost:27017/vivemas');
    console.log('✅ Conectado a MongoDB local');

    // Definir esquema temporal
    const userSchema = new mongoose.Schema({
      nombre: String,
      email: { type: String, unique: true },
      password: String,
      telefono: String,
      role: String,
      plan: String,
      verificado: Boolean,
      status: String
    });

    const User = mongoose.model('User', userSchema);

    // Verificar si ya existe
    const existe = await User.findOne({ email: 'admin@vivemas.com' });
    if (existe) {
      console.log('⚠️ El admin ya existe');
      process.exit(0);
    }

    // Crear admin
    const passwordHash = await bcrypt.hash('Bollito1', 10);
    
    await User.create({
      nombre: 'Admin',
      email: 'admin@vivemas.com',
      password: passwordHash,
      telefono: '',
      role: 'admin',
      plan: 'premium',
      verificado: true,
      status: 'activo'
    });

    console.log('✅ Usuario admin creado');
    console.log('📧 Email: admin@vivemas.com');
    console.log('🔑 Contraseña: Bollito1');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

crearAdmin();