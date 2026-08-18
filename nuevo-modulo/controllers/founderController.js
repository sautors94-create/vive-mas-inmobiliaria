const Founder = require('../models/Founder');
const Property = require('../models/Property');
const { generatePropertyCard } = require('../services/imageGenerator');
const path = require('path');

exports.register = async (req, res) => {
  try {
    const { name, phone, city, referredBy } = req.body;
    let founder = await Founder.findOne({ phone });
    if (founder) return res.status(200).json({ message: 'Ya registrado', data: founder });
    founder = new Founder({ name, phone, city, referredBy });
    await founder.save();
    res.status(201).json({ message: 'Agente Fundador creado', data: founder });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// NUEVA VERSIÓN: Ahora recibe la imagen del celular
exports.generateCard = async (req, res) => {
  try {
    let filePath = null;
    
    // Si el usuario subió una foto desde su celular, la guardamos y usamos esa ruta
    if (req.file) {
      filePath = req.file.path;
    }

    // Generamos la imagen pasándole los datos y la ruta de la foto (si existe)
    const imageBuffer = await generatePropertyCard(req.body, filePath);
    
    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': 'attachment; filename=ficha-somosvivemas.png'
    });
    res.send(imageBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Error al generar imagen' });
  }
};

exports.getDashboardData = async (req, res) => {
  try {
    const totalAgents = await Founder.countDocuments();
    const totalProperties = await Property.countDocuments();
    const recentAgents = await Founder.find().sort({ createdAt: -1 }).limit(5).select('name city createdAt rank');
    res.json({ totalAgents, totalProperties, recentAgents });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};