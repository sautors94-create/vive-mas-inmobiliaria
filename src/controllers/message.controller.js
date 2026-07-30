const Message = require('../models/Message');
const Property = require('../models/Property');
const User = require('../models/User');
const BannedUser = require('../models/BannedUser');
const { enviarNotificacionMensaje } = require('../utils/email');

// ==========================================
// GENERAR CONVERSATION ID
// ==========================================
const generarConversacionId = (id1, id2, propiedadId) => {
  const ordered = [id1, id2].sort();
  const base = `${ordered[0]}_${ordered[1]}`;
  return propiedadId ? `${base}_${propiedadId}` : base;
};

// ==========================================
// BOT DE DETECCIÓN DE RIESGO
// ==========================================
const PATRONES_RIESGO = [
  { flags: ['pago_fuera_plataforma'], patron: /\b(paga(r)?|deposita|transferir|clabe|clabe|spei|oxxo|deposito)\b.*(fuera|whatsapp|telegram|correo|personal|directo|otra|cuenta)\b/i, nivel: 'alto' },
  { flags: ['pago_anticipado'], patron: /\b(anticipado|adelantado|seña|anticipo|reserva.*paga|paga.*reserva)\b/i, nivel: 'alto' },
  { flags: ['clabe_bancaria'], patron: /\b\d{18}\b/, nivel: 'critico' },
  { flags: ['cuenta_bancaria'], patron: /\b(clabe|banco|santander|bbva|bancomer|banamex|hsbc|citibanamex|inbursa|afirme|bajio|scotiabank)\b.*\d{4,}/i, nivel: 'critico' },
  { flags: ['comunicacion_fuera'], patron: /\b(whatsapp|telegram|signal|wsp|wassap|wasap)\s*[:.]?\s*\d/i, nivel: 'medio' },
  { flags: ['precio_distinto'], patron: /\b(mejor\s*precio|descuento\s*especial|solo\s*hoy|oferta\s*unica|no\s*lo\s*digas)\b/i, nivel: 'medio' },
  { flags: ['urgencia_engañosa'], patron: /\b(ultimo|se\sva|queda\s*poco|solo\s*hoy|mañana\s*sube|ya\s*no\s*hay)\b.*\b(paga|deposita|transfiere)/i, nivel: 'alto' },
  { flags: ['identidad_sospechosa'], patron: /\b(soy\s*(agente|broker|abogado|notario)|represento\s*(a\s*la|al))\b/i, nivel: 'medio' },
];

const analizarRiesgo = (texto) => {
  const flags = [];
  let nivelMaximo = 'bajo';
  const jerarquia = { bajo: 0, medio: 1, alto: 2, critico: 3 };

  for (const p of PATRONES_RIESGO) {
    if (p.patron.test(texto)) {
      flags.push(...p.flags);
      if ((jerarquia[p.nivel] || 0) > (jerarquia[nivelMaximo] || 0)) {
        nivelMaximo = p.nivel;
      }
    }
  }

  return {
    riesgo: nivelMaximo,
    riesgoFlags: flags,
    riesgoRevision: nivelMaximo === 'alto' || nivelMaximo === 'critico'
  };
};

