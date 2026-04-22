const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SISTEMA_SOPORTE = `Eres el asistente virtual de soporte de Vive Más Inmobiliaria, una plataforma inmobiliaria mexicana.
Tu nombre es "Vivi" y tu rol es ayudar a usuarios con:
- Problemas de inicio de sesión y contraseñas
- Tipos de cuenta (Gratuito, Básico $299/mes, Premium $799/mes)
- Proceso de verificación de cuenta (email o SMS)
- Publicación de propiedades y proceso de revisión
- Favoritos y mensajes
- Problemas técnicos comunes

Reglas:
- Responde siempre en español
- Sé amable, profesional y conciso
- Si no puedes resolver el problema, sugiere contactar a soporte@vivemas.mx
- No inventes información que no esté en tu contexto
- Máximo 3 párrafos por respuesta
- Usa emojis ocasionalmente para ser más amigable`;

const SISTEMA_SERVICIOS = `Eres el asistente virtual de servicios de Vive Más Inmobiliaria, una plataforma inmobiliaria mexicana.
Tu nombre es "Max" y tu rol es informar y capturar leads sobre:
- Renta de inmuebles
- Compra y venta de propiedades
- Administración de edificios y condominios
- Pago de servicios (luz, agua, predial)
- Mantenimiento y reparaciones
- Plan Premium con fotografía profesional y gestoría

Reglas:
- Responde siempre en español
- Sé amable, profesional y orientado a ventas
- Cuando el usuario muestre interés real, pide su nombre y teléfono para que un asesor lo contacte
- Destaca los beneficios de cada servicio
- Máximo 3 párrafos por respuesta
- Usa emojis ocasionalmente`;

const chatSoporte = async (req, res) => {
  try {
    const { mensaje, historial = [] } = req.body;
    if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SISTEMA_SOPORTE
    });

    const chat = model.startChat({
      history: historial.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      }))
    });

    const result = await chat.sendMessage(mensaje);
    const respuesta = result.response.text();

    res.json({ ok: true, respuesta, tipo: 'soporte' });
  } catch (error) {
    console.error('Error chatbot soporte:', error.message);
    res.status(500).json({ error: 'Error al procesar el mensaje' });
  }
};

const chatServicios = async (req, res) => {
  try {
    const { mensaje, historial = [], datosContacto } = req.body;
    if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SISTEMA_SERVICIOS
    });

    const chat = model.startChat({
      history: historial.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      }))
    });

    const result = await chat.sendMessage(mensaje);
    const respuesta = result.response.text();

    const esLead = respuesta.toLowerCase().includes('asesor') ||
                   respuesta.toLowerCase().includes('contactar') ||
                   datosContacto?.nombre;

    res.json({ ok: true, respuesta, tipo: 'servicios', esLead });
  } catch (error) {
    console.error('Error chatbot servicios:', error.message);
    res.status(500).json({ error: 'Error al procesar el mensaje' });
  }
};

const guardarLead = async (req, res) => {
  try {
    const { nombre, telefono, email, servicio, conversacion } = req.body;
    if (!nombre || !telefono) return res.status(400).json({ error: 'Nombre y teléfono requeridos' });
    console.log('LEAD NUEVO:', { nombre, telefono, email, servicio, fecha: new Date() });
    res.json({ ok: true, mensaje: 'Lead guardado. Un asesor te contactará pronto.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { chatSoporte, chatServicios, guardarLead };