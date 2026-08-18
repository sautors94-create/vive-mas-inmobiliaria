const Property = require('../../models/Property');
const Founder = require('../models/Founder');
const User = require('../models/User'); // Ajusta la ruta a tu modelo real
const { generatePropertyCard } = require('../services/imageGenerator');

// 1. Obtener estado del panel del Agente (Vistas, Links, Rango)
exports.getAgentPanelData = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    
    let founder = await Founder.findOne({ userId: req.user._id });
    
    // Si no es fundador, devuelve estado false
    if (!founder) return res.json({ isFounder: false });

    res.json({
      isFounder: true,
      name: founder.name,
      rank: founder.rank,
      rankTitle: founder.rankTitle,
      propertiesCount: founder.propertiesCount,
      profileViews: founder.profileViews,
      referralLink: `${req.protocol}://${req.get('host')}/agente/${founder.referralCode}`,
      ambassadorLink: `${req.protocol}://${req.get('host')}/?ref=${founder.referralCode}`,
      nextRankProps: founder.rank === 1 ? 5 : founder.rank === 2 ? 12 : founder.rank === 3 ? 19 : founder.rank === 4 ? 26 : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Registrar vista en el perfil público
exports.trackProfileView = async (req, res) => {
  try {
    const founder = await Founder.findOneAndUpdate(
      { referralCode: req.params.referralCode },
      { $inc: { profileViews: 1 } },
      { new: true }
    );
    if (!founder) return res.status(404).send('Agente no encontrado');
    res.json({ views: founder.profileViews });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Generar Card (Actualizada para ligar al userId)
exports.generateCard = async (req, res) => {
  try {
    const founder = await Founder.findOne({ userId: req.user._id });
    if (!founder) return res.status(403).json({ error: 'Debes ser un Agente Fundador' });

    let filePath = null;
    if (req.file) filePath = req.file.path;
    
    const imageBuffer = await generatePropertyCard(req.body, filePath);
    res.set({ 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename=ficha-somosvivemas.png' });
    res.send(imageBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Error al generar imagen' });
  }
};

// 4. Admin List (Actualizada para los nuevos rangos)
exports.getAdminList = async (req, res) => {
  try {
    const agents = await Founder.find().sort({ rank: -1, propertiesCount: -1 });
    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
exports.getAdminList = async (req, res) => {
  try {
    // Aquí puedes agregar lógica si quieres cruzarlo con la tabla de usuarios para sacar el "plan"
    const agents = await Founder.find().sort({ createdAt: -1 });
    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};