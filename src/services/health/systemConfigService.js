const SystemConfig = require('../../models/SystemConfig');

// Servicio de configuración de umbrales.
// Obtiene o crea el documento único de configuración con valores por defecto.
const systemConfigService = {
  async obtener() {
    let cfg = await SystemConfig.findOne({ clave: 'salud' });
    if (!cfg) {
      cfg = await SystemConfig.create({ clave: 'salud' });
    }
    return cfg;
  },

  async actualizarUmbrales(data, usuario) {
    const cfg = await this.obtener();
    if (data.umbrales) {
      cfg.umbrales = {
        storage: { ...cfg.umbrales.storage, ...(data.umbrales.storage || {}) },
        cpu: { ...cfg.umbrales.cpu, ...(data.umbrales.cpu || {}) },
        ram: { ...cfg.umbrales.ram, ...(data.umbrales.ram || {}) },
        mongodb: { ...cfg.umbrales.mongodb, ...(data.umbrales.mongodb || {}) },
        cloudinary: { ...cfg.umbrales.cloudinary, ...(data.umbrales.cloudinary || {}) },
      };
    }
    if (data.cloudinaryNiveles) {
      cfg.cloudinaryNiveles = { ...cfg.cloudinaryNiveles, ...data.cloudinaryNiveles };
    }
    if (data.backupMaxHorasSinActualizar != null) {
      cfg.backupMaxHorasSinActualizar = Number(data.backupMaxHorasSinActualizar);
    }
    if (data.intervalosSeg) {
      cfg.intervalosSeg = { ...cfg.intervalosSeg, ...data.intervalosSeg };
    }
    cfg.actualizadoPor = usuario;
    cfg.actualizadoEn = new Date();
    await cfg.save();
    return cfg;
  },
};

module.exports = systemConfigService;
