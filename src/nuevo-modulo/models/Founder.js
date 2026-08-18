const mongoose = require('mongoose');

const founderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Lo ligamos al usuario real
  name: { type: String, required: true },
  phone: { type: String, required: true },
  city: { type: String, required: true },
  referralCode: { type: String, unique: true },
  referredBy: { type: String, default: null },
  propertiesCount: { type: Number, default: 0 },
  profileViews: { type: Number, default: 0 }, // NUEVO: Contador de vistas
  rank: { type: Number, default: 1 }, // NUEVO: Nivel numérico (1 a 5)
  rankTitle: { type: String, default: 'Bronce' } // NUEVO: Nombre del rango
}, { timestamps: true });

founderSchema.pre('save', function(next) {
  if (!this.referralCode) {
    const base = (this.name || 'agente').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '-');
    this.referralCode = `${base}-${Math.floor(Math.random() * 10000)}`;
  }
  
  // LÓGICA DE RANGOS: 5, 7, 7, 7, 10
  const count = this.propertiesCount || 0;
  if (count >= 26) {
    this.rank = 5; this.rankTitle = 'Élite';
  } else if (count >= 19) {
    this.rank = 4; this.rankTitle = 'Diamante';
  } else if (count >= 12) {
    this.rank = 3; this.rankTitle = 'Oro';
  } else if (count >= 5) {
    this.rank = 2; this.rankTitle = 'Plata';
  } else {
    this.rank = 1; this.rankTitle = 'Bronce';
  }

  next();
});

// Para actualizar rango sin crear nuevo documento
founderSchema.methods.calculateRank = function() {
  const count = this.propertiesCount || 0;
  if (count >= 26) return { rank: 5, rankTitle: 'Élite' };
  if (count >= 19) return { rank: 4, rankTitle: 'Diamante' };
  if (count >= 12) return { rank: 3, rankTitle: 'Oro' };
  if (count >= 5) return { rank: 2, rankTitle: 'Plata' };
  return { rank: 1, rankTitle: 'Bronce' };
};

module.exports = mongoose.model('Founder', founderSchema);