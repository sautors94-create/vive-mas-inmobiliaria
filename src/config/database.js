const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,              // ✅ Mantener 10 conexiones listas
      minPoolSize: 5,               // ✅ Mínimo 5 siempre activas
      serverSelectionTimeoutMS: 5000, // ✅ Si no encuentra servidor en 5s, falla rápido
      socketTimeoutMS: 45000,       // ✅ Cerrar sockets inactivos a los 45s
      connectTimeoutMS: 10000       // ✅ Timeout de conexión inicial
    });
    console.log(`MongoDB conectado: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error conectando a MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;