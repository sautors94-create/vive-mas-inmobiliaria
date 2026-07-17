const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true // Evita que se registren 2 veces con el mismo correo
  },
  tipo: { 
    type: String, 
    default: 'premium' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now, 
    expires: 365 // Se borra automáticamente de la BD en 1 año
  }
});

module.exports = mongoose.model('Waitlist', waitlistSchema);