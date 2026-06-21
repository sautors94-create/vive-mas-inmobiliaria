const User = require('../models/User');
const Property = require('../models/Property');
const Lead = require('../models/Lead');

const getUsuarios = async (req, res) => {
  try {
    const { plan, role, status, search } = req.query;
    const filtro = {};
    if (plan) filtro.plan = plan;
    if (role) filtro.role = role;
    if (status) filtro.status = status;
    if (search) filtro.$or = [
      { nombre: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
    const usuarios = await User.find(filtro).sort({ createdAt: -1 });
    res.json({ ok: true, total: usuarios.length, usuarios });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const cambiarPlan = async (req, res) => {
  try {
    const { plan } = req.body;
    const planesValidos = ['gratuito', 'basico', 'premium'];
    if (!planesValidos.includes(plan)) return res.status(400).json({ error: 'Plan no válido' });
    const usuario = await User.findByIdAndUpdate(req.params.id, { plan }, { new: true });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true, usuario });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const suspenderUsuario = async (req, res) => {
  try {
    const usuario = await User.findById(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    usuario.status = usuario.status === 'activo' ? 'suspendido' : 'activo';
    await usuario.save();
    res.json({ ok: true, mensaje: `Usuario ${usuario.status}`, usuario });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const eliminarUsuario = async (req, res) => {
  try {
    const usuario = await User.findById(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (usuario.role === 'admin') return res.status(403).json({ error: 'No puedes eliminar un admin' });
    await Property.updateMany({ propietario: req.params.id }, { status: 'rechazada' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ ok: true, mensaje: 'Usuario eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPropiedadesRevision = async (req, res) => {
  try {
    const { status, search, estado, tipo } = req.query;
    const filtro = {};

    if (status) filtro.status = status;

    if (estado) filtro['ubicacion.estado'] = estado;
    if (tipo) filtro.tipo = tipo;
    if (search) filtro.$or = [
      { titulo: { $regex: search, $options: 'i' } },
      { 'ubicacion.ciudad': { $regex: search, $options: 'i' } },
      { 'ubicacion.estado': { $regex: search, $options: 'i' } }
    ];
    const propiedades = await Property.find(filtro)
      .populate('propietario', 'nombre email telefono plan')
      .sort({ createdAt: -1 });
    res.json({ ok: true, total: propiedades.length, propiedades });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getLeads = async (req, res) => {
  try {
    const { status, search, servicio } = req.query;
    const filtro = {};
    if (status) filtro.status = status;
    if (servicio) filtro.servicio = { $regex: servicio, $options: 'i' };
    if (search) filtro.$or = [
      { folio: { $regex: search, $options: 'i' } },
      { nombre: { $regex: search, $options: 'i' } },
      { telefono: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { ciudad: { $regex: search, $options: 'i' } }
    ];

    const leads = await Lead.find(filtro)
      .populate('usuarioRegistrado', 'nombre email telefono plan')
      .populate('atendidoPor', 'nombre email')
      .sort({ createdAt: -1 });

    res.json({ ok: true, total: leads.length, leads });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const { buildMensajeAprobacion, buildMensajeRechazoFotos, validarFotosParaAprobacion } = require('../utils/adminMessages');
const { enviarNotificacionMensaje } = require('../utils/email');


const enviarMensajeInternoParaPropiedad = async ({ req, propiedadId, mensaje }) => {
  // Crea el mensaje usando el flujo existente de messages
  const Message = require('../models/Message');
  const propiedad = await Property.findById(propiedadId).populate('propietario', 'nombre notificaciones');
  if (!propiedad) throw new Error('Propiedad no encontrada');

  const remitenteId = req.user.id; // admin
  const destinatarioId = propiedad.propietario._id;

  if (destinatarioId.toString() === remitenteId.toString()) {
    // Evitar envío a sí mismo
    return;
  }

  const nuevoMensaje = await Message.create({
    propiedad: propiedadId,
    remitente: remitenteId,
    destinatario: destinatarioId,
    mensaje
  });

  await nuevoMensaje.populate('remitente', 'nombre email');
  await nuevoMensaje.populate('destinatario', 'nombre email');

  // Notificación email si el usuario lo tiene activo
  const notifs = propiedad.propietario.notificaciones;
  const enviarEmail = !notifs || notifs.mensajes !== false;
  if (enviarEmail && propiedad.propietario.email) {
    try {
      await enviarNotificacionMensaje(
        propiedad.propietario.email,
        propiedad.propietario.nombre,
        req.user.nombre || 'Admin',
        propiedad.titulo,
        mensaje
      );
    } catch (_) {}
  }
};

const aprobarPropiedad = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id).populate('propietario', 'nombre notificaciones');
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });

    // Validación inicial de fotos: rechazar si fotos < 2
    const minFotos = 2;
    const fotosOK = validarFotosParaAprobacion({ propiedad, minFotos });

    if (!fotosOK) {
      await Property.findByIdAndUpdate(req.params.id, {
        status: 'rechazada',
        motivo_rechazo: 'Rechazada por validación de fotos (no se cargaron correctamente o faltan fotos).'
      }, { new: true });

      const msg = buildMensajeRechazoFotos({
        nombre: propiedad.propietario.nombre,
        titulo: propiedad.titulo,
        motivo: 'No se cargaron correctamente o faltan fotos. Por favor sube nuevamente.'
      });

      await enviarMensajeInternoParaPropiedad({ req, propiedadId: req.params.id, mensaje: msg });

      return res.json({ ok: true, mensaje: 'Propiedad rechazada (validación de fotos)', propiedad: { ...propiedad.toObject(), status: 'rechazada' } });
    }

    const updated = await Property.findByIdAndUpdate(
      req.params.id,
      { status: 'aprobada', motivo_rechazo: null },
      { new: true }
    );

    const msg = buildMensajeAprobacion({ nombre: propiedad.propietario.nombre, titulo: propiedad.titulo, status: 'autorizada' });
    await enviarMensajeInternoParaPropiedad({ req, propiedadId: req.params.id, mensaje: msg });

    res.json({ ok: true, mensaje: 'Propiedad aprobada', propiedad: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const rechazarPropiedad = async (req, res) => {
  try {
    const { motivo } = req.body;
    if (!motivo) return res.status(400).json({ error: 'Debes indicar el motivo de rechazo' });

    const propiedad = await Property.findById(req.params.id).populate('propietario', 'nombre notificaciones');
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });

    const updated = await Property.findByIdAndUpdate(
      req.params.id,
      { status: 'rechazada', motivo_rechazo: motivo },
      { new: true }
    );

    const msg = buildMensajeRechazoFotos({
      nombre: propiedad.propietario.nombre,
      titulo: propiedad.titulo,
      motivo
    });

    await enviarMensajeInternoParaPropiedad({ req, propiedadId: req.params.id, mensaje: msg });

    res.json({ ok: true, mensaje: 'Propiedad rechazada', propiedad: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const eliminarPropiedad = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id);
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    await Property.findByIdAndDelete(req.params.id);
    res.json({ ok: true, mensaje: 'Propiedad eliminada permanentemente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const bloquearPropiedad = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id);
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    const nuevoStatus = propiedad.status === 'bloqueada' ? 'revision' : 'bloqueada';
    await Property.findByIdAndUpdate(req.params.id, { status: nuevoStatus });
    res.json({ ok: true, mensaje: `Propiedad ${nuevoStatus}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const dashboard = async (req, res) => {
  try {
    const totalUsuarios = await User.countDocuments();
    const totalPropiedades = await Property.countDocuments();
    const totalLeads = await Lead.countDocuments();
    const leadsNuevos = await Lead.countDocuments({ status: 'nuevo' });
    const enRevision = await Property.countDocuments({ status: 'revision' });
    const aprobadas = await Property.countDocuments({ status: 'aprobada' });
    const rechazadas = await Property.countDocuments({ status: 'rechazada' });
    const bloqueadas = await Property.countDocuments({ status: 'bloqueada' });
    const pausadas = await Property.countDocuments({ status: 'pausada' });
    const usuariosBasico = await User.countDocuments({ plan: 'basico' });
    const usuariosPremium = await User.countDocuments({ plan: 'premium' });

    // --- Fase 5.3: Gráficas de tendencias (últimos 6 periodos) ---
    // Nota: "periodo" se interpreta como semanas. Esto evita suposiciones sobre el backend existente.
    const now = new Date();
    const periods = 6;
    const MS_WEEK = 7 * 24 * 60 * 60 * 1000;

    const periodStart = (idx) => {
      // idx = 0 => 5 semanas atrás (inicio)
      // idx = 5 => actual (inicio)
      const d = new Date(now.getTime() - (periods - 1 - idx) * MS_WEEK);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const periodEnd = (idx) => {
      const d = new Date(now.getTime() - (periods - 1 - idx) * MS_WEEK);
      d.setHours(0, 0, 0, 0);
      return new Date(d.getTime() + MS_WEEK);
    };

    const labels = Array.from({ length: periods }, (_, i) => `P${i + 1}`);

    const buildSeries = async (model, baseFilter) => {
      // Retorna valores por periodo
      const values = [];
      for (let i = 0; i < periods; i++) {
        const start = periodStart(i);
        const end = periodEnd(i);
        const filter = {
          ...baseFilter,
          createdAt: { $gte: start, $lt: end }
        };
        const count = await model.countDocuments(filter);
        values.push(count);
      }
      return values;
    };

    const propRevValues = await buildSeries(Property, { status: 'revision' });
    const propApValues = await buildSeries(Property, { status: 'aprobada' });
    const propReValues = await buildSeries(Property, { status: 'rechazada' });
    const propBlValues = await buildSeries(Property, { status: 'bloqueada' });

    const leadsValues = await buildSeries(Lead, { status: 'nuevo' });

    res.json({
      ok: true,
      stats: {
        totalUsuarios,
        totalPropiedades,
        totalLeads,
        leadsNuevos,
        enRevision,
        aprobadas,
        rechazadas,
        bloqueadas,
        pausadas,
        usuariosBasico,
        usuariosPremium
      },
      trends: {
        labels,
        propiedadesPorStatus: {
          revision: propRevValues,
          aprobada: propApValues,
          rechazada: propReValues,
          bloqueada: propBlValues
        },
        leadsCapturados: leadsValues
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Creación masiva de usuarios desde Excel/CSV
const crearUsuariosMasivo = async (req, res) => {
  try {
    const archivo = req.files?.archivo?.[0];
    if (!archivo) {
      return res.status(400).json({ error: 'Debes subir un archivo Excel (.xlsx) o CSV' });
    }

    const resultado = {
      успе: [],
      errores: [],
      totalProcesados: 0,
      totalCreados: 0,
      totalErrores: 0
    };

    let filas = [];

    // Procesar según tipo de archivo
    if (archivo.originalname.endsWith('.csv')) {
      // Parsear CSV manualmente
      const contenido = archivo.buffer.toString('utf-8');
      const lineas = contenido.split('\n').map(l => l.trim()).filter(l => l);
      if (lineas.length < 2) {
        return res.status(400).json({ error: 'El CSV está vacío o no tiene datos' });
      }
      const encabezados = lineas[0].split(',').map(h => h.trim().toLowerCase());
      for (let i = 1; i < lineas.length; i++) {
        const valores = lineas[i].split(',').map(v => v.trim());
        const fila = {};
        encabezados.forEach((h, idx) => { fila[h] = valores[idx] || ''; });
        filas.push(fila);
      }
    } else {
      // Excel: usar xlsx (debe estar instalado)
      const XLSX = require('xlsx');
      const workbook = XLSX.read(archivo.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      filas = XLSX.utils.sheet_to_json(sheet);
    }

    resultado.totalProcesados = filas.length;

    // Validar y crear usuarios
    const planesValidos = ['gratuito', 'basico', 'premium'];
    
    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      const email = (fila.email || fila.correo || fila.Email || fila.Correo || '').toString().trim().toLowerCase();
      const nombre = (fila.nombre || fila.Nombre || '').toString().trim();
      const telefono = (fila.telefono || fila.telefono || fila.Telefono || '').toString().trim();
      const plan = (fila.plan || fila.plan || fila.Plan || 'gratuito').toString().toLowerCase().trim();

      const numeroFila = i + 2; // +2 porque Excel empieza en 1 y hay encabezado

      // Validaciones
      if (!email || !email.includes('@')) {
        resultado.errores.push({
          fila: numeroFila,
          email: email || 'no especificado',
          error: 'Email inválido o faltante'
        });
        resultado.totalErrores++;
        continue;
      }

      if (!nombre) {
        resultado.errores.push({
          fila: numeroFila,
          email,
          error: 'Nombre faltante'
        });
        resultado.totalErrores++;
        continue;
      }

      // Verificar si ya existe
      const existe = await User.findOne({ email });
      if (existe) {
        resultado.errores.push({
          fila: numeroFila,
          email,
          error: 'El email ya está registrado'
        });
        resultado.totalErrores++;
        continue;
      }

      // Generar contraseña temporal
      const passwordTemporal = Math.random().toString(36).slice(-8);

      try {
        const nuevoUsuario = await User.create({
          nombre,
          email,
          telefono,
          password: passwordTemporal,
          plan: planesValidos.includes(plan) ? plan : 'gratuito',
          verificado: true, // Por批量 creación, se crean verificados
          status: 'activo'
        });

        resultado.éxito.push({
          fila: numeroFila,
          email,
          nombre,
          passwordTemporal,
          plan: planesValidos.includes(plan) ? plan : 'gratuito'
        });
        resultado.totalCreados++;
      } catch (errorCrear) {
        resultado.errores.push({
          fila: numeroFila,
          email,
          error: errorCrear.message
        });
        resultado.totalErrores++;
      }
    }

    res.json({
      ok: true,
      mensaje: `Procesados ${resultado.totalProcesados}: ${resultado.totalCreados} creados, ${resultado.totalErrores} errores`,
      resultado
    });
  } catch (error) {
    console.error('Error en creación masiva:', error);
    res.status(500).json({ error: 'Error al procesar el archivo: ' + error.message });
  }
};

// Descargar plantilla de usuarios
const descargarPlantillaUsuarios = async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const datos = [
      { nombre: 'Juan Pérez', email: 'juan@ejemplo.com', telefono: '5523456789', plan: 'basico' },
      { nombre: 'María García', email: 'maria@ejemplo.com', telefono: '5512345678', plan: 'premium' }
    ];
    const hoja = XLSX.utils.json_to_sheet(datos);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Usuarios');
    const buffer = XLSX.write(libro, { bookType: 'xlsx', type: 'buffer' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=plantilla_usuarios.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getUsuarios, cambiarPlan, suspenderUsuario, eliminarUsuario, getPropiedadesRevision, getLeads, aprobarPropiedad, rechazarPropiedad, eliminarPropiedad, bloquearPropiedad, dashboard, crearUsuariosMasivo, descargarPlantillaUsuarios };
