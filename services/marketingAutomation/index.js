// ==========================================
// PUNTO DE ENTRADA DEL MODULO MARKETING AUTOMATION
// ==========================================
// Inicializa el modulo: suscribe el listener del evento
// "propiedad publicada" y arranca el cron de renovacion de tokens.
//
// Este modulo es 100% desacoplado: solo escucha eventos y ejecuta
// automatizaciones. No conoce usuarios, autenticacion ni propiedades
// directamente (obtiene los datos mediante los servicios/modelos).

const { EventEmitter } = require('events');
const { iniciarListener } = require('./events/propertyPublished.handler');
const { iniciarTokenRefresher } = require('./utils/tokenRefresher');

// Bus de eventos global del sistema (singleton)
const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);

// Inicializa el modulo
const iniciarMarketingAutomation = () => {
  // 1. Suscribir listener del evento "propiedad publicada"
  iniciarListener(eventBus);

  // 2. Arrancar cron de renovacion de tokens
  iniciarTokenRefresher();

  console.log('[MarketingAutomation] Modulo inicializado');
  console.log('[MarketingAutomation] Escuchando evento: property:published');
  console.log('[MarketingAutomation] Reglas: renta->Facebook, venta->Instagram');
  console.log('[MarketingAutomation] Cron de renovacion de tokens: cada 24h');
};

// Exporta el bus de eventos para que el sistema principal emita eventos
module.exports = {
  eventBus,
  iniciarMarketingAutomation,
};
