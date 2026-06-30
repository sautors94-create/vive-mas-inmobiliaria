const Groq = require('groq-sdk');
const Lead = require('../models/Lead');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SISTEMA_SOPORTE = `Eres Vivi, asistente de soporte de Vive Más Inmobiliaria.

REGLAS ESTRICTAS:
- Responde en máximo 2 oraciones cortas
- Una idea por mensaje
- Si necesitas más info, haz UNA sola pregunta
- Sin listas largas ni párrafos
- Directo al punto
- En español siempre

TEMAS QUE MANEJAS:
- Login y contraseñas
- Planes: Gratuito, Básico $299/mes, Premium $799/mes
- Verificación de cuenta (email o SMS)
- Publicar propiedades (van a revisión 24-48hrs)
- Favoritos y mensajes
- Problemas técnicos

Si no puedes ayudar: "Escríbenos a soporte@vivemas.mx 📧"
Cuando el problema esté resuelto pregunta: "¿Hay algo más en que pueda ayudarte? 😊"
Si el usuario dice no/gracias/listo, despídete con: "¡Hasta pronto! 👋"`;

const SISTEMA_SERVICIOS = `Eres Max, asesor de servicios de Vive Más Inmobiliaria.

REGLAS ESTRICTAS:
- Responde en máximo 2 oraciones cortas
- Haz UNA pregunta a la vez para entender la necesidad
- Sondeo en este orden:
  1. ¿Qué tipo de servicio necesita? (renta/venta/administración/mantenimiento)
  2. ¿En qué ciudad o estado?
  3. ¿Es para uso personal o inversión?
  4. ¿Cuál es su presupuesto aproximado?
  5. Pedir nombre y teléfono para contacto
- Respuestas breves y amigables
- En español siempre
- Un emoji máximo por mensaje

SERVICIOS:
- Renta y venta de propiedades
- Administración de edificios y condominios
- Pago de servicios (luz, agua, predial)
- Mantenimiento y reparaciones
- Plan Premium: fotos profesionales + gestoría

Cuando captures todos los datos di: "¡Listo! Un asesor te contactará pronto. ¿Necesitas algo más? 😊"
Si el usuario dice no/gracias/listo, despídete con: "¡Hasta pronto! 👋"`;

const chatSoporte = async (req, res) => {
  try {
    const { mensaje, historial = [] } = req.body;
    if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

    const messages = [
      { role: 'system', content: SISTEMA_SOPORTE },
      ...historial
        .filter(h => h.role === 'user' || h.role === 'assistant')
        .slice(-10)
        .map(h => ({ role: h.role, content: h.text || h.content })),
      { role: 'user', content: mensaje }
    ];

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: 150,
      temperature: 0.7
    });

    const respuesta = completion.choices[0]?.message?.content || 'Lo siento, no pude procesar tu mensaje.';
    res.json({ ok: true, respuesta, tipo: 'soporte' });
  } catch (error) {
    console.error('Error chatbot soporte:', error.message);
    res.status(500).json({ error: 'Error al procesar el mensaje' });
  }
};

