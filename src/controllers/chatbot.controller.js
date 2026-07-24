const Groq = require('groq-sdk');
const Lead = require('../models/Lead');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/* ==========================================================
   CONFIGURACIONES DE MODELO (Separadas y con penalizaciones)
========================================================== */
const CONFIG_VIVI = {
    model: "llama-3.3-70b-versatile",
    temperature: 0.85,
    top_p: 0.90,
    frequency_penalty: 0.3,
    presence_penalty: 0.2,
    max_tokens: 150
};

const CONFIG_MAX = {
    model: "llama-3.3-70b-versatile",
    temperature: 0.95, 
    top_p: 0.90,
    frequency_penalty: 0.3,
    presence_penalty: 0.2,
    max_tokens: 150
};

/* ==========================================================
   FUNCIONES AUXILIARES
========================================================== */

const getFechaActual = () => new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const normalizarTexto = (texto = '') => texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Mejorado con límites de palabra (\b) para evitar falsos positivos
const contieneAlgunaPalabra = (texto, palabras = []) => {
    const contenido = normalizarTexto(texto);
    return palabras.some(palabra => {
        const safeWord = normalizarTexto(palabra).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${safeWord}\\b`, "i").test(contenido);
    });
};

// Detección de emociones (Punto 8)
const detectarFrustracion = (mensaje) => {
    const msg = normalizarTexto(mensaje);
    return /mal servicio|no sirve|pesimo|horrible|estoy molesto|frustrado|no funciona|estoy harto|queja|reclamo|basura|una mierda/i.test(msg);
};

// Detección robusta de Leads (Punto 4 - Ya no usa includes)
const requiereContactoHumano = (texto) => /nombre|telefono|teléfono|contactaremos|llamaremos|se pondrá en contacto/i.test(texto);

const detectarIntention = (mensaje, tipo) => {
    const msg = normalizarTexto(mensaje);
    const quierePersona = ["hablar con alguien", "hablar con una persona", "hablar con asesor", "persona real", "asesor humano", "atencion humana", "llamame", "llamenme", "quiero hablar", "quiero llamar", "telefono", "whatsapp", "queja", "reclamo", "denuncia", "abogado", "demanda"];
    const fueraDominio = ["doctor", "hospital", "medico", "restaurante", "receta", "comida", "pelicula", "musica", "bitcoin", "criptomoneda", "banco", "visa", "pasaporte", "empleo", "curriculum"];
    const fueraSoporte = ["comprar", "vender", "rentar", "renta", "venta", "propiedad", "departamento", "casa", "terreno", "hipoteca", "credito"];

    if (tipo === "soporte" && contieneAlgunaPalabra(msg, fueraSoporte)) return { fueraDeTema: true, redireccion: { tipo: "catalogo", mensaje: "Puedo ayudarte mejor con eso desde nuestro catálogo o con Max, nuestro asesor inmobiliario. 😊" } };
    if (contieneAlgunaPalabra(msg, quierePersona)) return { fueraDeTema: true, redireccion: { tipo: "humano", mensaje: "Claro. Si prefieres hablar con una persona, con gusto podemos ponerte en contacto con un asesor. 😊", botones: [{ texto: "📱 WhatsApp", accion: "whatsapp" }, { texto: "📧 Correo", accion: "email" }, { texto: "Continuar aquí", accion: "continuar" }] } };
    if (contieneAlgunaPalabra(msg, fueraDominio)) return { fueraDeTema: true, redireccion: { tipo: "ayuda", mensaje: "Ese tema está fuera de mi área de ayuda. Con gusto puedo ayudarte con servicios inmobiliarios, soporte de la plataforma o publicación de propiedades. 😊" } };
    return null;
};

/* ==========================================================
   REGLAS ESTRICTAS PROMPT (Punto 2)
========================================================== */
const REGLAS_ESTRICTAS_PROMPT = `
INFORMACIÓN IMPORTANTE:
Si no conoces una respuesta con certeza, no inventes información bajo ninguna circunstancia.
Di honestamente que no tienes ese dato y ofrece poner al usuario en contacto con un asesor.
Nunca inventes precios, promociones, funciones ni políticas.
`;

/* ==========================================================
   PROMPTS DEL SISTEMA (Reducidos - Punto 3)
========================================================== */
const SISTEMA_SOPORTE = `
Eres Vivi, asesora de soporte de Vive Más Inmobiliaria. Nunca digas que eres una IA.
El usuario debe sentir que conversa con una asesora real por WhatsApp.

PERSONALIDAD: Cercana, profesional, paciente, empática. Escribe como una persona real.
FORMA DE HABLAR: Habla como un asesor humano (ej: "Claro 😊", "Entiendo", "Déjame ayudarte"). No respondas como robot. Evita ser muy formal. Responde entre 2 y 4 oraciones. Haz UNA pregunta a la vez. Nunca repitas datos que el usuario ya dio.

Si el usuario está molesto o frustrado, primero demuestra empatía (ej: "Entiendo lo frustrante que puede ser.") antes de ayudar.
TEMAS: Inicio de sesión, contraseñas, verificación, publicar propiedades, favoritos, mensajes, planes (Gratuito, Básico $299, Premium $799).
Si requiere revisión interna: "Puedes escribirnos a soporte@vivemas.mx y con gusto le darán seguimiento."
Al solucionar, pregunta: "¿Te puedo ayudar con algo más?"
Al despedirte, varia la respuesta.
`;

const SISTEMA_SERVICIOS = `
Eres Max, asesor inmobiliario de Vive Más. Nunca digas que eres una IA.
El usuario debe sentir que habla con un asesor real por WhatsApp.
Tu objetivo es conocer la necesidad del cliente para que un asesor le dé seguimiento.

PERSONALIDAD: Cercano, profesional, amable. No pareces un formulario.
FORMA DE HABLAR: Habla como una persona (ej: "Claro.", "Perfecto."). Alterna expresiones. Pregunta UNA cosa a la vez.
SERVICIOS: Compra, Venta, Renta, Administración, Mantenimiento, Pago de servicios.
`;

/* ==========================================================
   MÁQUINA DE ESTADOS Y LÓGICA DE FLUJO (Puntos 1 y 9)
   El BACKEND decide el estado. El LLM solo redacta la pregunta.
========================================================== */

const FLUJO_MAX = {
    inicio: { siguiente: 'esperando_ciudad', instruccion: 'Saluda de forma natural y pregúntale qué servicio necesita (compra, renta, venta, administración, mantenimiento, pago de servicios).' },
    esperando_ciudad: { siguiente: 'esperando_presupuesto', instruccion: 'Confirma el servicio que eligió y pregunta en qué ciudad o zona lo necesita.' },
    esperando_presupuesto: { siguiente: 'esperando_nombre', instruccion: 'Pregunta si la propiedad es para vivir o inversión, y cuál es su presupuesto aproximado.' },
    esperando_nombre: { siguiente: 'completado', instruccion: 'Dile que tienes la información lista. Pide su nombre y un número de teléfono de forma natural y amable para que un asesor se contacte.' },
    completado: { siguiente: 'completado', instruccion: 'Confirma que un asesor se contactará pronto y pregunta si necesita algo más.' }
};

// Función para saber si el usuario ya respondió a la pregunta actual
const usuarioRespondio = (mensaje) => {
    const negaciones = ['no', 'nop', 'nel', 'nope', 'nada', 'ninguno', 'todavía no', 'aún no'];
    const msg = normalizarTexto(mensaje);
    // Si es muy corto y es una negación, asumimos que no respondió útil
    return msg.length > 3 && !negaciones.some(n => msg === n);
};

const gestionarFlujoMax = (mensaje, estadoActual, historial) => {
    const pasoActual = FLUJO_MAX[estadoActual];
    if (!pasoActual || estadoActual === 'completado') return null;

    // Verificar si el usuario ya dio la información necesaria para avanzar
    if (usuarioRespondio(mensaje)) {
        return { nuevoEstado: pasoActual.siguiente, instruccion: pasoActual.instruccion };
    }

    return null; // El usuario no dio información útil aún, deja que la IA maneje la objeción
};

/* ==========================================================
   CONTROLADORES DE CHAT
========================================================== */

const chatSoporte = async (req, res) => {
    try {
        const { mensaje, historial = [] } = req.body;
        if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

        const intencion = detectarIntention(mensaje, 'soporte');
        if (intencion?.fueraDeTema) {
            return res.json({ ok: true, respuesta: intencion.redireccion.mensaje, tipo: 'soporte', esLead: intencion.redireccion.tipo === 'humano', redireccion: intencion.redireccion });
        }

        let systemPrompt = SISTEMA_SOPORTE + REGLAS_ESTRICTAS_PROMPT + `\n\nFecha actual: ${getFechaActual()}`;
        
        // Inyección de empatía si el usuario está frustrado (Punto 8)
        if (detectarFrustracion(mensaje)) {
            systemPrompt += `\n\nEl usuario parece estar frustrado o molesto. Es CRUCIAL que empieces tu respuesta demostrando empatía y comprensión antes de ofrecer cualquier solución técnica.`;
        }

        const messages = [
            { role: "system", content: systemPrompt },
            ...historial.filter(h => h.role === "user" || h.role === "assistant").slice(-8).map(h => ({ role: h.role, content: h.text || h.content })), // Punto 6: Reducido a 8
            { role: "user", content: mensaje }
        ];

        const completion = await groq.chat.completions.create({ ...CONFIG_VIVI, messages });
        let respuesta = completion.choices?.[0]?.message?.content?.trim() || "Lo siento, no pude procesar tu mensaje. ¿Podrías intentarlo de nuevo?";

        // Limpieza
        respuesta = respuesta.replace(/¿Hay algo más en que pueda ayudarte\?\s*😊?/gi, '').replace(/\n{3,}/g, "\n\n").trim();

        const solucionado = /(listo|solucionado|resuelto|ya quedó|me alegra)/i.test(respuesta) && !/(hasta pronto|excelente día|gracias por escribirnos)/i.test(respuesta);
        if (solucionado) {
            const opciones = ["¿Te puedo ayudar con algo más? 😊", "Si surge otra duda, aquí estaré.", "¿Hay algo más que quieras revisar?"];
            respuesta += "\n\n" + opciones[Math.floor(Math.random() * opciones.length)];
        }

        const textoCompleto = (respuesta + " " + mensaje).toLowerCase();
        const esLead = requiereContactoHumano(textoCompleto); // Punto 4: Ya no usa includes()

        // Punto 7: Logging estructurado
        console.log({ evento: 'CHAT_SOPORTE', esLead, mensaje_corto: mensaje.substring(0, 50) });

        return res.json({ ok: true, respuesta, tipo: "soporte", esLead });
    } catch (error) {
        console.error("Error chatbot soporte:", error);
        return res.status(500).json({ error: "Error al procesar el mensaje." });
    }
};

const chatServicios = async (req, res) => {
    try {
        const { mensaje, historial = [], datosContacto, estado: estadoActual = 'inicio' } = req.body;
        if (!mensaje) return res.status(400).json({ error: "Mensaje requerido" });

        const intencion = detectarIntention(mensaje, "servicios");
        if (intencion?.fueraDeTema) {
            return res.json({ ok: true, respuesta: intencion.redireccion.mensaje, tipo: "servicios", esLead: false, redireccion: intencion.redireccion, estado: estadoActual });
        }

        let systemPrompt = SISTEMA_SERVICIOS + REGLAS_ESTRICTAS_PROMPT + `\n\nFecha actual: ${getFechaActual()}`;
        let nuevoEstado = estadoActual;
        let forzarAccion = false;

        // ========================================================
        // ARQUITECTURA HÍBRIDA (Punto 9): Backend decide, LLM redacta
        // ========================================================
        const decisionFlujo = gestionarFlujoMax(mensaje, estadoActual, historial);

        if (decisionFlujo) {
            // El backend detectó que el usuario dio información. Forzamos al LLM a hacer la siguiente pregunta.
            systemPrompt += `\n\nINSTRUCCIÓN ESTRICTA PARA ESTA RESPUESTA:
No respondas a lo que acaba de decir el usuario. Asume que lo entendiste perfectamente.
Tu ÚNICA tarea ahora es hacer lo siguiente de forma muy natural y conversacional:
 ${decisionFlujo.instruccion}
No agregues nada más. No hagas otras preguntas.`;
            nuevoEstado = decisionFlujo.nuevoEstado;
            forzarAccion = true;
        }

        const messages = [
            { role: "system", content: systemPrompt },
            ...historial.filter(h => h.role === "user" || h.role === "assistant").slice(-8).map(h => ({ role: h.role, content: h.text || h.content })),
            { role: "user", content: mensaje }
        ];

        const completion = await groq.chat.completions.create({ ...CONFIG_MAX, messages });
        let respuesta = completion.choices?.[0]?.message?.content?.trim() || "Lo siento, no pude entender. ¿Podrías contarme un poco más?";

        respuesta = respuesta.replace(/¿Hay algo más en lo que pueda ayudarte\?\s*😊?/gi, "").replace(/¿Necesitas algo más\?\s*😊?/gi, "").replace(/\n{3,}/g, "\n\n").trim();

        // Verificar si la IA extrajo datos de contacto exitosamente
        if (nuevoEstado === 'completado' || requiereContactoHumano(respuesta)) {
            nuevoEstado = 'completado';
            const cierres = ["¿Hay algo más en lo que pueda ayudarte? 😊", "Si tienes otra consulta, aquí estoy."];
            respuesta += "\n\n" + cierres[Math.floor(Math.random() * cierres.length)];
        }

        const esLead = nuevoEstado === 'completado' || requiereContactoHumano((respuesta + " " + mensaje).toLowerCase());

        // Punto 7: Logging estructurado
        console.log({ evento: 'CHAT_SERVICIOS', estado_anterior: estadoActual, estado_nuevo: nuevoEstado, esLead, forzarAccion });

        return res.json({ ok: true, respuesta, tipo: "servicios", esLead, estado: nuevoEstado });
    } catch (error) {
        console.error("Error chatbot servicios:", error);
        return res.status(500).json({ error: "Error al procesar el mensaje." });
    }
};

/* ==========================================================
   GUARDAR LEAD (Con HTTPS - Punto 5)
========================================================== */

const guardarLead = async (req, res) => {
    try {
        const { nombre, telefono, email, servicio, conversacion, usuarioId, tipo } = req.body;
        if (!nombre || !telefono) return res.status(400).json({ error: "Nombre y teléfono requeridos" });
        
        const tipoLead = tipo === "soporte" ? "soporte" : "servicio";
        const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;

        let ciudad = null;
        let pais = "México";

        try {
            if (ip && ip !== "::1") {
                // Punto 5: Usar API con HTTPS por defecto
                const geoRes = await fetch(`https://ipapi.co/json/${ip}`);
                if (geoRes.ok) {
                    const geoData = await geoRes.json();
                    if (geoData.status === "success") {
                        ciudad = geoData.city || null;
                        pais = geoData.country_name || "México";
                    }
                }
            }
        } catch (error) {
            console.log("No fue posible obtener geolocalización.");
        }

        const lead = await Lead.create({ nombre, telefono, email, servicio, tipo: tipoLead, conversacion, ip, ciudad, pais, usuarioRegistrado: usuarioId || null });
        await lead.populate("usuarioRegistrado", "nombre email plan");
        console.log("LEAD NUEVO:", { folio: lead.folio, nombre, telefono, ciudad, fecha: new Date() });
        
        res.json({ ok: true, mensaje: "Lead guardado. Un asesor te contactará pronto.", lead });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { chatSoporte, chatServicios, guardarLead };