// ==========================================
// ENVIAR MENSAJE (P2P con restricción de plan)
// ==========================================
const enviarMensaje = async (req, res) => {
  try {
    const { mensaje, destinatarioId, propiedadId } = req.body;
    if (!mensaje || !mensaje.trim()) return res.status(400).json({ error: 'El mensaje es requerido' });
    if (!destinatarioId) return res.status(400).json({ error: 'Destinatario requerido' });

    // No enviarse a sí mismo
    if (destinatarioId === req.user.id) {
      return res.status(400).json({ error: 'No puedes enviarte mensajes a ti mismo' });
    }

    // Verificar que destinatario existe
    const destinoUser = await User.findById(destinatarioId);
    if (!destinatarioId) return res.status(404).json({ error: 'Destinatario no encontrado' });

    // Verificar si está vetado (remitente O destinatario)
    const vetadoRemitente = await BannedUser.findOne({ usuario: req.user.id, activo: true });
    if (vetadoRemitente) return res.status(403).json({ error: 'Tu cuenta tiene restricciones de mensajería. Contacta soporte.' });

    const vetadoDestino = await BannedUser.findOne({ usuario: destinatarioId, activo: true });
    if (vetadoDestino) return res.status(403).json({ error: 'No puedes enviar mensajes a este usuario.' });

    // Determinar conversacionId
    const propId = propiedadId || null;
    const conversacionId = generarConversacionId(req.user.id, destinatarioId, propId);

    // ==========================================
    // RESTRICCIÓN: Usuario gratuito respondiendo como vendedor
    // Un vendedor es quien es propietario de la propiedad en la conversación
    // ==========================================
    if (propId) {
      const propiedad = await Property.findById(propId);
      if (propiedad && propiedad.propietario.toString() === req.user.id) {
        const user = await User.findById(req.user.id);
        const esGratuito = (user.plan || 'gratuito').toLowerCase() === 'gratuito';

        if (esGratuito) {
          // Contar respuestas previas del vendedor en esta conversación
          const respuestasVendedor = await Message.countDocuments({
            conversacionId,
            remitente: req.user.id
          });

          if (respuestasVendedor >= 1) {
            return res.status(403).json({
              error: 'Límite de respuestas alcanzado',
              detalle: 'Los usuarios del plan Gratuito solo pueden responder 1 vez como vendedores. Mejora tu plan para responder sin límites.',
              limiteAlcanzado: true
            });
          }
        }
      }
    }

    // Analizar riesgo
    const analisis = analizarRiesgo(mensaje);

    // Crear mensaje
    const nuevoMensaje = await Message.create({
      propiedad: propId,
      conversacionId,
      remitente: req.user.id,
      destinatario: destinatarioId,
      mensaje: mensaje.trim(),
      riesgo: analisis.riesgo,
      riesgoFlags: analisis.riesgoFlags,
      riesgoRevision: analisis.riesgoRevision
    });

    await nuevoMensaje.populate('remitente', 'nombre email avatar');
    await nuevoMensaje.populate('destinatario', 'nombre email avatar');

    // Notificación por email (solo si hay propiedad)
    if (propId) {
      const propiedad = await Property.findById(propId).populate('propietario', 'nombre email notificaciones');
      if (propiedad && propiedad.propietario) {
        const notifs = propiedad.propietario.notificaciones;
        if (!notifs || notifs.mensajes !== false) {
          try {
            const remitente = await User.findById(req.user.id).select('nombre');
            await enviarNotificacionMensaje(
              propiedad.propietario.email,
              propiedad.propietario.nombre,
              remitente.nombre,
              propiedad.titulo,
              mensaje
            );
          } catch (e) {
            console.log('Error enviando notificación:', e.message);
          }
        }
      }
    }

    res.status(201).json({ ok: true, mensaje: 'Mensaje enviado', data: nuevoMensaje });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// LISTA DE CONVERSACIONES (inbox)
// ==========================================
const misConversaciones = async (req, res) => {
  try {
    // Obtener todos los conversationId donde participa el usuario
    const mensajes = await Message.find({
      $or: [{ remitente: req.user.id }, { destinatario: req.user.id }]
    }).select('conversacionId').distinct('conversacionId');

    if (mensajes.length === 0) {
      return res.json({ ok: true, conversaciones: [] });
    }

    // Para cada conversación, obtener el último mensaje y datos del otro usuario
    const conversaciones = [];
    for (const convId of mensajes) {
      const ultimo = await Message.findOne({ conversacionId: convId })
        .sort({ createdAt: -1 })
        .populate('remitente', 'nombre email avatar')
        .populate('destinatario', 'nombre email avatar')
        .populate('propiedad', 'titulo fotos precio');

      if (!ultimo) continue;

      // Determinar el "otro" usuario
      const otroUsuario = ultimo.remitente._id.toString() === req.user.id
        ? ultimo.destinatario
        : ultimo.remitente;

      // Contar no leídos
      const noLeidos = await Message.countDocuments({
        conversacionId: convId,
        destinatario: req.user.id,
        leido: false
      });

      // Total mensajes
      const total = await Message.countDocuments({ conversacionId: convId });

      conversaciones.push({
        conversacionId: convId,
        otroUsuario,
        propiedad: ultimo.propiedad,
        ultimoMensaje: ultimo.mensaje,
        ultimoMensajeFecha: ultimo.createdAt,
        noLeidos,
        total
      });
    }

    // Ordenar por último mensaje
    conversaciones.sort((a, b) => new Date(b.ultimoMensajeFecha) - new Date(a.ultimoMensajeFecha));

    res.json({ ok: true, conversaciones });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// MENSAJES DE UNA CONVERSACIÓN
// ==========================================
const conversacionPorId = async (req, res) => {
  try {
    const { conversacionId } = req.params;
    const mensajes = await Message.find({ conversacionId })
      .populate('remitente', 'nombre email avatar')
      .populate('destinatario', 'nombre email avatar')
      .populate('propiedad', 'titulo fotos precio ubicacion')
      .sort({ createdAt: 1 });

    // Marcar como leídos los que son para mí
    await Message.updateMany(
      { conversacionId, destinatario: req.user.id, leido: false },
      { leido: true }
    );

    res.json({ ok: true, mensajes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// CONVERSACIÓN POR PROIEDAD (compatibilidad con vista anterior)
// ==========================================
const conversacionPropiedad = async (req, res) => {
  try {
    const conversacionId = generarConversacionId(req.user.id, req.query.otro || '', req.params.id);
    const mensajes = await Message.find({ conversacionId })
      .populate('remitente', 'nombre')
      .populate('destinatario', 'nombre')
      .sort({ createdAt: 1 });
    await Message.updateMany(
      { conversacionId, destinatario: req.user.id, leido: false },
      { leido: true }
    );
    res.json({ ok: true, conversacionId, total: mensajes.length, mensajes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// EXPORTAR MENSAJES A EXCEL
// ==========================================
const exportarMensajesExcel = async (req, res) => {
  try {
    const mensajes = await Message.find({
      $or: [{ remitente: req.user.id }, { destinatario: req.user.id }]
    })
      .populate('remitente', 'nombre email')
      .populate('destinatario', 'nombre email')
      .populate('propiedad', 'titulo')
      .sort({ createdAt: -1 });

    if (mensajes.length === 0) {
      return res.status(404).json({ error: 'No tienes mensajes para exportar' });
    }

    // Construir datos para Excel
    const XLSX = require('xlsx');
    const datos = mensajes.map(m => ({
      'Fecha': new Date(m.createdAt).toLocaleString('es-MX'),
      'Remitente': m.remitente?.nombre || 'Desconocido',
      'Email Remitente': m.remitente?.email || '',
      'Destinatario': m.destinatario?.nombre || 'Desconocido',
      'Email Destinatario': m.destinatario?.email || '',
      'Propiedad': m.propiedad?.titulo || 'Conversación directa',
      'Mensaje': m.mensaje,
      'Leído': m.leido ? 'Sí' : 'No',
      'Nivel de Riesgo': m.riesgo || 'bajo',
      'Flags de Riesgo': (m.riesgoFlags || []).join(', ') || 'Ninguno',
      'Requiere Revisión': m.riesgoRevision ? 'Sí' : 'No'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datos);

    // Ajustar anchos de columna
    ws['!cols'] = [
      { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 25 },
      { wch: 30 }, { wch: 60 }, { wch: 8 }, { wch: 15 }, { wch: 35 }, { wch: 15 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Mensajes');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=mis-mensajes-${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// ADMIN: Monitoreo de mensajes con riesgo
// ==========================================
const mensajesConRiesgo = async (req, res) => {
  try {
    const { nivel, revision, page = 1, limit = 30 } = req.query;
    const filtro = {};

    if (nivel && nivel !== 'todos') filtro.riesgo = nivel;
    if (revision === 'true') filtro.riesgoRevision = true;
    if (revision === 'false') filtro.riesgoRevision = false;

    // Excluir bajo riesgo por defecto
    if (!nivel) filtro.riesgo = { $ne: 'bajo' };

    const total = await Message.countDocuments(filtro);
    const mensajes = await Message.find(filtro)
      .populate('remitente', 'nombre email telefono plan')
      .populate('destinatario', 'nombre email telefono plan')
      .populate('propiedad', 'titulo precio')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Resumen de riesgo
    const resumen = await Message.aggregate([
      { $group: { _id: '$riesgo', total: { $sum: 1 } } }
    ]);

    const pendientesRevision = await Message.countDocuments({ riesgoRevision: true });

    res.json({
      ok: true,
      mensajes,
      total,
      paginas: Math.ceil(total / limit),
      resumen: resumen.reduce((acc, r) => { acc[r._id] = r.total; return acc; }, {}),
      pendientesRevision
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ADMIN: Marcar mensaje como revisado
const marcarMensajeRevisado = async (req, res) => {
  try {
    await Message.findByIdAndUpdate(req.params.id, { riesgoRevision: false });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ADMIN: KPIs para el módulo de Monitoreo
const getRiesgoStats = async (req, res) => {
  try {
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

    const [resumen, pendientesRevision, hoy] = await Promise.all([
      Message.aggregate([{ $group: { _id: '$riesgo', total: { $sum: 1 } } }]),
      Message.countDocuments({ riesgoRevision: true }),
      Message.countDocuments({ riesgo: { $ne: 'bajo' }, createdAt: { $gte: inicioHoy } })
    ]);
    const porNivel = resumen.reduce((acc, r) => { acc[r._id || 'bajo'] = r.total; return acc; }, {});

    const tendencia = [];
    for (let i = 6; i >= 0; i--) {
      const inicio = new Date(inicioHoy); inicio.setDate(inicio.getDate() - i);
      const fin = new Date(inicio); fin.setDate(fin.getDate() + 1);
      const count = await Message.countDocuments({ riesgo: { $ne: 'bajo' }, createdAt: { $gte: inicio, $lt: fin } });
      tendencia.push({ fecha: inicio.toISOString().slice(0, 10), count });
    }

    res.json({
      ok: true,
      medio: porNivel.medio || 0,
      alto: porNivel.alto || 0,
      critico: porNivel.critico || 0,
      pendientesRevision,
      hoy,
      tendencia
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ADMIN: Exportar mensajes de riesgo a Excel
const exportarMensajesRiesgoExcel = async (req, res) => {
  try {
    const { nivel, revision } = req.query;
    const filtro = {};
    if (nivel && nivel !== 'todos') filtro.riesgo = nivel;
    else filtro.riesgo = { $ne: 'bajo' };
    if (revision === 'true') filtro.riesgoRevision = true;
    if (revision === 'false') filtro.riesgoRevision = false;

    const mensajes = await Message.find(filtro)
      .populate('remitente', 'nombre email telefono plan')
      .populate('destinatario', 'nombre email telefono plan')
      .populate('propiedad', 'titulo precio')
      .sort({ createdAt: -1 });

    if (mensajes.length === 0) {
      return res.status(404).json({ error: 'No hay mensajes para exportar con esos filtros' });
    }

    const XLSX = require('xlsx');
    const datos = mensajes.map(m => ({
      'Fecha': new Date(m.createdAt).toLocaleString('es-MX'),
      'Remitente': m.remitente?.nombre || 'Desconocido',
      'Email remitente': m.remitente?.email || '',
      'Destinatario': m.destinatario?.nombre || 'Desconocido',
      'Email destinatario': m.destinatario?.email || '',
      'Propiedad': m.propiedad?.titulo || 'Conversación directa',
      'Mensaje': m.mensaje,
      'Nivel de riesgo': m.riesgo || 'bajo',
      'Flags': (m.riesgoFlags || []).join(', ') || 'Ninguno',
      'Pendiente de revisión': m.riesgoRevision ? 'Sí' : 'No'
    }));

    const worksheet = XLSX.utils.json_to_sheet(datos);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mensajes de riesgo');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=mensajes-riesgo-${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// ==========================================
// COMPATIBILIDAD: propiedad.html envía POST /mensajes/:id
// con solo { mensaje } — formato viejo
// ==========================================
const enviarMensajePropiedad = async (req, res) => {
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
    const propId = req.params.id;
    const conversacionId = generarConversacionId(req.user.id, propiedad.propietario._id.toString(), propId);

    // Verificar vetado
    const BannedUser = require('../models/BannedUser');
    const vetadoR = await BannedUser.findOne({ usuario: req.user.id, activo: true });
    if (vetadoR) return res.status(403).json({ error: 'Tu cuenta tiene restricciones de mensajería.' });
    const vetadoD = await BannedUser.findOne({ usuario: propiedad.propietario._id, activo: true });
    if (vetadoD) return res.status(403).json({ error: 'No puedes enviar mensajes a este usuario.' });

    // Restricción gratuito respondiendo como vendedor
    const user = await User.findById(req.user.id);
    if ((user.plan || 'gratuito').toLowerCase() === 'gratuito') {
      const respuestas = await Message.countDocuments({ conversacionId, remitente: req.user.id });
      if (respuestas >= 1) {
        return res.status(403).json({
          error: 'Límite de respuestas alcanzado',
          detalle: 'Los usuarios del plan Gratuito solo pueden responder 1 vez como vendedores.',
          limiteAlcanzado: true
        });
      }
    }

    // Analizar riesgo
    const analisis = analizarRiesgo(mensaje);

    const nuevoMensaje = await Message.create({
      propiedad: propId,
      conversacionId,
      remitente: req.user.id,
      destinatario: propiedad.propietario._id,
      mensaje: mensaje.trim(),
      riesgo: analisis.riesgo,
      riesgoFlags: analisis.riesgoFlags,
      riesgoRevision: analisis.riesgoRevision
    });

    await nuevoMensaje.populate('remitente', 'nombre email avatar');
    await nuevoMensaje.populate('destinatario', 'nombre email avatar');

    // Notificación email
    const notifs = propiedad.propietario.notificaciones;
    if (!notifs || notifs.mensajes !== false) {
      try {
        await enviarNotificacionMensaje(
          propiedad.propietario.email,
          propiedad.propietario.nombre,
          remitente.nombre,
          propiedad.titulo,
          mensaje
        );
      } catch (e) { console.log('Error email:', e.message); }
    }

    res.status(201).json({ ok: true, mensaje: 'Mensaje enviado', data: nuevoMensaje });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Purga mensajes con más de 6 meses de antigüedad. No toca los marcados para
// revisión de riesgo ni los de riesgo medio/alto/crítico, para no perder
// evidencia de moderación. Usada por el cron automático en app.js y por el
// endpoint manual de admin.
const purgarMensajesAntiguos = async () => {
  const limite = new Date();
  limite.setMonth(limite.getMonth() - 6);
  const resultado = await Message.deleteMany({
    createdAt: { $lt: limite },
    riesgoRevision: { $ne: true },
    riesgo: { $in: ['bajo', null] },
  });
  return resultado.deletedCount;
};

const purgarMensajesAdmin = async (req, res) => {
  try {
    const deletedCount = await purgarMensajesAntiguos();
    res.json({ ok: true, deletedCount });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

module.exports = {
  enviarMensaje,
  misConversaciones,
  conversacionPorId,
  conversacionPropiedad,
  exportarMensajesExcel,
  mensajesConRiesgo,
  marcarMensajeRevisado,
  getRiesgoStats,
  exportarMensajesRiesgoExcel,
  enviarMensajePropiedad,
  purgarMensajesAntiguos,
  purgarMensajesAdmin,
};