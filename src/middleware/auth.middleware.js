const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token requerido' });
    }
    
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar que el usuario exista y esté activo
    const user = await User.findById(decoded.id).select('status ultimaActividad');
    
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }
    
    if (user.status === 'suspendido' || user.status === 'bloqueado') {
      return res.status(403).json({ error: 'Cuenta suspendida o bloqueada' });
    }
    
    // ✅ Verificar inactividad (15 minutos)
    const ahora = new Date();
    const diferencia = ahora - user.ultimaActividad;
    const quinceMinutos = 15 * 60 * 1000;
    
    if (diferencia > quinceMinutos) {
      return res.status(401).json({ 
        error: 'Sesión expirada por inactividad',
        sesionExpirada: true 
      });
    }
    
    // ✅ Actualizar última actividad
    user.ultimaActividad = ahora;
    await user.save();
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

module.exports = authMiddleware;