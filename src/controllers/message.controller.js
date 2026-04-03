const Message = require('../models/Message');
const Property = require('../models/Property');

const enviarMensaje = async (req, res) => {
  try {
    const { mensaje } = req.body;
    if (!mensaje) return res.status(400).json({ error: 'El mensaje es requerido' });
    const propiedad = await Property.findById(req.params.id);
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (propiedad.propietario.toString() === req.user.id) {
      return res.status(400).json({ error: 'No puedes enviarte mensajes a ti mismo' });
    }
    const nuevoMensaje = await Message.create({
      propiedad: req.params.id,
      remitente: req.user.id,
      destinatario: propiedad.propietario,
      mensaje
    });
    await nuevoMensaje.populate('remitente', 'nombre email');
    await nuevoMensaje.populate('destinatario', 'nombre email');
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
      .populate('remitente', 'nombre email')
      .populate('destinatario', 'nombre email')
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
      .populate('remitente', 'nombre email')
      .populate('destinatario', 'nombre email')
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