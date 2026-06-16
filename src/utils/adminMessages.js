const Property = require('../models/Property');
const User = require('../models/User');
const Message = require('../models/Message');

const POLITICAS_URL = '/terminos.html';

const buildMensajeAprobacion = ({ nombre, titulo, status }) => {
  return `Hola ${nombre} 👋\n\nTu propiedad “${titulo}” fue autorizada (${status}).\n\nSi necesitas ajustar fotos o información, revisa nuestras políticas: ${POLITICAS_URL}`;
};

const buildMensajeRechazoFotos = ({ nombre, titulo, motivo }) => {
  return `Hola ${nombre} 👋\n\nLamentamos informarte que tu propiedad “${titulo}” no pasó la validación de fotos y se rechazó.\nMotivo: ${motivo || 'fotos no visibles o no cumplen con el formato requerido'}.\n\nPor favor vuelve a subir tus fotos correctamente y toma en cuenta estas políticas: ${POLITICAS_URL}`;
};



const enviarMensajeDirecto = async ({ propiedad, remitenteId, destinatarioId, mensaje }) => {
  const nuevoMensaje = await Message.create({
    propiedad: propiedad._id,
    remitente: remitenteId,
    destinatario: destinatarioId,
    mensaje
  });

  await nuevoMensaje.populate('remitente', 'nombre email');
  await nuevoMensaje.populate('destinatario', 'nombre email');
  return nuevoMensaje;
};

const validarFotosParaAprobacion = ({ propiedad, minFotos }) => {
  const cantidad = propiedad?.fotos?.length || 0;
  return cantidad >= (minFotos ?? 2);
};

module.exports = {
  POLITICAS_URL,
  buildMensajeAprobacion,
  buildMensajeRechazoFotos,
  enviarMensajeDirecto,
  validarFotosParaAprobacion
};
