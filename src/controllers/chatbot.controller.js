const Groq = require('groq-sdk');
const Lead = require('../models/lead');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/* ==========================================================
   CONFIGURACIONES DE MODELO
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
    presence_penalty: 0.0,
    max_tokens: 150
};

/* ==========================================================
   FUNCIONES AUXILIARES
========================================================== */

const getFechaActual = () => 
    new Date().toLocaleDateString("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });

const normalizarTexto = (texto = '') => texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Para palabras individuales (usa boundary \b)
const contieneAlgunaPalabra = (texto, palabras = []) => {
    const contenido = normalizarTexto(texto);
    return palabras.some(palabra => {
        const safeWord = normalizarTexto(palabra).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${safeWord}\\b`, "i").test(contenido);
    });
};

// ✅ CORRECCIÓN 1: Nueva función para frases completas (usa includes)
const contieneFrase = (texto, frases = []) => {
    const contenido = normalizarTexto(texto);
    return frases.some(frase => contenido.includes(normalizarTexto(frase)));
};

const detectarFrustracion = (mensaje) => {
    const msg = normalizarTexto(mensaje);
    return /mal servicio|no sirve|pesimo|horrible|estoy molesto|frustrado|no funciona|estoy harto|queja|reclamo|basura/i.test(msg);
};

const detectarIntencion = (mensaje, tipo) => {
    const msg = normalizarTexto(mensaje);
    const quierePersona = ["hablar con alguien", "hablar con una persona", "hablar con asesor", "persona real", "asesor humano", "atencion humana", "llamame", "llamenme", "quiero hablar", "quiero llamar", "telefono", "whatsapp", "queja", "reclamo", "denuncia", "abogado", "demanda"];
    const fueraDominio = ["doctor", "hospital", "medico", "restaurante", "receta", "comida", "página web", "pelicula", "musica", "bitcoin", "criptomoneda", "banco", "visa", "pasaporte", "empleo", "curriculum"];
    const fueraSoporte = ["comprar", "vender", "rentar", "renta", "venta", "propiedad", "departamento", "casa", "terreno", "hipoteca", "credito"];

    if (tipo === "soporte" && contieneAlgunaPalabra(msg, fueraSoporte)) {
        return { fueraDeTema: true, redireccion: { tipo: "catalogo", mensaje: "Puedo ayudarte mejor con eso desde nuestro catálogo o con Max, nuestro asesor inmobiliario. 😊" } };
    }
    
    if (contieneAlgunaPalabra(msg, quierePersona)) {
        return { fueraDeTema: true, redireccion: { tipo: "humano", mensaje: "Claro. Si prefieres hablar con una persona, con gusto podemos ponerte en contacto con un asesor. 😊", botones: [{ texto: "📱 WhatsApp", accion: "whatsapp" }, { texto: "📧 Correo", accion: "email" }, { texto: "Continuar aquí", accion: "continuar" }] } };
    }
    
    if (contieneAlgunaPalabra(msg, fueraDominio)) {
        return { fueraDeTema: true, redireccion: { tipo: "ayuda", mensaje: "Ese tema está fuera de mi área de ayuda. Con gusto puedo ayudarte con servicios inmobiliarios, soporte de la plataforma o publicación de propiedades. 😊" } };
    }
    
    return null;
};

/* ==========================================================
   EXTRACCIÓN DE ENTIDADES (Nivel Backend)
========================================================== */

const CIUDADES_MX = [
    "mexico", "cdmx", "ciudad de mexico", "monterrey", "guadalajara", "queretaro", "puebla", 
    "cancun", "merida", "toluca", "tijuana", "leon", "aguascalientes", "chihuahua", 
    "morelia", "veracruz", "xalapa", "saltillo", "villahermosa", "durango", "san luis potosi", 
    "hermosillo", "culiacan", "mazatlan", "tuxtla", "oaxaca", "tuxtla gutierrez", 
    "tampico", "reynosa", "matamoros", "torreon", "gomez palacio", "chilpancingo", "cuernavaca", 
    "acapulco", "pachuca", "cuautitlan", "texcoco", "tlaxcala", "comitan",
    "polanco", "santa fe", "del valle", "coapa", "coyoacán", "tizayuca", "tlalnepantla", "naucalpan", 
    "atizapan", "cuajimalpa", "lalana",
    "zapopan", "tlajomulco", "tonala",
    "san pedro garza", "san nicolas", "guadalupe",
    "juriquilla", "corregidora", "el marqués",
    "angelópolis", "cholula",
    "playa del carmen", "puerto morelos", "isla mujeres", "akumal", "tulum",
    "progreso", "umán",
    "playas de rosarito", "rosarito"
];

const extraerEntidades = (mensaje) => {
    const resultados = { servicio: null, ciudad: null, presupuesto: null, nombre: null, telefono: null, uso: null };
    const msg = mensaje.trim();
    const msgNorm = normalizarTexto(msg);

    // Teléfono con contexto
    const phoneMatch = msg.match(
        /(?:tel[eé]fono|celular|whatsapp|ll[áa]mame|mi n[uú]mero(?:\s*es)?|contacto|:\s*)\s*(?:\+52\s?)?(\d[\s-]?){10,12}/i
    );
    if (phoneMatch) {
        const limpio = phoneMatch[0].replace(/\D/g, '');
        if (limpio.length >= 10 && limpio.length <= 12) {
            resultados.telefono = limpio;
        }
    }

    // Regex alternativa: formato muy claro
    if (!resultados.telefono) {
        const phoneDirecto = msg.match(/\+52\s?\d{10}/);
        if (phoneDirecto) {
            resultados.telefono = phoneDirecto[0].replace(/\D/g, '');
        }
    }
    if (!resultados.telefono) {
        const phoneDirecto2 = msg.match(/(?:^|\s)(\d{10})(?:\s|$)/);
        if (phoneDirecto2) {
            resultados.telefono = phoneDirecto2[1];
        }
    }

    // Nombre
    const nameRegex = /mi nombre es\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)+)/i;
    const nameMatch = msg.match(nameRegex);
    if (nameMatch) {
        const posibleNombre = nameMatch[1];
        const nombreFormateado = posibleNombre.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        
        if (!contieneAlgunaPalabra(posibleNombre, ['casa', 'departamento', 'renta', 'venta', 'mexico', 'monterrey', 'guadalajara', 'queretaro', 'puebla', 'cancún', 'mérida'])) {
            resultados.nombre = nombreFormateado;
        }
    }

    // Uso
    if (!resultados.uso) {
        if (contieneAlgunaPalabra(msgNorm, ["vivir", "habitar", "familia", "casa propia"])) {
            resultados.uso = "Vivir";
        } else if (contieneAlgunaPalabra(msgNorm, ["inversion", "invertir", "rentar para poner", "negocio", "rendimiento"])) {
            resultados.uso = "Inversión";
        }
    }

    // ✅ CORRECCIÓN 3: Presupuesto requiere unidad monetaria explícita
    const presupuestoRegex = /(?:\$|mxn|pesos)\s?\d[\d,.]*|\d+(?:[.,]\d+)?\s?(?:millones|millon)/i;
    if (presupuestoRegex.test(msg)) {
        resultados.presupuesto = msg.match(presupuestoRegex)[0];
    }

    // Servicio
    const serviciosMap = { 
        'compra': 'compra', 'comprar': 'compra', 'venta': 'venta', 'vender': 'venta', 'renta': 'renta', 'rentar': 'renta', 
        'administracion': 'administración', 'administración': 'administración', 'mantenimiento': 'mantenimiento', 'pago': 'pago de servicios' 
    };
    for (const [clave, valor] of Object.entries(serviciosMap)) {
        if (msgNorm.includes(clave) && !resultados.servicio) {
            resultados.servicio = valor;
            break;
        }
    }

    // Ciudad
    if (!resultados.ciudad) {
        for (const ciudad of CIUDADES_MX) {
            if (msgNorm.includes(ciudad)) {
                resultados.ciudad = ciudad.charAt(0).toUpperCase() + ciudad.slice(1);
                break;
            }
        }
    }

    // Ciudad contextual con regex corregida
    if (!resultados.ciudad) {
        const ciudadContextual = mensaje.match(
            /(?:en|zona|colonia|ubicación)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)?)/i
        );
        if (ciudadContextual && ciudadContextual[1]) {
            const ciudadFormateado = ciudadContextual[1].charAt(0).toUpperCase() + ciudadContextual[1].slice(1);
            const exclusiones = ['zona', 'colonia', 'ubicación', 'partida', 'norte', 'sur', 'este', 'oeste'];
            if (!exclusiones.includes(normalizarTexto(ciudadContextual[1]))) {
                resultados.ciudad = ciudadFormateado;
            }
        }
    }

    return resultados;
};

/* ==========================================================
   MÁQUINA DE ESTADOS
========================================================== */

// ✅ CORRECCIÓN 1: Usa contieneFrase() para frases completas
const detectarServicio = (mensaje) => {
    return contieneFrase(mensaje, [
        "quiero comprar",
        "busco comprar",
        "me interesa comprar",
        "necesito comprar",
        "quiero vender",
        "busco vender",
        "me interesa vender",
        "necesito vender",
        "quiero rentar",
        "busco rentar",
        "quiero renta",
        "busco renta",
        "poner en renta",
        "poner en venta",
        "administrar mi propiedad",
        "administrar propiedad",
        "necesito administracion",
        "pago de servicios",
        "mantenimiento de propiedad"
    ]);
};

// ✅ CORRECCIÓN 4: Solo salta estados intermedios, NO salta a completado
const calcularEstadoSaltable = (memoria, estadoActual) => {
    const ordenEstados = ['inicio', 'esperando_ciudad', 'esperando_uso', 'esperando_presupuesto', 'esperando_nombre', 'completado'];
    const idxActual = ordenEstados.indexOf(estadoActual);
    
    // No saltar si ya estamos en los últimos pasos
    if (idxActual >= ordenEstados.indexOf('esperando_nombre')) {
        return null;
    }

    // Si ya tiene todo hasta presupuesto, saltar a pedir datos de contacto
    if (memoria.ciudad && memoria.uso && memoria.presupuesto) {
        return 'esperando_nombre';
    }
    
    // Si tiene ciudad y uso, saltar a presupuesto
    if (memoria.ciudad && memoria.uso && idxActual < ordenEstados.indexOf('esperando_presupuesto')) {
        return 'esperando_presupuesto';
    }
    
    // Si solo tiene ciudad, saltar a uso
    if (memoria.ciudad && idxActual < ordenEstados.indexOf('esperando_uso')) {
        return 'esperando_uso';
    }
    
    return null;
};

const gestionarFlujoMax = (mensaje, estadoActual, memoria) => {
    const entidades = extraerEntidades(mensaje);
    
    // ✅ CORRECCIÓN 2: Actualizar memoria de forma segura (no sobrescribe)
    if (entidades.servicio && !memoria.servicio) memoria.servicio = entidades.servicio;
    if (entidades.ciudad && !memoria.ciudad) memoria.ciudad = entidades.ciudad;
    if (entidades.presupuesto && !memoria.presupuesto) memoria.presupuesto = entidades.presupuesto;
    if (entidades.nombre && !memoria.nombre) memoria.nombre = entidades.nombre;
    if (entidades.telefono && !memoria.telefono) memoria.telefono = entidades.telefono;
    if (entidades.uso && !memoria.uso) memoria.uso = entidades.uso;

    // Verificar salto de estados (nunca salta directo a completado)
    const estadoSaltable = calcularEstadoSaltable(memoria, estadoActual);
    if (estadoSaltable) {
        const instruccionesPorEstado = {
            'esperando_ciudad': 'Primero confirma brevemente que entendiste al usuario. Después pregunta en qué ciudad o zona busca la propiedad. No expliques el proceso, solo haz la pregunta.',
            'esperando_uso': 'Confirma brevemente la ciudad. Después pregunta si la propiedad es para vivir o como inversión. No expliques el proceso.',
            'esperando_presupuesto': 'Confirma brevemente lo que sabes. Después pregunta cuál es su presupuesto aproximado. No expliques el proceso.',
            'esperando_nombre': 'Confirma brevemente lo que sabes. Después pide su nombre y un número de teléfono de forma natural para que un asesor se contacte. No expliques el proceso.'
        };
        return {
            nuevoEstado: estadoSaltable,
            instruccion: instruccionesPorEstado[estadoSaltable]
        };
    }

    // ✅ CORRECCIÓN 3: Presupuesto ahora requiere unidad monetaria
    switch (estadoActual) {
        case 'inicio':
            if (detectarServicio(mensaje)) {
                return { 
                    nuevoEstado: 'esperando_ciudad', 
                    instruccion: 'Primero confirma brevemente que entendiste al usuario. Después pregunta en qué ciudad o zona busca la propiedad. No expliques el proceso, solo haz la pregunta.' 
                };
            }
            break;

        case 'esperando_ciudad':
            if (memoria.ciudad) {
                return { 
                    nuevoEstado: 'esperando_uso', 
                    instruccion: 'Confirma brevemente la ciudad. Después pregunta si la propiedad es para vivir o como inversión. No expliques el proceso.' 
                };
            }
            break;

        case 'esperando_uso':
            if (memoria.uso) {
                return { 
                    nuevoEstado: 'esperando_presupuesto', 
                    instruccion: 'Confirma brevemente el uso. Después pregunta cuál es su presupuesto aproximado. No expliques el proceso.' 
                };
            }
            break;

        case 'esperando_presupuesto':
            if (
                memoria.presupuesto ||
                /(?:\$|mxn|pesos)\s?\d[\d,.]*|\d+(?:[.,]\d+)?\s?(?:millones|millon)/i.test(mensaje)
            ) {
                return { 
                    nuevoEstado: 'esperando_nombre', 
                    instruccion: 'Confirma brevemente el presupuesto. Después pide su nombre y un número de teléfono de forma natural para que un asesor se contacte. No expliques el proceso.' 
                };
            }
            break;

        case 'esperando_nombre':
            if (memoria.nombre && memoria.telefono) {
                return { 
                    nuevoEstado: 'completado', 
                    instruccion: 'Confirma que tienes sus datos. Dile que un asesor se pondrá en contacto pronto y pregunta si necesita algo más.' 
                };
            }
            break;
    }

    return null;
};

/* ==========================================================
   PROMPTS DEL SISTEMA
========================================================== */

const REGLAS_ESTRICTAS_PROMPT = `
INFORMACIÓN IMPORTANTE:
Si no conoces una respuesta con certeza, no inventes información bajo ninguna circunstancia.
Di honestamente que no tienes ese dato y ofrece poner al usuario en contacto con un asesor.
Nunca inventes precios, promociones, funciones ni políticas.
`;

const SISTEMA_SOPORTE = `
Eres Vivi, asesora de soporte de Vive Más Inmobiliaria. Nunca digas que eres una IA.
El usuario debe sentir que conversa con una asesora real por WhatsApp.
PERSONALIDAD: Cercana, profesional, paciente, empática. Escribe como una persona real.
FORMA DE HABLAR: Habla como un asesor humano (ej: "Claro 😊", "Entiendo"). No respondas como robot. Responde entre 2 y 4 oraciones. Haz UNA pregunta a la vez.
TEMAS: Inicio de sesión, contraseñas, verificación, publicar propiedades, planes (Gratuito, Básico $299, Premium $799).
Si requiere revisión interna: "Puedes escribirnos a soporte@vivemas.mx".
Al solucionar, pregunta: "¿Te puedo ayudar con algo más?"
`;

// ✅ CORRECCIÓN 6: Reglas explícitas contra repetir preguntas
const SISTEMA_SERVICIOS = `
Eres Max, asesor inmobiliario de Vive Más. Nunca digas que eres una IA.
El usuario debe sentir que habla con un asesor real por WhatsApp.
PERSONALIDAD: Cercano, profesional, amable. No pareces un formulario. Pregunta UNA cosa a la vez.

SERVICIOS: Compra, Venta, Renta, Administración, Mantenimiento, Pago de servicios.

REGLAS DE CONVERSACIÓN OBLIGATORIAS:
- NUNCA preguntes información que ya aparece en la MEMORIA.
- Si el usuario proporciona varios datos juntos, acéptalos todos sin pedir confirmación individual.
- No hagas preguntas de formulario ("¿Cuál es tu nombre?", "¿Tu teléfono?").
- Mantén la conversación natural, como si estuvieras tomando notas mentalmente.
- Cuando pidas datos faltantes, intégralo en una frase natural: "Perfecto, y para ponerme en contacto contigo, ¿cómo te llamas y a qué número te llamo?"
`;

/* ==========================================================
   CONTROLADORES DE CHAT
========================================================== */

const chatSoporte = async (req, res) => {
    try {
        const { mensaje, historial = [] } = req.body;
        if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

        if (mensaje.length > 1000) {
            return res.json({ ok: true, respuesta: "¿Podrías resumirme un poco tu consulta? 😊", tipo: 'soporte', esLead: false });
        }

        const intencion = detectarIntencion(mensaje, 'soporte');
        if (intencion?.fueraDeTema) {
            return res.json({ ok: true, respuesta: intencion.redireccion.mensaje, tipo: 'soporte', esLead: intencion.redireccion.tipo === 'humano', redireccion: intencion.redireccion });
        }

        let systemPrompt = SISTEMA_SOPORTE + REGLAS_ESTRICTAS_PROMPT + `\n\nFecha actual: ${getFechaActual()}`;
        
        if (detectarFrustracion(mensaje)) {
            systemPrompt += `\n\nEl usuario parece frustrado. Empieza respondiendo mostrando empatía y comprensión antes de ofrecer soluciones.`;
        }

        const messages = [
            { role: "system", content: systemPrompt },
            ...historial.filter(h => h.role === "user" || h.role === "assistant").slice(-8).map(h => ({ role: h.role, content: h.text || h.content })),
            { role: "user", content: mensaje }
        ];

        const completion = await groq.chat.completions.create({ ...CONFIG_VIVI, messages });
        let respuesta = completion.choices?.[0]?.message?.content?.trim() || "Lo siento, no puedo procesar tu mensaje. ¿Podrías intentarlo de nuevo?";

        respuesta = respuesta.replace(/¿Hay algo más en que pueda ayudarte\?\s*😊?/gi, '').replace(/\n{3,}/g, "\n\n").trim();

        const solucionado = /(listo|solucionado|resuelto|ya quedó|me alegra)/i.test(respuesta) && !/(hasta pronto|excelente día|gracias por escribirnos)/i.test(respuesta);
        if (solucionado) {
            respuesta += "\n\n" + ["¿Te puedo ayudar con algo más? 😊", "Si surge otra duda, aquí estaré.", "¿Hay algo más que quieras revisar?"][Math.floor(Math.random() * 3)];
        }

        const esLead = /nombre|telefono|teléfono|contactaremos|llamaremos/i.test((respuesta + " " + mensaje).toLowerCase());

        console.log({ evento: 'CHAT_SOPORTE', esLead, msg_corto: mensaje.substring(0, 40) });
        return res.json({ ok: true, respuesta, tipo: "soporte", esLead });
    } catch (error) {
        console.error("Error chatbot soporte:", error);
        return res.status(500).json({ error: "Error al procesar el mensaje." });
    }
};

const chatServicios = async (req, res) => {
    try {
        const { mensaje, historial = [], datosContacto, estado: estadoActual = 'inicio', memoria: memoriaFrontend = {} } = req.body;
        if (!mensaje) return res.status(400).json({ error: "Mensaje requerido" });

        if (mensaje.length > 1000) {
            return res.json({ ok: true, respuesta: "¿Podrías resumirme un poco tu consulta? 😊", tipo: "servicios", esLead: false, estado: estadoActual, memoria: memoriaFrontend });
        }

        // ✅ CORRECCIÓN 2: Memoria protegida contra sobrescritura
        const entidadesDelMensaje = extraerEntidades(mensaje);
        const memoriaCompleta = { ...memoriaFrontend };
        
        for (const [key, value] of Object.entries(entidadesDelMensaje)) {
            if (value && !memoriaCompleta[key]) {
                memoriaCompleta[key] = value;
            }
        }

        const intencion = detectarIntencion(mensaje, "servicios");
        if (intencion?.fueraDeTema) {
            return res.json({ 
                ok: true, 
                respuesta: intencion.redireccion.mensaje, 
                tipo: "servicios", 
                esLead: false, 
                redireccion: intencion.redireccion, 
                estado: estadoActual, 
                memoria: memoriaCompleta
            });
        }

        const decisionFlujo = gestionarFlujoMax(mensaje, estadoActual, memoriaCompleta);

        let systemPrompt = SISTEMA_SERVICIOS + REGLAS_ESTRICTAS_PROMPT + `\n\nFecha actual: ${getFechaActual()}`;
        let nuevoEstado = estadoActual;

        systemPrompt += `
--------------------------------------------------
MEMORIA DE LA CONVERSACIÓN (NO VUELVAS A PREGUNTAR ESTO):
- Servicio elegido: ${memoriaCompleta.servicio || 'Aún no definido'}
- Ciudad/Zona: ${memoriaCompleta.ciudad || 'Aún no definida'}
- Uso (Vivir/Inversión): ${memoriaCompleta.uso || 'Aún no definido'}
- Presupuesto: ${memoriaCompleta.presupuesto || 'Aún no definido'}
- Nombre: ${memoriaCompleta.nombre || 'Aún no definido'}
- Teléfono: ${memoriaCompleta.telefono || 'Aún no definido'}
--------------------------------------------------`;

        if (decisionFlujo) {
            systemPrompt += `\n\nINSTRUCCIÓN ESTRICTA PARA ESTA RESPUESTA:
- No expliques el proceso.
- No resumas datos.
- No repitas información.
- Haz únicamente la pregunta solicitada.
- No agregues ninguna explicación adicional.`;
            nuevoEstado = decisionFlujo.nuevoEstado;
        }

        const messages = [
            { role: "system", content: systemPrompt },
            ...historial.filter(h => h.role === "user" || h.role === "assistant").slice(-8).map(h => ({ role: h.role, content: h.text || h.content })),
            { role: "user", content: mensaje }
        ];

        const completion = await groq.chat.completions.create({ ...CONFIG_MAX, messages });
        let respuesta = completion.choices?.[0]?.message?.content?.trim() || "Lo siento, no pude entender. ¿Podrías contarme un poco más?";

        respuesta = respuesta.replace(/¿Hay algo más en lo que pueda ayudarte\?\s*😊?/gi, "").replace(/¿Necesitas algo más\?\s*😊?/gi, "").replace(/\n{3,}/g, "\n\n").trim();

        // Validación de pregunta de presupuesto
        if (decisionFlujo && nuevoEstado === "esperando_presupuesto") {
            const tienePreguntaValida = /¿.*\?/s.test(respuesta);
            if (!tienePreguntaValida) {
                respuesta = "¿Cuál es tu presupuesto aproximado?";
            }
        }

        // ✅ CORRECCIÓN 4: Completado solo cuando estamos en esperando_nombre Y tenemos datos
        if (estadoActual === 'esperando_nombre' && memoriaCompleta.nombre && memoriaCompleta.telefono) {
            nuevoEstado = 'completado';
            const yaPreguntoCierre = /algo más|otra consulta|otra duda/i.test(respuesta);
            if (!yaPreguntoCierre) {
                const cierres = ["¿Hay algo más en lo que pueda ayudarte? 😊", "Si tienes otra consulta, aquí estamos."];
                respuesta += "\n\n" + cierres[Math.floor(Math.random() * cierres.length)];
            }
        }

        const esLead = nuevoEstado === 'completado';

        // ✅ CORRECCIÓN 5: Guardado automático de lead en el backend
        if (esLead && memoriaCompleta.nombre && memoriaCompleta.telefono) {
            try {
                const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;
                let ciudadGeo = null;
                let pais = "México";

                if (ip && ip !== "::1") {
                    try {
                        const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
                        if (geoRes.ok) {
                            const geoData = await geoRes.json();
                            ciudadGeo = geoData.city || null;
                            pais = geoData.country_name || "México";
                        }
                    } catch (geoError) {
                        // Silenciar error de geolocalización
                    }
                }

                // Preparar historial para guardar
                const historialFormateado = historial
                    .filter(h => h.role === "user" || h.role === "assistant")
                    .slice(-20)
                    .map(h => `${h.role === 'user' ? 'Cliente' : 'Max'}: ${h.text || h.content}`)
                    .join('\n');

                await Lead.create({
                    nombre: memoriaCompleta.nombre,
                    telefono: memoriaCompleta.telefono,
                    servicio: memoriaCompleta.servicio || 'No especificado',
                    tipo: "servicio",
                    conversacion: historialFormateado,
                    ip,
                    ciudad: ciudadGeo || memoriaCompleta.ciudad || null,
                    pais,
                    usuarioRegistrado: datosContacto?.usuarioId || null
                });

                console.log("✅ LEAD AUTOMÁTICO GUARDADO:", { 
                    nombre: memoriaCompleta.nombre, 
                    telefono: memoriaCompleta.telefono?.substring(0, 4) + '***',
                    ciudad: memoriaCompleta.ciudad 
                });
            } catch (leadError) {
                console.error("❌ Error al guardar lead automático:", leadError.message);
                // No interrumpimos el flujo por un error de guardado
            }
        }

        console.log({ 
            evento: 'CHAT_MAX', 
            estado_anterior: estadoActual, 
            estado_nuevo: nuevoEstado, 
            esLead, 
            memoria: { 
                servicio: memoriaCompleta.servicio, 
                ciudad: memoriaCompleta.ciudad, 
                uso: memoriaCompleta.uso,
                presupuesto: memoriaCompleta.presupuesto,
                nombre: memoriaCompleta.nombre ? '***' : null,
                telefono: memoriaCompleta.telefono ? '***' : null
            } 
        });

        return res.json({ 
            ok: true, 
            respuesta, 
            tipo: "servicios", 
            esLead, 
            estado: nuevoEstado,
            memoria: memoriaCompleta
        });
    } catch (error) {
        console.error("Error chatbot servicios:", error);
        return res.status(500).json({ error: "Error al procesar mensaje." });
    }
};

/* ==========================================================
   GUARDAR LEAD (Manual - respaldo del frontend)
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
                const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
                if (geoRes.ok) {
                    const geoData = await geoRes.json();
                    ciudad = geoData.city || null;
                    pais = geoData.country_name || "México";
                }
            }
        } catch (error) {
            console.log("No fue posible obtener geolocalización.");
        }

        const lead = await Lead.create({ 
            nombre, telefono, email, servicio, tipo: tipoLead, conversacion, ip, ciudad, pais, 
            usuarioRegistrado: usuarioId || null 
        });
        
        await lead.populate("usuarioRegistrado", "nombre email plan");
        console.log("LEAD NUEVO:", { folio: lead.folio, nombre, telefono, ciudad, fecha: new Date() });
        
        res.json({ ok: true, mensaje: "Lead guardado. Un asesor te contactará pronto.", lead });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { 
    chatSoporte, 
    chatServicios, 
    guardarLead 
};