const Message = require('../models/Message');
const Property = require('../models/Property');
const User = require('../models/User');
const { enviarNotificacionMensaje } = require('../utils/email');

const enviarMensaje = async (req, res) => {
  try {
    const { mensaje } = req.body;
    if (!mensaje) return res.status(400).json({ error: 'El mensaje es requerido' });
    const propiedad = await Property.findById(req.params.id)
      .populate('propietario', 'nombre email notificaciones');
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (propiedad.propietario._id.toString() === req.user.id) {
      return res.status(400).json({ error: 'No puedes enviarte mensajes a ti mismo' });
    }
    const remitente = await User.findById(req.user.id).select('nombre');
    const nuevoMensaje = await Message.create({
      propiedad: req.params.id,
      remitente: req.user.id,
      destinatario: propiedad.propietario._id,
      mensaje
    });
    await nuevoMensaje.populate('remitente', 'nombre email');
    await nuevoMensaje.populate('destinatario', 'nombre email');

    const notifs = propiedad.propietario.notificaciones;
    const enviarEmail = !notifs || notifs.mensajes !== false;
    if (enviarEmail) {
      try {
        await enviarNotificacionMensaje(
          propiedad.propietario.email,
          propiedad.propietario.nombre,
          remitente.nombre,
          propiedad.titulo,
          mensaje
        );
      } catch (emailError) {
        console.log('Error enviando notificación:', emailError.message);
      }
    }

    res.status(201).json({ ok: true, mensaje: 'Mensaje enviado', data: nuevoMensaje });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const misConversaciones = async (req, res) => {
  try {
    const mensajes = await Message.find({
      $or: [{ remitente: req.user.id }, { destinatario: req.user.id }]
    })
      .populate('propiedad', 'titulo fotos precio')
      .populate('remitente', 'nombre')
      .populate('destinatario', 'nombre')
      .sort({ createdAt: -1 });
    res.json({ ok: true, total: mensajes.length, mensajes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const conversacionPropiedad = async (req, res) => {
  try {
    const mensajes = await Message.find({
      propiedad: req.params.id,
      $or: [{ remitente: req.user.id }, { destinatario: req.user.id }]
    })
      .populate('remitente', 'nombre')
      .populate('destinatario', 'nombre')
      .sort({ createdAt: 1 });
    await Message.updateMany(
      { propiedad: req.params.id, destinatario: req.user.id, leido: false },
      { leido: true }
    );
    res.json({ ok: true, total: mensajes.length, mensajes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { enviarMensaje, misConversaciones, conversacionPropiedad };