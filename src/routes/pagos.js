const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const Pago = require('../models/Pago'); 
const Usuario = require('../models/User'); 

const stripe = Stripe(process.env.STRIPE_SECRET_KEY); 

// ==========================================
// 1. WEBHOOK DE STRIPE
// ==========================================
router.post('/webhooks/stripe', async (req, res) => {
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
      } else {
        const email = session.customer_details?.email || session.customer_email;
        if (email) usuario = await Usuario.findOne({ email: email });
      }

      if (usuario) {
        // Evitar duplicados por si Stripe reenvía el evento
        const pagoExistente = await Pago.findOne({ stripe_session_id: session.id });
        if (!pagoExistente) {
          // Calcular fecha de expiración (30 días a partir de ahora)
          const fechaExpiracion = new Date();
          fechaExpiracion.setDate(fechaExpiracion.getDate() + 30);

          // Guardar comprobante
          await Pago.create({
            stripe_session_id: session.id,
            usuario_id: usuario._id,
            usuario_email: usuario.email,
            plan_contratado: 'basico', 
            monto: session.amount_total / 100,
            estatus: 'completado'
          });

          // Actualizar usuario
          usuario.plan = 'basico';
          usuario.planFechaFin = fechaExpiracion; // Guardamos cuándo se acaba
          if (session.subscription) {
            usuario.stripeSubscriptionId = session.subscription; // ID para cancelaciones futuras
          }
          await usuario.save();

          console.log(`✅ Pago aprobado y plan BASICO activado para: ${usuario.email}. Expira: ${fechaExpiracion}`);
        }
      } else {
        console.warn(`⚠️ Pago recibido pero no se encontró al usuario.`);
      }
    } catch (error) {
      console.error('Error al procesar el pago:', error);
    }
  }

  // 2. RENOVACIÓN MENSUAL EXITOSA (Cobra la tarjeta automáticamente al mes)
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object;
    // Aquí podrías agregar lógica si quisieras registrar cada mes, 
    // pero como es recurrente, Stripe ya mantiene la suscripción activa.
    console.log(`🔄 Renovación mensual cobrada para la suscripción: ${invoice.subscription}`);
  }

  // 3. RENOVACIÓN FALLIDA (Se le venció la tarjeta al usuario)
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    const usuario = await Usuario.findOne({ stripeSubscriptionId: invoice.subscription });
    
    if (usuario) {
      usuario.plan = 'gratuito'; // Lo regresamos a gratuito
      usuario.stripeSubscriptionId = null; // Limpiamos la suscripción de Stripe
      await usuario.save();
      console.log(`❌ Renovación fallida. Usuario ${usuario.email} regresado a GRATUITO.`);
    }
  }

  res.json({ received: true });
});


// ==========================================
// 2. RUTAS PARA EL PANEL DE ADMIN
// ==========================================
const esAdmin = (req, res, next) => {
  // TODO: Tu lógica de admin
  next(); 
};

router.get('/admin/pagos', esAdmin, async (req, res) => {
  try {
    const { search, plan, estatus } = req.query;
    let filtro = {};
    if (search) {
      filtro.$or = [
        { usuario_email: { $regex: search, $options: 'i' } },
        { stripe_session_id: { $regex: search, $options: 'i' } }
      ];
    }
    if (plan) filtro.plan_contratado = plan;
    if (estatus) filtro.estatus = estatus;

    const pagos = await Pago.find(filtro).sort({ createdAt: -1 });
    res.json({ ok: true, pagos });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Error al obtener pagos' });
  }
});

router.patch('/admin/pagos/:id', esAdmin, async (req, res) => {
  try {
    const { notas_admin } = req.body;
    await Pago.findByIdAndUpdate(req.params.id, { notas_admin });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Error al guardar nota' });
  }
});

module.exports = router;    