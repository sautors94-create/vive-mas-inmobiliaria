const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const Pago = require('../models/Pago');
const Usuario = require('../models/User');
const Property = require('../models/Property');

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
          if (montoCentavos >= 900) { // ~$999 MXN anual
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
          if (montoCentavos >= 900) {
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
// EXPORTS
// ==========================================
module.exports = router;
module.exports.webhookStripe = webhookStripe;