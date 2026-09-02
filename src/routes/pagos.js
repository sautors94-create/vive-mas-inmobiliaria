const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const Pago = require('../models/Pago');
const Usuario = require('../models/User');
const Property = require('../models/Property');
const Cupon = require('../models/Cupon');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ==========================================
// WEBHOOK DE STRIPE
// ==========================================
const webhookStripe = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('❌ Error de firma del webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 1. PRIMER PAGO EXITOSO
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.client_reference_id;

    try {
      let usuario = null;

      if (userId) {
        usuario = await Usuario.findById(userId);
      }

      if (!usuario) {
        const email = session.customer_details?.email || session.customer_email;
        if (email) usuario = await Usuario.findOne({ email });
      }

      if (usuario) {
        const pagoExistente = await Pago.findOne({ stripe_session_id: session.id });
        if (!pagoExistente) {
          
          // Determinar periodo según el monto
          // Ajusta estos valores según tus precios reales en Stripe
          const montoCentavos = session.amount_total;
          let dias, periodo;
          if (montoCentavos >= 50000) { // $99 MXN mensual = 9900¢, $999 MXN anual = 99900¢ — 50000¢ ($500) parte la diferencia
            dias = 365;
            periodo = 'anual';
          } else { // ~$99 MXN mensual
            dias = 30;
            periodo = 'mensual';
          }

          const fechaInicio = new Date();
          const fechaExpiracion = new Date(fechaInicio);
          fechaExpiracion.setDate(fechaExpiracion.getDate() + dias);

          const planContratado = 'basico';

          await Pago.create({
            stripe_session_id: session.id,
            usuario_id: usuario._id,
            usuario_email: usuario.email,
            plan_contratado: planContratado,
            monto: montoCentavos / 100,
            estatus: 'completado'
          });

          usuario.plan = planContratado;
          usuario.planFechaFin = fechaExpiracion;
          usuario.planFechaInicio = fechaInicio;
          usuario.planPeriodo = periodo;
          usuario.planCancelado = false;
          usuario.fechaCancelacion = null;
          
          // NOTA: NO activamos cargoRecurrenteAutorizado aquí.
          // La ley exige que sea un acto separado y explícito del usuario.

          const pesoMap = { gratuito: 0, basico: 1, premium: 2 };
          await Property.updateMany(
            { propietario: usuario._id },
            { $set: { planPeso: pesoMap[planContratado] || 0 } }
          );
          
          if (session.subscription) {
            usuario.stripeSubscriptionId = session.subscription;
          }
          await usuario.save();

          console.log(`✅ Plan ${planContratado.toUpperCase()} (${periodo}) activado para: ${usuario.email}. Expira: ${fechaExpiracion.toLocaleDateString('es-MX')}`);
        } else {
          console.log(`ℹ️ Pago duplicado ignorado: ${session.id}`);
        }
      } else {
        console.warn(`⚠️ Webhook: usuario no encontrado. Creando cuenta automática...`);
        const emailPago = session.customer_details?.email || session.customer_email;
        
        if (emailPago) {
          const tempPassword = Math.random().toString(36).slice(-2) + Date.now().toString(36);
          
          const montoCentavos = session.amount_total;
          let dias, periodo;
          if (montoCentavos >= 50000) {
            dias = 365;
            periodo = 'anual';
          } else {
            dias = 30;
            periodo = 'mensual';
          }

          const fechaInicio = new Date();
          const fechaExpiracion = new Date(fechaInicio);
          fechaExpiracion.setDate(fechaExpiracion.getDate() + dias);

          const nuevoUsuario = await Usuario.create({
            email: emailPago,
            password: tempPassword,
            nombre: emailPago.split('@')[0],
            plan: 'basico',
            planFechaInicio: fechaInicio,
            planFechaFin: fechaExpiracion,
            planPeriodo: periodo,
            verificado: true
          });
          
          await Pago.create({
            stripe_session_id: session.id,
            usuario_id: nuevoUsuario._id,
            usuario_email: emailPago,
            plan_contratado: 'basico',
            monto: montoCentavos / 100,
            estatus: 'completado'
          });

          console.log(`🆕 Cuenta nueva creada por pago Stripe: ${emailPago} (${periodo})`);
        }
      }
    } catch (error) {
      console.error('❌ Error al procesar pago:', error);
    }
  }

  // 2. RENOVACIÓN MENSUAL EXITOSA
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object;
    const usuario = await Usuario.findOne({ stripeSubscriptionId: invoice.subscription });
    if (usuario) {
      // Solo renovar si NO está cancelado
      if (!usuario.planCancelado) {
        const nuevaFecha = new Date();
        nuevaFecha.setDate(nuevaFecha.getDate() + 30);
        usuario.planFechaFin = nuevaFecha;
        usuario.plan = 'basico'; // Por si somehow bajaron
        await usuario.save();
        console.log(`🔄 Renovación cobrada. ${usuario.email} activo hasta: ${nuevaFecha.toLocaleDateString('es-MX')}`);
      } else {
        console.log(`⏭️ Renovación recibida pero usuario ${usuario.email} tiene plan cancelado. Ignorando.`);
      }
    }
  }

  // 3. RENOVACIÓN FALLIDA
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    const usuario = await Usuario.findOne({ stripeSubscriptionId: invoice.subscription });
    if (usuario) {
      // Marcar como cancelado pero NO bajar inmediatamente
      // El usuario mantiene acceso hasta planFechaFin
      usuario.planCancelado = true;
      usuario.cargoRecurrenteAutorizado = false;
      usuario.fechaCancelacion = new Date();
      await usuario.save();
      console.log(`❌ Renovación fallida para ${usuario.email}. Plan cancelado, mantiene acceso hasta: ${usuario.planFechaFin?.toLocaleDateString('es-MX')}`);
    }
  }

  // 4. SUSCRIPCIÓN CANCELADA — CORREGIDO
  // Si cancel_at_period_end = true: Stripe envía esto al finalizar el periodo
  // Si cancel_at_period_end = false: Stripe envía esto inmediatamente
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const usuario = await Usuario.findOne({ stripeSubscriptionId: subscription.id });
    if (usuario) {
      // Verificar si ya pasó la fecha de fin
      const ahora = new Date();
      if (usuario.planFechaFin && usuario.planFechaFin > ahora) {
        // Aún le queda tiempo — mantener activo hasta planFechaFin
        usuario.planCancelado = true;
        usuario.stripeSubscriptionId = null;
        usuario.cargoRecurrenteAutorizado = false;
        await usuario.save();
        console.log(`🚫 Suscripción cancelada. ${usuario.email} mantiene plan hasta: ${usuario.planFechaFin.toLocaleDateString('es-MX')}`);
      } else {
        // Ya venció — bajar a gratuito
        usuario.plan = 'gratuito';
        usuario.stripeSubscriptionId = null;
        usuario.planFechaFin = null;
        usuario.planCancelado = false;
        usuario.cargoRecurrenteAutorizado = false;
        await Property.updateMany(
          { propietario: usuario._id },
          { $set: { planPeso: 0 } }
        );
        await usuario.save();
        console.log(`🚫 Suscripción vencida. ${usuario.email} regresado a GRATUITO.`);
      }
    }
  }

  // 5. NUEVO: SUSCRIPCIÓN ACTUALIZADA (cuando se pone cancel_at_period_end)
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    const usuario = await Usuario.findOne({ stripeSubscriptionId: subscription.id });
    if (usuario) {
      // Si se marcó para cancelar al final del periodo
      if (subscription.cancel_at_period_end === true && !usuario.planCancelado) {
        usuario.planCancelado = true;
        await usuario.save();
        console.log(`⏳ Suscripción marcada para cancelar al final del periodo. ${usuario.email} hasta: ${usuario.planFechaFin?.toLocaleDateString('es-MX')}`);
      }
      // Si se reactivó (quitó cancel_at_period_end)
      if (subscription.cancel_at_period_end === false && usuario.planCancelado) {
        usuario.planCancelado = false;
        usuario.fechaCancelacion = null;
        await usuario.save();
        console.log(`🔄 Suscripción reactivada. ${usuario.email}`);
      }
    }
  }

  res.json({ received: true });
};

