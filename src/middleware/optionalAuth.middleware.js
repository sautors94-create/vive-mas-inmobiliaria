const jwt = require('jsonwebtoken');
const User = require('../models/User');

const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    
    // Si NO hay token, continúa como visitante anónimo (sin req.user)
    if (!header || !header.startsWith('Bearer ')) {
      return next();
    }
    
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.id).select('status ultimaActividad');
    
    // Si el usuario no existe o está bloqueado, lo tratamos como visitante por seguridad
    if (!user || user.status === 'suspendido' || user.status === 'bloqueado') {
      return next();
    }
    
    // Verificar inactividad (15 minutos)
    const ahora = new Date();
    const diferencia = ahora - user.ultimaActividad;
    const quinceMinutos = 15 * 60 * 1000;
    
    if (diferencia > quinceMinutos) {
      return next(); // Sesión expirada, tratamos como visitante
    }
    
    // Actualizar última actividad
    user.ultimaActividad = ahora;
    await user.save();
    
    // ¡Éxito! Adjuntamos el usuario
    req.user = decoded;
    
  } catch (error) {
    // Token inválido o expirado, NO lanzamos error, continuamos como visitante
  }
  
  next();
};

module.exports = optionalAuthMiddleware;