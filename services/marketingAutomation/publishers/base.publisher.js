// ==========================================
// CLASE BASE ABSTRACTIVA DE PUBLISHERS
// ==========================================
// Define el contrato común que deben implementar todos los
// publicadores de redes sociales (Facebook, Instagram, y futuros).
//
// Cada publisher debe implementar:
// - validate(data): valida que los datos sean correctos
// - publish(data): ejecuta la publicación y devuelve el resultado
//
// Diseñado siguiendo SOLID (Open/Closed): para agregar una nueva red
// solo se crea una subclase sin modificar el resto del módulo.

class BasePublisher {
  constructor(platform) {
    if (this.constructor === BasePublisher) {
      throw new Error('BasePublisher es una clase abstracta y no puede instanciarse');
    }
    this.platform = platform;
  }

  // Valida que los datos sean correctos antes de publicar
  async validate(data) {
    throw new Error(`validate() no implementado en ${this.platform}`);
  }

  // Ejecuta la publicación y devuelve { ok, response, error?, url? }
  async publish(data) {
    throw new Error(`publish() no implementado en ${this.platform}`);
  }

  // Obtiene la URL pública de la publicación (permite sobreescribir)
  async getPostUrl(result) {
    throw new Error(`getPostUrl() no implementado en ${this.platform}`);
  }
}

module.exports = BasePublisher;
