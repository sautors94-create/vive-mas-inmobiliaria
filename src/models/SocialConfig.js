const mongoose = require('mongoose');

// ==========================================
// SOCIAL CONFIG — Configuración de redes sociales
// ==========================================
// Guarda las conexiones de Meta (Facebook/Instagram)
// y LinkedIn de la inmobiliaria.
//
// NOTA:
// Los tokens se guardan en BD. En producción se recomienda
// encriptarlos (p.ej. con módulo crypto del Node).

const socialConfigSchema = new mongoose.Schema({

  // ==========================================
  // TENANT / USUARIO
  // ==========================================
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },

  // Estado general de la conexión de Meta
  isConnected: {
    type: Boolean,
    default: false,
  },

  connectedAt: {
    type: Date,
  },

  // ==========================================
  // META
  // ==========================================
  // No es required porque LinkedIn puede
  // conectarse independientemente de Meta.
  metaAppId: {
    type: String,
  },

  // Token de usuario de Meta
  userAccessToken: {
    type: String,
  },

  userTokenExpiresAt: {
    type: Date,
  },

  // ------------------------------------------
  // Facebook
  // ------------------------------------------
  facebook: {
    pageId: {
      type: String,
    },

    pageName: {
      type: String,
    },

    pageAccessToken: {
      type: String,
    },

    pageTokenExpiresAt: {
      type: Date,
    },
  },

  // ------------------------------------------
  // Instagram Business
  // ------------------------------------------
  instagram: {
    businessAccountId: {
      type: String,
    },

    username: {
      type: String,
    },
  },

  // ==========================================
  // RENOVACIÓN META
  // ==========================================
  lastTokenRefresh: {
    type: Date,
  },

  nextTokenRefresh: {
    type: Date,
  },

  refreshError: {
    type: String,
  },

  // ==========================================
  // PERMISOS META
  // ==========================================
  grantedScopes: [{
    type: String,
  }],

  // Usuario que conectó Meta
  connectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

  // ==========================================
  // LINKEDIN
  // ==========================================
  linkedin: {

    // Estado de conexión
    isConnected: {
      type: Boolean,
      default: false,
    },

    connectedAt: {
      type: Date,
    },

    // Token OAuth de LinkedIn
    accessToken: {
      type: String,
    },

    // Fecha de expiración del token
    tokenExpiresAt: {
      type: Date,
    },

    // ------------------------------------------
    // Página de empresa de LinkedIn
    // ------------------------------------------
    organizationId: {
      type: String,
    },

    organizationUrn: {
      type: String,
    },

    organizationName: {
      type: String,
    },

    // ------------------------------------------
    // Permisos otorgados por LinkedIn
    // ------------------------------------------
    grantedScopes: [{
      type: String,
    }],

    // ------------------------------------------
    // Renovación del token
    // ------------------------------------------
    lastTokenRefresh: {
      type: Date,
    },

    nextTokenRefresh: {
      type: Date,
    },

    refreshError: {
      type: String,
    },

    // Usuario que conectó LinkedIn
    connectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },

}, {
  timestamps: true,
});

// ==========================================
// ÍNDICES
// ==========================================

// Índice existente de Meta
socialConfigSchema.index({
  isConnected: 1,
  'facebook.pageTokenExpiresAt': 1,
});

// Índice para conexiones activas de LinkedIn
socialConfigSchema.index({
  'linkedin.isConnected': 1,
  'linkedin.tokenExpiresAt': 1,
});

module.exports = mongoose.model('SocialConfig', socialConfigSchema);