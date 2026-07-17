const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const Pago = require('../models/Pago');
const Usuario = require('../models/User');
const Property = require('../models/Property');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ==========================================
// WEBHOOK DE STRIPE
// Registrado en app.js con express.raw() ANTES de express.json()
// Se exporta como función separada para poder usarla directamente
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

      // Buscar por ID de usuario (enviado como client_reference_id)
      if (userId) {
        usuario = await Usuario.findById(userId);
      }

      // Fallback: buscar por email si no se encontró por ID
      if (!usuario) {
        const email = session.customer_details?.email || session.customer_email;
        if (email) usuario = await Usuario.findOne({ email });
      }

      if (usuario) {
        // Evitar duplicados por si Stripe reenvía el evento
        const pagoExistente = await Pago.findOne({ stripe_session_id: session.id });
        if (!pagoExistente) {
          const fechaExpiracion = new Date();
          fechaExpiracion.setDate(fechaExpiracion.getDate() + 30);

          // Determinar qué plan se contrató según el precio
          const planContratado = 'basico';

          await Pago.create({
            stripe_session_id: session.id,
            usuario_id: usuario._id,
            usuario_email: usuario.email,
            plan_contratado: planContratado,
            monto: session.amount_total / 100,
            estatus: 'completado'
          });

          usuario.plan = planContratado;
          usuario.planFechaFin = fechaExpiracion;
          
          // Actualizar peso de todas sus propiedades existentes
          const pesoMap = { gratuito: 0, basico: 1, premium: 2 };
          await Property.updateMany(
            { propietario: usuario._id },
            { $set: { planPeso: pesoMap[planContratado] || 0 } }
          );
          
          if (session.subscription) {
            usuario.stripeSubscriptionId = session.subscription;
          }
          await usuario.save();

          console.log(`✅ Plan ${planContratado.toUpperCase()} activado para: ${usuario.email}. Expira: ${fechaExpiracion.toLocaleDateString('es-MX')}`);
        } else {
          console.log(`ℹ️ Pago duplicado ignorado: ${session.id}`);
        }
      } else {
        // ==========================================
        // ✅ NUEVO: CREAR CUENTA SI PAGÓ SIN REGISTRARSE
        // ==========================================
        console.warn(`⚠️ Webhook: usuario no encontrado. Creando cuenta automática...`);
        const emailPago = session.customer_details?.email || session.customer_email;
        
        if (emailPago) {
          // Crear cuenta temporal con contraseña aleatoria segura
          const tempPassword = Math.random().toString(36).slice(-2) + Date.now().toString(36);
          
          const nuevoUsuario = await Usuario.create({
            email: emailPago,
            password: tempPassword,
            nombre: emailPago.split('@')[0],
            plan: 'basico',
            verificado: true // Stripe ya validó su método de pago
          });
          
          // Registrar el pago en la BD
          await Pago.create({
            stripe_session_id: session.id,
            usuario_id: nuevoUsuario._id,
            usuario_email: emailPago,
            plan_contratado: 'basico',
            monto: session.amount_total / 100,
            estatus: 'completado'
          });

          console.log(`🆕 Cuenta nueva creada por pago Stripe: ${emailPago}`);
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
      const nuevaFecha = new Date();
      nuevaFecha.setDate(nuevaFecha.getDate() + 30);
      usuario.planFechaFin = nuevaFecha;
      await usuario.save();
      console.log(`🔄 Renovación cobrada. ${usuario.email} activo hasta: ${nuevaFecha.toLocaleDateString('es-MX')}`);
    }
  }

  // 3. RENOVACIÓN FALLIDA — tarjeta vencida, fondos insuficientes, etc.
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    const usuario = await Usuario.findOne({ stripeSubscriptionId: invoice.subscription });
    if (usuario) {
      usuario.plan = 'gratuito';
      usuario.stripeSubscriptionId = null;
      usuario.planFechaFin = null;
      // Bajar el peso de sus propiedades a 0
      await Property.updateMany(
        { propietario: usuario._id },
        { $set: { planPeso: 0 } }
      );
      await usuario.save();
      console.log(`❌ Renovación fallida. ${usuario.email} regresado a GRATUITO.`);
    }
  }

  // 4. SUSCRIPCIÓN CANCELADA (cliente cancela desde portal de Stripe)
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const usuario = await Usuario.findOne({ stripeSubscriptionId: subscription.id });
    if (usuario) {
      usuario.plan = 'gratuito';
      usuario.stripeSubscriptionId = null;
      usuario.planFechaFin = null;
      // Bajar el peso de sus propiedades a 0
      await Property.updateMany(
        { propietario: usuario._id },
        { $set: { planPeso: 0 } }
      );
      await usuario.save();
      console.log(`🚫 Suscripción cancelada. ${usuario.email} regresado a GRATUITO.`);
    }
  }

  res.json({ received: true });
};

// ==========================================
// RUTAS DEL PANEL DE ADMIN — /api/admin/pagos
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