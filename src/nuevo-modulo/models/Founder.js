const mongoose = require('mongoose');

const founderSchema = new mongoose.Schema({
  // Opcional a propósito: el registro de Agente Fundador es de un solo paso
  // (nombre/teléfono/ciudad, sin crear cuenta) para minimizar fricción con
  // gente reclutada en Facebook Marketplace. Si más adelante el agente
  // también crea una cuenta real en la plataforma, se puede ligar aquí.
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  city: { type: String, required: true },
  referralCode: { type: String, unique: true },
  referredBy: { type: String, default: null }, // referralCode de quien lo invitó
  propertiesCount: { type: Number, default: 0 },
  profileViews: { type: Number, default: 0 },
  rank: { type: Number, default: 1 }, // Nivel por propiedades publicadas (1 a 5)
  rankTitle: { type: String, default: 'Bronce' },

  // Sistema de Embajador: nivel por agentes NUEVOS invitados (no por propiedades)
  referralsCount: { type: Number, default: 0 },
  ambassadorTitle: { type: String, default: null }, // null | 'Embajador' | 'Embajador Oro' | 'Embajador Élite'

  social: {
    facebook: { type: String, default: '' },
    instagram: { type: String, default: '' },
    website: { type: String, default: '' },
  },
}, { timestamps: true });

founderSchema.pre('save', function(next) {
  if (!this.referralCode) {
    const base = (this.name || 'agente').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '-');
    this.referralCode = `${base}-${Math.floor(Math.random() * 10000)}`;
  }

  // Rango por propiedades publicadas: 5, 12, 19, 26 (Bronce/Plata/Oro/Diamante/Élite)
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

  // Nivel de Embajador por agentes invitados: 5 / 10 / 25 (según el plan original)
  const refs = this.referralsCount || 0;
  if (refs >= 25) this.ambassadorTitle = 'Embajador Élite';
  else if (refs >= 10) this.ambassadorTitle = 'Embajador Oro';
  else if (refs >= 5) this.ambassadorTitle = 'Embajador';
  else this.ambassadorTitle = null;

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