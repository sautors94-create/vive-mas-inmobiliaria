// Ejemplo conceptual para Node.js / Express
router.post('/webhooks/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  // 1. VERIFICAR SEGURIDAD (Crucial)
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, TU_WEBHOOK_SECRET_DE_STRIPE);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 2. SI EL PAGO FUE EXITOSO
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Buscar el usuario por el email con el que pagó en Stripe
    const usuario = await Usuario.findOne({ email: session.customer_email });
    
    if (usuario) {
      // Guardar en el historial de pagos
      await Pagos.create({
        stripe_session_id: session.id,
        usuario_id: usuario._id,
        usuario_email: usuario.email,
        plan_contratado: session.metadata?.plan || 'basico', // O extraer de tu lógica
        monto: session.amount_total / 100, // Stripe envía centavos
        estatus: 'completado'
      });

      // Actualizar el plan del usuario
      await Usuario.findByIdAndUpdate(usuario._id, { plan: 'basico' });
    }
  }

  res.json({ received: true });
});