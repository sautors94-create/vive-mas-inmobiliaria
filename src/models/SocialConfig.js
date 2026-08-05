const mongoose = require('mongoose');

// ==========================================
// SOCIAL CONFIG — Configuración de conexión Meta
// ==========================================
// Guarda los tokens de acceso de la página de Facebook e Instagram
// de la inmobiliaria. Se usa para publicar automáticamente.
//
// NOTA: Los tokens se guardan en BD. En producción se recomienda
// encriptarlos (p.ej. con módulo crypto del Node).

const socialConfigSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  isConnected: { type: Boolean, default: false },
  connectedAt: { type: Date },
  metaAppId: { type: String, required: true },

  // Token de usuario (largo)
  userAccessToken: { type: String },
  userTokenExpiresAt: { type: Date },

  // Página de Facebook
  facebook: {
    pageId: { type: String },
    pageName: { type: String },
    pageAccessToken: { type: String },
    pageTokenExpiresAt: { type: Date },
  },

  // Instagram Business
  instagram: {
    businessAccountId: { type: String },
    username: { type: String },
  },

  // Renovación
  lastTokenRefresh: { type: Date },
  nextTokenRefresh: { type: Date },
  refreshError: { type: String },

  // Permisos otorgados
  grantedScopes: [{ type: String }],

  connectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

socialConfigSchema.index({ isConnected: 1, 'facebook.pageTokenExpiresAt': 1 });

module.exports = mongoose.model('SocialConfig', socialConfigSchema);
