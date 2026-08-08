// Monitor de Backups.
// IMPORTANTE: No asumir que un backup existe solo porque el sistema lo diga.
// Actualmente el proyecto NO tiene un sistema de backups integrado.
// Este monitor reporta el estado real de configuración. Si más adelante se
// integra mongodump / Atlas Cloud Backup / cron, se puede enriquecer registrando
// el último backup real validado.
const backupMonitor = {
  async recolectar() {
    const rutaBackup = process.env.BACKUP_PATH || null;
    const crontabConfigurado = process.env.BACKUP_CRON === '1';

    // Estado real: sin mecanismo de backup verificado → no_configurado
    return {
      configurado: false,
      metodo: null,
      ultimoBackup: null,
      tamanoUltimoMB: 0,
      estado: 'no_configurado',
      validado: null,
      documentacion: 'El proyecto no cuenta con un sistema de backups integrado. Para habilitarlo: configurar mongodump periódico (cron) o Atlas Cloud Backup y registrar la ruta en BACKUP_PATH y habilitar BACKUP_CRON=1. El último backup debe validarse realmente (existencia de archivo) antes de mostrarse como Correcto.',
      rutaBackupConfigurada: Boolean(rutaBackup),
      crontabHabilitado: crontabConfigurado,
    };
  },
};

module.exports = backupMonitor;