// ==========================================
// RUTAS DEL PANEL DE ADMIN
// ==========================================
const authMiddlewareAdmin = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

// KPIs para el módulo "Pagos y Conciliación" del panel admin
router.get('/admin/pagos/stats', authMiddlewareAdmin, requireRole('admin'), async (req, res) => {
  try {
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const inicioMes = new Date(inicioHoy); inicioMes.setDate(inicioMes.getDate() - 30);

    const [completados, pendientes, reembolsados, ingresosMes] = await Promise.all([
      Pago.countDocuments({ estatus: 'completado' }),
      Pago.countDocuments({ estatus: 'pendiente' }),
      Pago.countDocuments({ estatus: 'reembolsado' }),
      Pago.aggregate([
        { $match: { estatus: 'completado', createdAt: { $gte: inicioMes } } },
        { $group: { _id: null, total: { $sum: '$monto' } } }
      ])
    ]);

    const tendencia = [];
    for (let i = 6; i >= 0; i--) {
      const inicio = new Date(inicioHoy); inicio.setDate(inicio.getDate() - i);
      const fin = new Date(inicio); fin.setDate(fin.getDate() + 1);
      const agg = await Pago.aggregate([
        { $match: { estatus: 'completado', createdAt: { $gte: inicio, $lt: fin } } },
        { $group: { _id: null, total: { $sum: '$monto' } } }
      ]);
      tendencia.push({ fecha: inicio.toISOString().slice(0, 10), count: agg[0]?.total || 0 });
    }

    res.json({
      ok: true,
      completados,
      pendientes,
      reembolsados,
      ingresosMes: ingresosMes[0]?.total || 0,
      tendencia
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Error al obtener estadísticas de pagos' });
  }
});

// Exportar pagos filtrados a Excel
router.get('/admin/pagos/exportar', authMiddlewareAdmin, requireRole('admin'), async (req, res) => {
  try {
    const { search, plan, estatus } = req.query;
    const filtro = {};
    if (search) filtro.$or = [
      { usuario_email: { $regex: search, $options: 'i' } },
      { stripe_session_id: { $regex: search, $options: 'i' } }
    ];
    if (plan) filtro.plan_contratado = plan;
    if (estatus) filtro.estatus = estatus;

    const pagos = await Pago.find(filtro).sort({ createdAt: -1 });
    if (pagos.length === 0) {
      return res.status(404).json({ error: 'No hay pagos para exportar con esos filtros' });
    }

    const XLSX = require('xlsx');
    const datos = pagos.map(p => ({
      'Fecha': new Date(p.createdAt).toLocaleString('es-MX'),
      'Email': p.usuario_email || '',
      'Plan': p.plan_contratado,
      'Monto': p.monto,
      'Estado': p.estatus,
      'Stripe Session ID': p.stripe_session_id || '',
      'Notas admin': p.notas_admin || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(datos);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pagos');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=pagos-${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/pagos', authMiddlewareAdmin, requireRole('admin'), async (req, res) => {
  try {
    const { search, plan, estatus, page = 1, limit = 20 } = req.query;
    const filtro = {};

    if (search) {
      filtro.$or = [
        { usuario_email: { $regex: search, $options: 'i' } },
        { stripe_session_id: { $regex: search, $options: 'i' } }
      ];
    }
    if (plan) filtro.plan_contratado = plan;
    if (estatus) filtro.estatus = estatus;

    const total = await Pago.countDocuments(filtro);
    const pagos = await Pago.find(filtro)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ ok: true, pagos, total, paginas: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Error al obtener pagos' });
  }
});

router.patch('/admin/pagos/:id', authMiddlewareAdmin, requireRole('admin'), async (req, res) => {
  try {
    const { notas_admin, estatus } = req.body;
    const campos = {};
    if (notas_admin !== undefined) campos.notas_admin = notas_admin;
    if (estatus) campos.estatus = estatus;
    await Pago.findByIdAndUpdate(req.params.id, campos);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Error al actualizar pago' });
  }
});

// ==========================================
// CUPONES
// ==========================================

// Validar un cupón (público, requiere sesión)
// Devuelve si es 'basico_plus' (aplicable gratis) o 'stripe' (con link de pago)
router.post('/cupones/validar', authMiddlewareAdmin, async (req, res) => {
  try {
    const { codigo } = req.body;
    if (!codigo) return res.status(400).json({ error: 'Ingresa un código de cupón' });

    const cupon = await Cupon.findOne({ codigo: codigo.toUpperCase().trim() });
    if (!cupon) return res.status(404).json({ error: 'Cupón no válido' });
    if (!cupon.activo) return res.status(400).json({ error: 'Este cupón ya no está activo' });
    if (cupon.expiraEn && cupon.expiraEn < new Date()) {
      return res.status(400).json({ error: 'Este cupón ha expirado' });
    }
    if (cupon.usosMaximos && cupon.usosActuales >= cupon.usosMaximos) {
      return res.status(400).json({ error: 'Este cupón ha alcanzado su límite de usos' });
    }

    res.json({
      ok: true,
      cupon: {
        codigo: cupon.codigo,
        tipo: cupon.tipo,
        descripcion: cupon.descripcion,
        dias: cupon.dias,
        expiraEn: cupon.expiraEn,
        stripe_price_link: cupon.stripe_price_link
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Canjear un cupón de tipo 'basico_plus': aplica cuenta Básico Plus (role=basico_plus)
// por N días SIN pago. Solo para el cupón SOMOSASESORES y similares.
router.post('/cupones/canjear', authMiddlewareAdmin, async (req, res) => {
  try {
    const { codigo } = req.body;
    if (!codigo) return res.status(400).json({ error: 'Ingresa un código de cupón' });

    const cupon = await Cupon.findOne({ codigo: codigo.toUpperCase().trim() });
    if (!cupon) return res.status(404).json({ error: 'Cupón no válido' });
    if (!cupon.activo) return res.status(400).json({ error: 'Este cupón ya no está activo' });
    if (cupon.expiraEn && cupon.expiraEn < new Date()) {
      return res.status(400).json({ error: 'Este cupón ha expirado' });
    }
    if (cupon.usosMaximos && cupon.usosActuales >= cupon.usosMaximos) {
      return res.status(400).json({ error: 'Este cupón ha alcanzado su límite de usos' });
    }

    // Solo cupones 'basico_plus' se pueden canjear sin pago
    if (cupon.tipo !== 'basico_plus') {
      return res.status(400).json({
        error: 'Este cupón requiere pago en Stripe',
        requierePago: true,
        stripe_price_link: cupon.stripe_price_link
      });
    }

    const usuario = await Usuario.findById(req.user.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Evitar reutilizar el mismo cupón por el mismo usuario (una sola vez)
    if (usuario.cuponUsado === cupon.codigo) {
      return res.status(400).json({ error: 'Ya utilizaste este cupón' });
    }

    const dias = cupon.dias || 360;
    const fechaInicio = new Date();
    const fechaFin = new Date(fechaInicio);
    fechaFin.setDate(fechaFin.getDate() + dias);

    // Aplicar cuenta Básico Plus (plan gratuito + rol basico_plus = ilimitado)
    usuario.plan = 'gratuito';
    usuario.role = 'basico_plus';
    usuario.planFechaInicio = fechaInicio;
    usuario.planFechaFin = fechaFin;
    usuario.planPeriodo = 'anual';
    usuario.planCancelado = false;
    usuario.fechaCancelacion = null;
    usuario.cuponUsado = cupon.codigo;
    usuario.cupon = { codigo: cupon.codigo, tipo: 'basico_plus', aplicadoEn: fechaInicio, expira: fechaFin };
    await usuario.save();

    // Actualizar peso de sus propiedades (basico_plus = 3, prioridad máxima)
    await Property.updateMany(
      { propietario: usuario._id },
      { $set: { planPeso: 3 } }
    );

    // Registrar un "pago" simbólico (monto 0) para conciliación
    await Pago.create({
      stripe_session_id: `cupon-${cupon.codigo}-${usuario._id}-${Date.now()}`,
      usuario_id: usuario._id,
      usuario_email: usuario.email,
      plan_contratado: 'basico_plus',
      monto: 0,
      estatus: 'completado',
      cupon: cupon.codigo,
      cupon_tipo: 'basico_plus',
      notas_admin: `Activación Básico Plus por cupón ${cupon.codigo} (${dias} días)`
    });

    // Incrementar contador de usos
    cupon.usosActuales += 1;
    await cupon.save();

    res.json({
      ok: true,
      mensaje: `🎉 Cupón aplicado. Tu cuenta ahora es Básico Plus y expira el ${fechaFin.toLocaleDateString('es-MX')}.`,
      plan: 'basico_plus',
      expira: fechaFin,
      usuario
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// ADMIN: GESTIÓN DE CUPONES
// ==========================================

// Listar/crear/actualizar/eliminar cupones (solo admin)
router.get('/admin/cupones', authMiddlewareAdmin, requireRole('admin'), async (req, res) => {
  try {
    const cupones = await Cupon.find().sort({ createdAt: -1 }).populate('creadoPor', 'nombre email');
    res.json({ ok: true, total: cupones.length, cupones });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/cupones/stats', authMiddlewareAdmin, requireRole('admin'), async (req, res) => {
  try {
    const [total, activos, basico_plus, stripe, usosTotales] = await Promise.all([
      Cupon.countDocuments(),
      Cupon.countDocuments({ activo: true }),
      Cupon.countDocuments({ tipo: 'basico_plus' }),
      Cupon.countDocuments({ tipo: 'stripe' }),
      Cupon.aggregate([{ $group: { _id: null, total: { $sum: '$usosActuales' } } }])
    ]);
    res.json({ ok: true, total, activos, basico_plus, stripe, usosTotales: usosTotales[0]?.total || 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/cupones', authMiddlewareAdmin, requireRole('admin'), async (req, res) => {
  try {
    const { codigo, tipo, descripcion, dias, stripe_coupon_id, stripe_price_link, expiraEn, usosMaximos, activo } = req.body;
    if (!codigo) return res.status(400).json({ error: 'El código es obligatorio' });
    if (!['basico_plus', 'stripe'].includes(tipo)) return res.status(400).json({ error: 'Tipo no válido' });

    const existe = await Cupon.findOne({ codigo: codigo.toUpperCase().trim() });
    if (existe) return res.status(400).json({ error: 'Ya existe un cupón con ese código' });

    const cupon = await Cupon.create({
      codigo: codigo.toUpperCase().trim(),
      tipo,
      descripcion: descripcion || '',
      dias: tipo === 'basico_plus' ? (Number(dias) || 360) : 0,
      stripe_coupon_id: tipo === 'stripe' ? (stripe_coupon_id || null) : null,
      stripe_price_link: tipo === 'stripe' ? (stripe_price_link || null) : null,
      expiraEn: expiraEn ? new Date(expiraEn) : null,
      usosMaximos: usosMaximos ? Number(usosMaximos) : null,
      activo: activo !== false,
      creadoPor: req.user.id
    });

    res.status(201).json({ ok: true, cupon });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Carga (o actualiza) los 5 Payment Links reales del Plan Básico como
// registros de Cupon, de un solo clic desde el panel — sin necesitar
// terminal ni scripts sueltos (que en Hostinger compartido pueden toparse
// con el límite de procesos/fork). Es seguro darle clic más de una vez:
// si el código ya existe, solo actualiza sus datos (no duplica).
router.post('/admin/cupones/seed-planes-iniciales', authMiddlewareAdmin, requireRole('admin'), async (req, res) => {
  try {
    const LINKS = [
      {
        codigo: 'PLAN-1MES-GRATIS',
        descripcion: 'PLAN BASICO VIVE MAS 1 MES GRATIS — Prueba de 30 días (luego MXN 99.00/mes)',
        stripe_price_link: 'https://buy.stripe.com/14AfZic36fSf6jYcnE2Ji04',
        createdAt: new Date('2026-08-07T06:06:00-06:00'),
      },
      {
        codigo: 'PLAN-15-ANUAL',
        descripcion: 'Plan Básico 15% Anual — MXN 849.00',
        stripe_price_link: 'https://buy.stripe.com/3cI5kEc36bBZ37MfzQ2Ji03',
        createdAt: new Date('2026-08-07T05:25:00-06:00'),
      },
      {
        codigo: 'PLAN-10-ANUAL',
        descripcion: 'Plan Básico 10% Anual — MXN 899.00',
        stripe_price_link: 'https://buy.stripe.com/00wfZic36fSffUycnE2Ji02',
        createdAt: new Date('2026-08-07T05:23:00-06:00'),
      },
      {
        codigo: 'PLAN-ANUAL-999',
        descripcion: 'Plan Básico Anual ($999) — MXN 999.00',
        stripe_price_link: 'https://buy.stripe.com/14AaEYaZ20Xl0ZEcnE2Ji01',
        createdAt: new Date('2026-08-06T09:18:00-06:00'),
      },
      {
        codigo: 'PLAN-MENSUAL-99',
        descripcion: 'PLAN BASICO VIVE MAS — MXN 99.00/mes',
        stripe_price_link: 'https://buy.stripe.com/3cIeVeebe5dBfUyevM2Ji00',
        createdAt: new Date('2026-08-06T09:18:00-06:00'),
      },
    ];

    const resultado = { creados: [], actualizados: [] };

    for (const link of LINKS) {
      const existente = await Cupon.findOne({ codigo: link.codigo });
      if (existente) {
        existente.descripcion = link.descripcion;
        existente.stripe_price_link = link.stripe_price_link;
        existente.tipo = 'stripe';
        existente.activo = true;
        await existente.save();
        resultado.actualizados.push(link.codigo);
      } else {
        await Cupon.create({
          codigo: link.codigo,
          tipo: 'stripe',
          descripcion: link.descripcion,
          stripe_price_link: link.stripe_price_link,
          activo: true,
          createdAt: link.createdAt,
          creadoPor: req.user.id,
        });
        resultado.creados.push(link.codigo);
      }
    }

    res.json({ ok: true, mensaje: `${resultado.creados.length} creados, ${resultado.actualizados.length} actualizados`, resultado });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/admin/cupones/:id', authMiddlewareAdmin, requireRole('admin'), async (req, res) => {
  try {
    const { descripcion, dias, stripe_coupon_id, stripe_price_link, expiraEn, usosMaximos, activo } = req.body;
    const campos = {};
    if (descripcion !== undefined) campos.descripcion = descripcion;
    if (dias !== undefined) campos.dias = Number(dias);
    if (stripe_coupon_id !== undefined) campos.stripe_coupon_id = stripe_coupon_id;
    if (stripe_price_link !== undefined) campos.stripe_price_link = stripe_price_link;
    if (expiraEn !== undefined) campos.expiraEn = expiraEn ? new Date(expiraEn) : null;
    if (usosMaximos !== undefined) campos.usosMaximos = usosMaximos ? Number(usosMaximos) : null;
    if (activo !== undefined) campos.activo = !!activo;

    const cupon = await Cupon.findByIdAndUpdate(req.params.id, campos, { new: true });
    if (!cupon) return res.status(404).json({ error: 'Cupón no encontrado' });
    res.json({ ok: true, cupon });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/admin/cupones/:id', authMiddlewareAdmin, requireRole('admin'), async (req, res) => {
  try {
    const cupon = await Cupon.findByIdAndDelete(req.params.id);
    if (!cupon) return res.status(404).json({ error: 'Cupón no encontrado' });
    res.json({ ok: true, mensaje: 'Cupón eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// EXPORTS
// ==========================================
module.exports = router;
module.exports.webhookStripe = webhookStripe;