// Detectar intención fuera de tema o que necesita atención humana
const detectarIntention = (mensaje, tipo) => {
  const msg = mensaje.toLowerCase();
  
  // Palabras que indican querer hablar con persona real
  const quierePersona = [
    'hablar con alguien', 'hablar con una persona', 'hablar con asesor',
    'persona real', 'atencion humana', 'atención humana', 'empleado',
    'llamar', 'llámenme', 'llámeme', 'contestar', 'responder',
    'hablar por telefono', 'whatsapp', 'whatsapp',
    'ya荷', 'ya llamé', 'ya llamo', 'meJOR',
    'denunciar', 'queja', 'reclamo', 'reclamar',
    'demanda', 'abogado', 'proceso legal'
  ];
  
  // Palabras fuera del dominio del chatbot
  const fueraDominio = [
    'receta', 'comida', 'restaurante', 'hospital', 'doctor', 'medico',
    'pelicula', 'cine', 'musica', 'musica', 'futbol', 'deporte',
    'bitcoin', 'criptomoneda', 'invertir en bolsa', 'banco',
    'impuesto', 'tax', 'visa', 'pasaporte', 'migracion',
    'empleo', 'trabajo', 'curriculum', 'prestamo personal'
  ];
  
  // Para soporte: temas que no puede manejar
  const fueraSoporte = [
    'propiedad', 'casa', 'departamento', 'renta', 'venta',
    'comprar', 'inmueble', 'inmobiliario', 'precio', 'metro',
    ' Hipoteca ', 'credito', 'apartamento'
  ];
  
  if (tipo === 'soporte') {
    // Si pregunta sobre propiedades, redirigir a Max o al catálogo
    for (const palabra of fueraSoporte) {
      if (msg.includes(palabra)) {
        return {
          fueraDeTema: true,
          redireccion: {
            tipo: 'catalogo',
            mensaje: 'Para consultas sobre propiedades, puedo ayudarte mejor en nuestra sección de catálogo o puedes chatear con Max, nuestro asesor de servicios. 😊'
          }
        };
      }
    }
  }
  
  // Verificar si quiere atención humana
  for (const palabra of quierePersona) {
    if (msg.includes(palabra)) {
      return {
        fueraDeTema: true,
        redireccion: {
          tipo: ' humano',
          mensaje: 'Entiendo que prefieres hablar con una persona. 📞 ¿Te gustaría que te conectemos con un asesor? Tenemos WhatsApp disponible.',
          botones: [
            { texto: '📱 Chatear en WhatsApp', accion: 'whatsapp' },
            { texto: '📧 Escribir a soporte@vivemas.mx', accion: 'email' },
            { texto: 'Continuar aquí', accion: 'continuar' }
          ]
        }
      };
    }
  }
  
  // Verificar fuera del dominio
  for (const palabra of fueraDominio) {
    if (msg.includes(palabra)) {
      return {
        fueraDeTema: true,
        redireccion: {
          tipo: 'ayuda',
          mensaje: 'Ese tema no es de inmobiliarios. Pero estoy para ayudarte con: login, planes, publicación de propiedades o verificar tu cuenta. 😊'
        }
      };
    }
  }
  
  return null; // Todo bien
};

const chatServicios = async (req, res) => {
  try {
    const { mensaje, historial = [], datosContacto } = req.body;
    if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

    // Detectar intención primero
    const intencion = detectarIntention(mensaje, 'servicios');
    if (intencion && intencion.fueraDeTema) {
      return res.json({ 
        ok: true, 
        respuesta: intencion.redireccion.mensaje, 
        tipo: 'servicios', 
        esLead: false,
        redireccion: intencion.redireccion
      });
    }

    const messages = [
      { role: 'system', content: SISTEMA_SERVICIOS },
      ...historial
        .filter(h => h.role === 'user' || h.role === 'assistant')
        .slice(-10)
        .map(h => ({ role: h.role, content: h.text || h.content })),
      { role: 'user', content: mensaje }
    ];

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: 150,
      temperature: 0.7
    });

    const respuesta = completion.choices[0]?.message?.content || 'Lo siento, no pude procesar tu mensaje.';

    const esLead = (
      respuesta.toLowerCase().includes('asesor') ||
      respuesta.toLowerCase().includes('contactar') ||
      (datosContacto && datosContacto.nombre)
    ) ? true : false;

    res.json({ ok: true, respuesta, tipo: 'servicios', esLead });
  } catch (error) {
    console.error('Error chatbot servicios:', error.message);
    res.status(500).json({ error: 'Error al procesar el mensaje' });
  }
};

const guardarLead = async (req, res) => {
  try {
    const { nombre, telefono, email, servicio, conversacion, usuarioId, tipo } = req.body;
    if (!nombre || !telefono) return res.status(400).json({ error: 'Nombre y teléfono requeridos' });
    const tipoLead = tipo === 'soporte' ? 'soporte' : 'servicio';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

    let ciudad = null;
    let pais = 'México';
    try {
      const geoRes = await fetch(`http://ip-api.com/json/${ip}?lang=es`);
      const geoData = await geoRes.json();
      if (geoData.status === 'success') {
        ciudad = geoData.city;
        pais = geoData.country;
      }
    } catch (e) {}

    const lead = await Lead.create({
      nombre,
      telefono,
      email,
      servicio,
      tipo: tipoLead,
      conversacion,
      ip,
      ciudad,
      pais,
      usuarioRegistrado: usuarioId || null
    });

    await lead.populate('usuarioRegistrado', 'nombre email plan');
    console.log('LEAD NUEVO:', { folio: lead.folio, nombre, telefono, ciudad, fecha: new Date() });
    res.json({ ok: true, mensaje: 'Lead guardado. Un asesor te contactará pronto.', lead });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { chatSoporte, chatServicios, guardarLead };