const mongoose = require('mongoose');

const BrandCategorySchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true }
});

const BrandCitySchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true }
});

const BrandAccountSchema = new mongoose.Schema({
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, unique: true, sparse: true },
  password: { type: String, required: false },
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' }
}, { timestamps: true });

const BrandSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'BrandAccount', required: true },
  nombreComercial: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  descripcion: { type: String, default: '' },
  categorias: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BrandCategory' }],
  ciudadPrincipal: { type: mongoose.Schema.Types.ObjectId, ref: 'BrandCity' },
  ciudadesCobertura: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BrandCity' }],
  logo: { type: String, default: '' },
  portada: { type: String, default: '' },
  telefono: { type: String, default: '' },
  whatsapp: { type: String, default: '' },
  emailContacto: { type: String, default: '' },
  sitioWeb: { type: String, default: '' },
  promociones: [{
    tipo: String,
    descripcion: String,
    vigencia: Date,
    condiciones: String
  }],
  status: { 
    type: String, 
    enum: ['borrador', 'publicado', 'despublicado', 'bloqueado', 'eliminado'], 
    default: 'borrador' 
  }
}, { timestamps: true });

const BrandOTPSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'BrandAccount', required: true },
  codigo: { type: String, required: true },
  tipo: { type: String, enum: ['email', 'phone'], required: true },
  intentos: { type: Number, default: 0 },
  expira: { type: Date, required: true }
});

BrandOTPSchema.index({ expira: 1 }, { expireAfterSeconds: 600 }); // 10 minutos

module.exports = {
  BrandCategory: mongoose.models.BrandCategory || mongoose.model('BrandCategory', BrandCategorySchema),
  BrandCity: mongoose.models.BrandCity || mongoose.model('BrandCity', BrandCitySchema),
  BrandAccount: mongoose.models.BrandAccount || mongoose.model('BrandAccount', BrandAccountSchema),
  Brand: mongoose.models.Brand || mongoose.model('Brand', BrandSchema),
  BrandOTP: mongoose.models.BrandOTP || mongoose.model('BrandOTP', BrandOTPSchema)
};