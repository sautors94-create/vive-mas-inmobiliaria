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
    const { status, search, servicio, tipo } = req.query;
    const filtro = {};
    if (status) filtro.status = status;
    if (tipo) filtro.tipo = tipo;
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
  const Message = require('../models/Message');
  const propiedad = await Property.findById(propiedadId).populate('propietario', 'nombre notificaciones');
  if (!propiedad) throw new Error('Propiedad no encontrada');

  const remitenteId = req.user.id;
  const destinatarioId = propiedad.propietario._id;

  if (destinatarioId.toString() === remitenteId.toString()) {
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

    if (propiedad.propietario._id.toString() === req.user.id) {
      return res.status(403).json({ 
        error: 'No puedes aprobar tus propias propiedades. Otro administrador debe revisarla.',
        esPropiaPropiedad: true
      });
    }

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

    const now = new Date();
    const periods = 6;
    const MS_WEEK = 7 * 24 * 60 * 60 * 1000;

    const periodStart = (idx) => {
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

// =============================================
// CREACIÓN MASIVA DE USUARIOS (CORREGIDA)
// =============================================
const crearUsuariosMasivo = async (req, res) => {
  try {
    const archivo = req.file;
    if (!archivo) {
      return res.status(400).json({ error: 'Debes subir un archivo Excel (.xlsx) o CSV' });
    }

    // Opciones del frontend
    const planForzar = req.body.planForzar || '';
    const forzarDuplicados = req.body.forzarDuplicados === 'true';
    const planesValidos = ['gratuito', 'basico', 'premium'];

    const resultado = {
      exito: [],
      errores: [],
      totalProcesados: 0,
      totalCreados: 0,
      totalErrores: 0
    };

    let filas = [];

    // Procesar según tipo de archivo
    if (archivo.originalname.endsWith('.csv')) {
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
      const XLSX = require('xlsx');
      const workbook = XLSX.read(archivo.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      filas = XLSX.utils.sheet_to_json(sheet);
    }

    resultado.totalProcesados = filas.length;

    // Nombres usados EN ESTA importación para evitar duplicados internos
    const nombresUsadosEnImportacion = new Set();

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      let email = (fila.email || fila.correo || fila.Email || fila.Correo || '').toString().trim().toLowerCase();
      let nombre = (fila.nombre || fila.Nombre || '').toString().trim();
      const telefono = (fila.telefono || fila.Telefono || '').toString().trim();
      
      // Plan: usar el forzado si viene, si no el del archivo, si no gratuito
      let plan = planForzar && planesValidos.includes(planForzar)
        ? planForzar
        : (fila.plan || fila.Plan || 'gratuito').toString().toLowerCase().trim();
      if (!planesValidos.includes(plan)) plan = 'gratuito';

      const numeroFila = i + 2;

      // Validar email (esto SÍ es obligatorio)
      if (!email || !email.includes('@')) {
        resultado.errores.push({
          fila: numeroFila,
          email: email || 'no especificado',
          error: 'Email inválido o faltante'
        });
        resultado.totalErrores++;
        continue;
      }

      // Si no hay nombre, generarlo del email
      if (!nombre) {
        const parte = email.split('@')[0];
        nombre = parte.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]/g, ' ') || 'usuario';
        nombre = nombre.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }

      // Verificar si el email ya existe en la BD
      const existeEmail = await User.findOne({ email });
      if (existeEmail && !forzarDuplicados) {
        resultado.errores.push({
          fila: numeroFila,
          email,
          error: 'El email ya está registrado (activa "Permitir duplicados")'
        });
        resultado.totalErrores++;
        continue;
      }

      // Si el email existe Y se permite duplicado, o si el nombre ya existe,
      // generar un nombre único
      const nombreYaExiste = await User.findOne({ nombre }) || nombresUsadosEnImportacion.has(nombre);
      if (nombreYaExiste || existeEmail) {
        let baseNombre = nombre;
        let contador = 1;
        let nombreUnico = `${baseNombre} ${contador}`;
        
        while (
          await User.findOne({ nombre: nombreUnico }) || 
          nombresUsadosEnImportacion.has(nombreUnico)
        ) {
          contador++;
          nombreUnico = `${baseNombre} ${contador}`;
        }
        nombre = nombreUnico;
      }

      nombresUsadosEnImportacion.add(nombre);

      // Generar contraseña temporal
      const passwordTemporal = Math.random().toString(36).slice(-8);

      try {
        await User.create({
          nombre,
          email,
          telefono,
          password: passwordTemporal,
          plan,
          verificado: true,
          status: 'activo'
        });

        resultado.exito.push({
          fila: numeroFila,
          email,
          nombre,
          passwordTemporal,
          plan
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

// ==========================================
// VISTA PREVIA DE PROPIEDAD (modal catálogo)
// ==========================================
const verPropiedadAdmin = async (req, res) => {
  try {
    const propiedad = await Property.findById(req.params.id)
      .populate('propietario', 'nombre email telefono plan role verificado');

    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });

    const Message = require('../models/Message');
    const totalMensajes = await Message.countDocuments({ propiedad: req.params.id });

    const leadsRelacionados = await Lead.find({
      $or: [
        { propiedadId: req.params.id },
        { 'datosPropiedad.propiedadId': req.params.id }
      ]
    }).sort({ createdAt: -1 }).limit(10);

    res.json({
      ok: true,
      propiedad,
      totalMensajes,
      leadsRelacionados
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// USUARIOS VETADOS
// ==========================================
const BannedUser = require('../models/BannedUser');

const getUsuariosVetados = async (req, res) => {
  try {
    const { search, activo } = req.query;
    const filtro = {};
    if (activo === 'true') filtro.activo = true;
    if (activo === 'false') filtro.activo = false;
    if (search) {
      filtro.$or = [
        { razon: { $regex: search, $options: 'i' } },
        { detalles: { $regex: search, $options: 'i' } }
      ];
    }

    const vetados = await BannedUser.find(filtro)
      .populate('usuario', 'nombre email telefono plan status createdAt')
      .populate('admin', 'nombre email')
      .populate('aliases.usuarioId', 'nombre email telefono plan status createdAt')
      .sort({ createdAt: -1 });

    res.json({ ok: true, total: vetados.length, vetados });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const vetarUsuario = async (req, res) => {
  try {
    const { razon, detalles, aliasIds } = req.body;
    if (!razon) return res.status(400).json({ error: 'La razón del vetado es obligatoria' });

    const usuario = await User.findById(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (usuario.role === 'admin') return res.status(403).json({ error: 'No puedes vetar a un administrador' });

    const yaVetado = await BannedUser.findOne({ usuario: req.params.id, activo: true });
    if (yaVetado) return res.status(400).json({ error: 'El usuario ya está vetado' });

    usuario.status = 'suspendido';
    await usuario.save();

    const aliases = [];
    if (aliasIds && Array.isArray(aliasIds)) {
      for (const aliasId of aliasIds) {
        const aliasUser = await User.findById(aliasId);
        if (aliasUser) {
          aliasUser.status = 'suspendido';
          await aliasUser.save();
          aliases.push({
            usuarioId: aliasId,
            email: aliasUser.email,
            telefono: aliasUser.telefono
          });
        }
      }
    }

    const vetado = await BannedUser.create({
      usuario: req.params.id,
      aliases,
      razon,
      detalles: detalles || '',
      admin: req.user.id
    });

    await vetado.populate('usuario', 'nombre email telefono');
    await vetado.populate('admin', 'nombre email');
    await vetado.populate('aliases.usuarioId', 'nombre email telefono');

    res.json({ ok: true, mensaje: 'Usuario vetado correctamente', vetado });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const desvetarUsuario = async (req, res) => {
  try {
    const vetado = await BannedUser.findOne({ usuario: req.params.id, activo: true });
    if (!vetado) return res.status(404).json({ error: 'El usuario no está vetado' });

    await User.findByIdAndUpdate(req.params.id, { status: 'activo' });

    if (vetado.aliases && vetado.aliases.length > 0) {
      for (const alias of vetado.aliases) {
        if (alias.usuarioId) {
          await User.findByIdAndUpdate(alias.usuarioId, { status: 'activo' });
        }
      }
    }

    vetado.activo = false;
    await vetado.save();

    res.json({ ok: true, mensaje: 'Usuario desvetado, cuenta reactivada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const vincularAlias = async (req, res) => {
  try {
    const { aliasId } = req.body;
    if (!aliasId) return res.status(400).json({ error: 'ID del alias requerido' });

    const vetado = await BannedUser.findOne({ usuario: req.params.id, activo: true });
    if (!vetado) return res.status(404).json({ error: 'Vetado no encontrado' });

    if (aliasId === req.params.id) {
      return res.status(400).json({ error: 'No puedes vincular el mismo usuario' });
    }

    const yaVinculado = vetado.aliases.some(a => a.usuarioId?.toString() === aliasId);
    if (yaVinculado) return res.status(400).json({ error: 'Este alias ya está vinculado' });

    const aliasUser = await User.findById(aliasId);
    if (!aliasUser) return res.status(404).json({ error: 'Usuario alias no encontrado' });

    aliasUser.status = 'suspendido';
    await aliasUser.save();

    vetado.aliases.push({
      usuarioId: aliasId,
      email: aliasUser.email,
      telefono: aliasUser.telefono
    });
    await vetado.save();

    await vetado.populate('aliases.usuarioId', 'nombre email telefono');

    res.json({ ok: true, mensaje: 'Alias vinculado y suspendido', vetado });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const desvincularAlias = async (req, res) => {
  try {
    const { aliasId } = req.params;
    const vetado = await BannedUser.findOne({ usuario: req.body.vetadoId, activo: true });
    if (!vetado) return res.status(404).json({ error: 'Vetado no encontrado' });

    const alias = vetado.aliases.find(a => a.usuarioId?.toString() === aliasId);
    if (!alias) return res.status(404).json({ error: 'Alias no encontrado en este vetado' });

    await User.findByIdAndUpdate(aliasId, { status: 'activo' });

    vetado.aliases = vetado.aliases.filter(a => a.usuarioId?.toString() !== aliasId);
    await vetado.save();

    res.json({ ok: true, mensaje: 'Alias desvinculado y reactivado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const buscarAliases = async (req, res) => {
  try {
    const usuario = await User.findById(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    const candidatos = [];
    const filtroBase = { _id: { $ne: req.params.id } };

    if (usuario.telefono) {
      const porTelefono = await User.find({
        ...filtroBase,
        telefono: usuario.telefono
      }).select('nombre email telefono plan status createdAt');
      porTelefono.forEach(u => {
        if (!candidatos.find(c => c._id.toString() === u._id.toString())) {
          candidatos.push({ ...u.toObject(), matchRazon: 'Mismo teléfono' });
        }
      });
    }

    if (usuario.nombre) {
      const partes = usuario.nombre.trim().split(/\s+/).slice(0, 2).join(' ');
      if (partes.length >= 2) {
        const porNombre = await User.find({
          ...filtroBase,
          nombre: { $regex: partes, $options: 'i' }
        }).select('nombre email telefono plan status createdAt');
        porNombre.forEach(u => {
          if (!candidatos.find(c => c._id.toString() === u._id.toString())) {
            candidatos.push({ ...u.toObject(), matchRazon: 'Nombre similar' });
          }
        });
      }
    }

    if (usuario.email && usuario.email.includes('@')) {
      const dominio = usuario.email.split('@')[1];
      if (dominio && dominio !== 'gmail.com' && dominio !== 'hotmail.com' && dominio !== 'yahoo.com') {
        const porDominio = await User.find({
          ...filtroBase,
          email: { $regex: `@${dominio}$`, $options: 'i' }
        }).select('nombre email telefono plan status createdAt');
        porDominio.forEach(u => {
          if (!candidatos.find(c => c._id.toString() === u._id.toString())) {
            candidatos.push({ ...u.toObject(), matchRazon: `Mismo dominio: @${dominio}` });
          }
        });
      }
    }

    const vetadoActual = await BannedUser.findOne({ usuario: req.params.id, activo: true });
    const aliasIds = vetadoActual?.aliases?.map(a => a.usuarioId?.toString()) || [];
    const candidatosFinales = candidatos.filter(c => !aliasIds.includes(c._id.toString()));

    res.json({ ok: true, candidatos: candidatosFinales, total: candidatosFinales.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { 
  getUsuarios, 
  cambiarPlan, 
  suspenderUsuario, 
  eliminarUsuario, 
  getPropiedadesRevision, 
  getLeads, 
  aprobarPropiedad, 
  rechazarPropiedad, 
  eliminarPropiedad, 
  bloquearPropiedad, 
  dashboard, 
  crearUsuariosMasivo, 
  descargarPlantillaUsuarios,
  verPropiedadAdmin,
  getUsuariosVetados,
  vetarUsuario,
  desvetarUsuario,
  vincularAlias,
  desvincularAlias,
  buscarAliases
};