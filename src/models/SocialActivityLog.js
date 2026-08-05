const mongoose = require('mongoose');

// ==========================================
// SOCIAL ACTIVITY LOG — Registro de actividad
// ==========================================
// Guarda cada intento de publicación en redes sociales.
// Contiene hora, usuario, propiedad, red social, respuesta,
// código HTTP, tiempo de respuesta, intento y error.

const socialActivityLogSchema = new mongoose.Schema({
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  platform: {
    type: String,
    enum: ['facebook', 'instagram'],
    required: true,
    index: true,
  },
  action: {
    type: String,
    enum: ['publish', 'retry', 'delete', 'update'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'publishing', 'published', 'failed'],
    required: true,
    index: true,
  },
  requestData: {
    caption: { type: String },
    imageUrl: { type: String },
    propertyUrl: { type: String },
    imageId: { type: String },
  },
  responseData: {
    postId: { type: String },
    mediaId: { type: String },
    postUrl: { type: String },
    raw: { type: mongoose.Schema.Types.Mixed },
  },
  error: {
    code: { type: Number },
    message: { type: String },
    type: { type: String },
    raw: { type: mongoose.Schema.Types.Mixed },
  },
  responseTime: { type: Number },
  httpStatus: { type: Number },
  attempt: { type: Number, default: 1 },
  maxAttempts: { type: Number, default: 3 },
  nextRetryAt: { type: Date },
}, { timestamps: true });

socialActivityLogSchema.index({ propertyId: 1, platform: 1 });
socialActivityLogSchema.index({ status: 1, nextRetryAt: 1 });

module.exports = mongoose.model('SocialActivityLog', socialActivityLogSchema);
