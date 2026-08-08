const Groq = require('groq-sdk');
const crypto = require('crypto'); 
const Lead = require('../models/Lead');

if (!process.env.GROQ_API_KEY) throw new Error("❌ FATAL: Falta GROQ_API_KEY");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/* ==========================================================
   CONFIGURACIONES DE MODELO
========================================================== */
// llama-3.3-70b-versatile fue dado de baja por Groq (agosto 2026). Migrado a su reemplazo recomendado.
const CONFIG_VIVI = { model: "openai/gpt-oss-120b", temperature: 0.5, top_p: 0.85, frequency_penalty: 0.5, presence_penalty: 0.2, max_tokens: 250 };
const CONFIG_MAX = { model: "openai/gpt-oss-120b", temperature: 0.6, top_p: 0.85, frequency_penalty: 0.4, presence_penalty: 0.1, max_tokens: 300 };

/* ==========================================================
   SISTEMA DE LOGS ESTRUCTURADOS
========================================================== */
const logBot = (evento, datos = {}) => {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), nivel: 'BOT', evento, ...datos }));
};

/* ==========================================================
   CATÁLOGO DE SERVICIOS
========================================================== */
const SERVICIOS_VIVE_MAS = {
    renta: {
        nombre: "Renta de inmuebles", categoria: "Inmobiliario",
        objetivo: "Propietarios que desean rentar su inmueble de forma segura.",
        beneficio: "Reducimos el riesgo al seleccionar inquilinos y facilitamos todo el proceso legal.",
        descripcion: "Publicación, filtrado de candidatos, verificación y contrato.",
        incluye: ["Publicación en plataforma digital", "Filtrado y selección de candidatos", "Verificación de identidad y referencias", "Elaboración de contrato de arrendamiento"],
        requiereCotizacion: true,
        cta: "Si te interesa rentar tu propiedad de forma segura, puedo conectararte con un asesor.",
        keywords: [
            { t: "rentar", w: 10 }, { t: "arrendar", w: 10 }, { t: "renta", w: 8 }, 
            { t: "inquilino", w: 9 }, { t: "contrato de renta", w: 10 }, { t: "renta de casa", w: 9 }, 
            { t: "renta de departamento", w: 9 }, { t: "quiero rentar mi casa", w: 10 },
            { t: "busco renta", w: 9 }, { t: "me quiero rentar", w: 10 }, { t: "rentar una casa", w: 10 }, 
            { t: "rentar un departamento", w: 10 }, { t: "voy a rentar", w: 9 }, { t: "para rentar", w: 8 }
        ],
        preguntasFrecuentes: [
            { k: ["cuanto", "tarda", "tiempo", "proceso"], respuesta: "El tiempo varía según el inmueble y la demanda en la zona, pero trabajamos activamente para conseguirte candidatos lo antes posible." },
            { k: ["documentos", "necesito", "requisitos"], respuesta: "Generalmente solicitamos identificación oficial, escrituras del inmueble y comprobantes de propiedad. El asesor te dará la lista exacta." },
            { k: ["verifican", "inquilino", "antecedentes", "buro", "credito"], respuesta: "Realizamos un proceso de validación de identidad y solicitud de referencias, siguiendo las mejores prácticas del sector para proteger tu propiedad." }
        ]
    },
    compra_venta: {
        nombre: "Compra y venta", categoria: "Inmobiliario",
        objetivo: "Personas que buscan comprar su primera casa o vender al mejor precio.",
        beneficio: "Te acompañamos en la negociación y trámites para asegurar una operación segura.",
        descripcion: "Asesoría completa desde que decides comprar o vender hasta la firma ante notario.",
        incluye: ["Valoración profesional del inmueble", "Acompañamiento en negociación", "Revisión de documentos y legalidad", "Gestión de escrituración"],
        requiereCotizacion: false, precio: "Nuestro honorario se cubre mediante un porcentaje negociado al momento de cerrar la operación.",
        cta: "Si estás listo para dar el paso de comprar o vender, con gusto un asesor te guía.",
        keywords: [{ t: "comprar", w: 10 }, { t: "vender", w: 10 }, { t: "compra", w: 8 }, { t: "venta", w: 8 }, { t: "escrituras", w: 10 }, { t: "notario", w: 9 }, { t: "invertir en propiedad", w: 9 }],
        preguntasFrecuentes: [
            { k: ["cuanto", "cobran", "costo", "honorario", "comision"], respuesta: "Nuestro honorario es un porcentaje acordado al inicio, sin pagos ocultos, y se liquida al firmar las escrituras." },
            { k: ["necesito", "guardado", "ahorro", "enganche"], respuesta: "Si vas a comprar, es ideal tener un ahorro inicial. Si vendes, nosotros te ayudamos a obtener el mejor precio." }
        ]
    },
    pago_servicios: {
        nombre: "Pago de servicios", categoria: "Administración",
        objetivo: "Propietarios u ocupantes que quieren evitar filas y retrasos.",
        beneficio: "Te ahorramos tiempo y evitamos multas por pagos extemporáneos o cortes de servicio.",
        descripcion: "Gestionamos el pago puntual de luz, agua, gas, predial e internet.",
        incluye: ["Pago de energía eléctrica (CFE)", "Pago de agua (SACMEX o local)", "Pago de gas natural o LP", "Pago de predial", "Pago de internet y telefonía"],
        requiereCotizacion: false, precio: "Cobramos una pequeña comisión por transacción o una cuota mensual fija, dependiendo del volumen.",
        cta: "Si ya estás cansado de hacer filas, puedo agendar tu asesoría.",
        keywords: [{ t: "pago de servicios", w: 10 }, { t: "pagar servicios", w: 10 }, { t: "pago de luz", w: 10 }, { t: "pago de agua", w: 10 }, { t: "pago de predial", w: 10 }, { t: "pago de gas", w: 10 }, { t: "pagar recibos", w: 8 }],
        preguntasFrecuentes: [
            { k: ["donde", "banco", "app", "plataforma", "pagar"], respuesta: "Nosotros realizamos el pago directamente en las plataformas oficiales de cada proveedor, no necesitas hacer nada." }
        ]
    },
    administracion: {
        nombre: "Administración de edificios", categoria: "Administración",
        objetivo: "Síndicos o comités que buscan orden, transparencia y tranquilidad.",
        beneficio: "Profesionalizamos la gestión, mejorando la convivencia y el mantenimiento.",
        descripcion: "Cobros, pagos a proveedores, actas y atención a residentes.",
        incluye: ["Cobro de cuotas de mantenimiento", "Contabilidad transparente y estados de cuenta", "Contratación y supervisión de mantenimiento", "Atención a residentes"],
        requiereCotizacion: true,
        cta: "Si tu edificio necesita un cambio de rumbo, un asesor puede mostrarte cómo trabajamos.",
        keywords: [{ t: "administracion de edificios", w: 10 }, { t: "administrar edificio", w: 10 }, { t: "administrar condominio", w: 10 }, { t: "síndico", w: 9 }, { t: "cuotas de mantenimiento", w: 9 }],
        preguntasFrecuentes: [
            { k: ["contabilidad", "estados de cuenta", "rendicion", "transparencia"], respuesta: "Generamos estados de cuenta periódicos claros, garantizando la transparencia total de cada peso invertido." }
        ]
    },
    mantenimiento: {
        nombre: "Mantenimiento y reparaciones", categoria: "Mantenimiento",
        objetivo: "Propietarios o inquilinos que necesitan resolver un problema físico rápido.",
        beneficio: "Resolvemos el daño sin que busques proveedores ni supervises la obra.",
        descripcion: "Diagnóstico y reparación para problemas de plomería, electricidad, pintura y más.",
        incluye: ["Diagnóstico del problema sin costo", "Cotización formal antes de proceder", "Ejecución del reparo con personal calificado", "Garantía por escrito del servicio"],
        requiereCotizacion: true,
        cta: "Si tienes un problema en casa y no sabes a quién llamar, con gusto te conecto con nuestro equipo técnico.",
        keywords: [{ t: "mantenimiento", w: 10 }, { t: "reparacion", w: 10 }, { t: "plomeria", w: 10 }, { t: "electricidad", w: 10 }, { t: "fuga de agua", w: 10 }, { t: "arreglar", w: 8 }, { t: "filtracion", w: 10 }],
        preguntasFrecuentes: [
            { k: ["gratis", "cobro", "diagnostico", "visita"], respuesta: "Sí, la visita de diagnóstico es completamente sin costo y sin compromiso." },
            { k: ["no me gusta", "cotizacion", "aceptar"], respuesta: "No hay ningún problema, no estás obligado a aceptar. Es un servicio de asesoría libre." }
        ]
    },
    premium: {
        nombre: "Plan Premium", categoria: "Marketing inmobiliario",
        objetivo: "Propietarios que buscan vender o rentar más rápido, destacando su inmueble.",
        beneficio: "Maximizamos la exposición y presentación visual, atrayendo más prospectos calificados.",
        descripcion: "Servicio integral de marketing inmobiliario para que tu anuncio destaque.",
        incluye: ["Sesión de fotografía profesional", "Home staging (preparación del espacio)", "Video tour 360°", "Publicidad estratégica en portales y redes sociales"],
        requiereCotizacion: true,
        cta: "Si quieres que tu propiedad se vea increíble, puedo ayudarte a contactar a un asesor de marketing.",
        keywords: [{ t: "premium", w: 10 }, { t: "plan premium", w: 10 }, { t: "fotografia profesional", w: 8 }, { t: "video tour", w: 9 }, { t: "home staging", w: 9 }, { t: "marketing inmobiliario", w: 10 }],
        preguntasFrecuentes: [
            { k: ["portales", "publican", "inmuebles24", "lamudi", "vivanuncios"], respuesta: "La estrategia de publicación se diseña según el inmueble, utilizando los portales y redes que generen mejor alcance para tu caso específico." }
        ]
    }
};

/* ==========================================================
   SOLUCIONES DE SOPORTE (Para Vivi)
========================================================== */
const SOLUCIONES_SOPORTE = {
    no_puedo_ingresar: { palabras: ["no puedo ingresar", "no puedo entrar", "no me deja entrar", "error al ingresar", "no puedo iniciar sesion"], solucion: "Para resolver el problema de ingreso:\n\n1. **Verifica tus datos**: Asegúrate de escribir bien tu correo y contraseña.\n2. **Limpia caché**: Usa una ventana incógnito.\n3. **Restablece contraseña**: Usa 'Olvidé mi contraseña' en la pantalla de inicio.\n4. **Revisa tu correo**: Busca un correo de verificación pendiente.\n\n¿Cuál de estas opciones quieres intentar?" },
    planes_precios: { palabras: ["cuánto cuesta", "cuanto cuesta", "planes", "costo"], solucion: "Nuestros planes de publicación son:\n\n🏠 **Gratuito**: 1 propiedad, funciones básicas.\n💰 **Básico ($299/mes)**: Hasta 5 propiedades, estadísticas.\n⭐ **Premium ($799/mes)**: Ilimitadas, fotografía profesional, video tour.\n\n¿Te interesa alguno?" }
};

/* ==========================================================
   FUNCIONES AUXILIARES
========================================================== */
const getFechaActual = () => new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const normalizarTexto = (texto = '') => String(texto).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const contieneAlgunaPalabra = (texto, palabras = []) => {
    const contenido = normalizarTexto(texto);
    return palabras.some(palabra => {
        const safeWord = normalizarTexto(palabra).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${safeWord}\\b`, "i").test(contenido);
    });
};

const validarTelefonoMX = (t) => /^[1-9]\d{9}$/.test(String(t).replace(/\D/g, ''));
const validarEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim());

const sanitizarMemoria = (m = {}) => {
    const s = {};
    const sv = Object.keys(SERVICIOS_VIVE_MAS);
    if (m.tipoFlujo && ['propiedad', 'servicio'].includes(m.tipoFlujo)) s.tipoFlujo = m.tipoFlujo;
    if (m.servicio && sv.includes(m.servicio)) s.servicio = m.servicio;
    if (m.ciudad && typeof m.ciudad === 'string') s.ciudad = m.ciudad.substring(0, 100).trim();
    if (m.uso && ['Vivir', 'Inversión'].includes(m.uso)) s.uso = m.uso;
    if (m.presupuesto && typeof m.presupuesto === 'string') s.presupuesto = m.presupuesto.substring(0, 50).trim();
    if (m.nombre && typeof m.nombre === 'string') { const l = m.nombre.replace(/[^a-záéíóúñü\s']/gi, '').trim(); s.nombre = l.length >= 2 ? l.substring(0, 100) : null; }
    if (m.telefono && typeof m.telefono === 'string') { const l = m.telefono.replace(/\D/g, ''); s.telefono = validarTelefonoMX(l) ? l : null; }
    if (m.email && typeof m.email === 'string') s.email = validarEmail(m.email) ? m.email.trim().toLowerCase() : null;
    s.leadGuardado = m.leadGuardado === true;
    s.folio = m.folio || null;
    return s;
};

const generarFolio = () => `VM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
const CIUDADES_MX = ["mexico", "cdmx", "ciudad de mexico", "monterrey", "guadalajara", "queretaro", "puebla", "cancun", "merida", "toluca", "tijuana", "leon", "aguascalientes", "chihuahua", "morelia", "veracruz", "polanco", "santa fe", "coyoacán", "tlalpan", "zapopan", "san pedro garza", "zona sur", "zona norte"];

/* ==========================================================
   DETECCIÓN DE SERVICIOS Y ENTIDADES
========================================================== */
const detectarTipoServicio = (mensaje) => {
    const msg = normalizarTexto(mensaje);
    let puntajes = {}; let maxPuntaje = 0; let mejorServicio = null;
    for (const [clave, servicio] of Object.entries(SERVICIOS_VIVE_MAS)) {
        puntajes[clave] = 0;
        for (const kw of servicio.keywords) { if (contieneAlgunaPalabra(msg, [kw.t])) puntajes[clave] += kw.w; }
        if (puntajes[clave] > maxPuntaje) { maxPuntaje = puntajes[clave]; mejorServicio = clave; }
    }
    const UMBRAL_CONFIANZA = 6; 
    
    if (maxPuntaje >= UMBRAL_CONFIANZA) {
        return { servicio: mejorServicio, confianza: maxPuntaje };
    } else if (maxPuntaje > 0) {
        return { 
            aclarar: true, 
            sugerencias: Object.entries(puntajes)
                .filter(([_, p]) => p > 0)
                .sort(([_, a], [__, b]) => b - a)
                .slice(0, 2)
                .map(([k]) => SERVICIOS_VIVE_MAS[k].nombre)
        };
    }
    return null;
};

const determinarTipoFlujo = (s) => ['renta', 'compra_venta', 'premium'].includes(s) ? 'propiedad' : 'servicio';

const buscarEnFAQ = (mensaje, servicioKey) => {
    if (!servicioKey || !SERVICIOS_VIVE_MAS[servicioKey]) return null;
    const faqs = SERVICIOS_VIVE_MAS[servicioKey].preguntasFrecuentes;
    const msg = normalizarTexto(mensaje);
    for (const faq of faqs) { if (faq.k.filter(sinonimo => msg.includes(normalizarTexto(sinonimo))).length >= 1) { logBot('FAQ_UTILIZADA', { servicio: servicioKey }); return faq.respuesta; } }
    return null;
};

const esPreguntaDePrecio = (m) => contieneAlgunaPalabra(m, ["cuanto cuesta", "cuánto cuesta", "precio", "costo", "cuanto es", "cuánto es", "cuanto cobran", "cuánto cobran"]);

const extraerPresupuestoAvanzado = (mensaje) => {
    const msg = normalizarTexto(mensaje); let valorFinal = null;
    const numerosTexto = { "uno": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5, "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10, "veinte": 20, "treinta": 30, "cuarenta": 40, "cincuenta": 50 };
    const parsearNumero = (strNum) => { let numStr = strNum.replace(/,/g, '.'); for (const [texto, num] of Object.entries(numerosTexto)) { numStr = numStr.replace(new RegExp(`\\b${texto}\\b`, 'g'), num); } const val = parseFloat(numStr); return isNaN(val) ? 0 : val; };
    const multiplicar = (num, texto) => /millon/.test(texto) ? num * 1000000 : num;
    
    const regexRango = /(?:entre|de)\s*([\d,.]+|\w+)\s*(?:a|y|-)\s*([\d,.]+|\w+)\s*(millon(?:es)?)/i;
    const matchRango = msg.match(regexRango); if (matchRango) { valorFinal = multiplicar(Math.max(parsearNumero(matchRango[1]), parsearNumero(matchRango[2])), matchRango[3]); }
    if (!valorFinal) { const regexAprox = /(?:unos|alrededor de|aproximadamente|cerca de|ronda(?: en|do)?)\s*([\d,.]+|\w+)\s*(millon(?:es)?)/i; const matchAprox = msg.match(regexAprox); if (matchAprox) valorFinal = multiplicar(parsearNumero(matchAprox[1]), matchAprox[2]); }
    if (!valorFinal) { const regexDirecto = /(?:\$|pesos|mxn)?\s*([\d,.]+|\w+)\s*(millon(?:es)?|pesos|mxn)?/i; const matchDirecto = msg.match(regexDirecto); if (matchDirecto) { let val = parsearNumero(matchDirecto[1]); valorFinal = multiplicar(val, matchDirecto[2] || ''); if (!matchDirecto[2] && !/\$|pesos|mxn/i.test(matchDirecto[0])) { valorFinal = ((val >= 5000 && val <= 150000) || (val >= 500000 && val <= 50000000)) ? val : null; } } }
    return (valorFinal && valorFinal > 0) ? `$${new Intl.NumberFormat('es-MX').format(valorFinal)}` : null;
};

const extraerEntidades = (mensaje) => {
    const res = { servicio: null, ciudad: null, presupuesto: null, nombre: null, telefono: null, email: null, uso: null };
    const msg = String(mensaje).trim(); const msgN = normalizarTexto(msg);
    const detServicio = detectarTipoServicio(mensaje); if (detServicio && detServicio.servicio) res.servicio = detServicio.servicio;
    let tel = null;
    const pCtx = msg.match(/(?:tel[eé]fono|celular|whatsapp|ll[áa]mame|mi n[uú]mero(?:\s*es)?|contacto|:\s*)\s*(?:\+52\s?)?(\d[\s-]?){10,12}/i); if (pCtx) { const l = pCtx[0].replace(/\D/g, ''); if (validarTelefonoMX(l)) tel = l; }
    if (!tel) { const pP = msg.match(/\+52\s?(\d{10})/); if (pP && validarTelefonoMX(pP[1])) tel = pP[1]; }
    if (!tel) { const pD = msg.match(/(?:^|\s)(\d{10})(?:\s|$|[.,;!])/); if (pD && validarTelefonoMX(pD[1])) { const a = msg.substring(0, pD.index).toLowerCase(); if (!/[\$]|pesos|mxn|millon/i.test(a)) tel = pD[1]; } }
    res.telefono = tel;
    const eM = msg.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i); if (eM) res.email = eM[0].toLowerCase();
    const pN = [/mi nombre es\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)+)/i, /me llamo\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)+)/i, /soy\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)?)/i];
    for (const p of pN) { const m = msg.match(p); if (m && m[1]) { const pos = m[1].trim(); if (!contieneAlgunaPalabra(pos, ['casa', 'departamento', 'renta', 'servicio']) && pos.length >= 3) { res.nombre = pos.split(' ').map(x => x.charAt(0).toUpperCase() + x.slice(1)).join(' '); break; } } }
    if (contieneAlgunaPalabra(msgN, ["vivir", "habitar", "familia", "personal"])) res.uso = "Vivir"; else if (contieneAlgunaPalabra(msgN, ["inversion", "invertir", "negocio"])) res.uso = "Inversión";
    res.presupuesto = extraerPresupuestoAvanzado(mensaje);
    if (!res.ciudad) { for (const c of CIUDADES_MX) { if (msgN.includes(c)) { res.ciudad = c.charAt(0).toUpperCase() + c.slice(1); break; } } }
    if (!res.ciudad) { const cC = mensaje.match(/(?:en|zona|colonia|ubicación)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)?)/i); if (cC && cC[1]) { const ex = ['zona', 'colonia', 'ubicación', 'norte', 'sur', 'este', 'oeste']; if (!ex.includes(normalizarTexto(cC[1]))) res.ciudad = cC[1].charAt(0).toUpperCase() + cC[1].slice(1); } }
    return res;
};

/* ==========================================================
   MÁQUINAS DE ESTADO
========================================================== */
const FLUJO_PROPIEDAD = {
    transicionar: (m, e, mem) => {
        const ent = extraerEntidades(m);
        if (ent.ciudad && !mem.ciudad) mem.ciudad = ent.ciudad; if (ent.uso && !mem.uso) mem.uso = ent.uso; if (ent.presupuesto && !mem.presupuesto) mem.presupuesto = ent.presupuesto; if (ent.nombre && !mem.nombre) mem.nombre = ent.nombre; if (ent.telefono && !mem.telefono) mem.telefono = ent.telefono; if (ent.email && !mem.email) mem.email = ent.email;
        const dc = mem.nombre && mem.telefono;
        if (mem.ciudad && mem.uso && mem.presupuesto && !dc) return { nuevoEstado: 'esperando_datos', instruccion: 'pedir_datos' };
        if (mem.ciudad && mem.uso && !mem.presupuesto) return { nuevoEstado: 'esperando_presupuesto', instruccion: 'pedir_presupuesto' };
        if (mem.ciudad && !mem.uso) return { nuevoEstado: 'esperando_uso', instruccion: 'pedir_uso' };
        switch (e) { case 'inicio': if (mem.ciudad) return { nuevoEstado: 'esperando_uso', instruccion: 'pedir_uso' }; break; case 'esperando_ciudad': if (mem.ciudad) return { nuevoEstado: 'esperando_uso', instruccion: 'pedir_uso' }; break; case 'esperando_uso': if (mem.uso) return { nuevoEstado: 'esperando_presupuesto', instruccion: 'pedir_presupuesto' }; break; case 'esperando_presupuesto': if (mem.presupuesto) return { nuevoEstado: 'esperando_datos', instruccion: 'pedir_datos' }; break; case 'esperando_datos': if (dc) return { nuevoEstado: 'completado', instruccion: 'cerrar' }; break; }
        return null;
    }
};
const FLUJO_SERVICIO = {
    transicionar: (m, e, mem) => {
        const ent = extraerEntidades(m);
        if (ent.ciudad && !mem.ciudad) mem.ciudad = ent.ciudad; if (ent.nombre && !mem.nombre) mem.nombre = ent.nombre; if (ent.telefono && !mem.telefono) mem.telefono = ent.telefono; if (ent.email && !mem.email) mem.email = ent.email;
        const dc = mem.nombre && mem.telefono;
        if (mem.ciudad && dc) return { nuevoEstado: 'completado', instruccion: 'cerrar' };
        if (mem.ciudad && !dc) return { nuevoEstado: 'esperando_datos', instruccion: 'pedir_datos' };
        switch (e) { case 'inicio': if (mem.ciudad) return { nuevoEstado: 'esperando_datos', instruccion: 'pedir_datos' }; break; case 'esperando_ciudad': if (mem.ciudad) return { nuevoEstado: 'esperando_datos', instruccion: 'pedir_datos' }; break; case 'esperando_datos': if (dc) return { nuevoEstado: 'completado', instruccion: 'cerrar' }; break; }
        return null;
    }
};

const gestionarFlujo = (m, e, mem) => {
    if (!mem.tipoFlujo) { const det = detectarTipoServicio(m); if (det && det.servicio) { mem.servicio = det.servicio; mem.tipoFlujo = determinarTipoFlujo(det.servicio); logBot('SERVICIO_DETECTADO', { servicio: det.servicio, confianza: det.confianza }); return { nuevoEstado: 'esperando_ciudad', instruccion: 'explicar_servicio', servicioDetectado: det.servicio }; } return null; }
    return mem.tipoFlujo === 'propiedad' ? FLUJO_PROPIEDAD.transicionar(m, e, mem) : FLUJO_SERVICIO.transicionar(m, e, mem);
};

const RESPUESTAS_DIRECTAS = { 
    pedir_uso: ["¿Es para vivir o como inversión?"], 
    pedir_presupuesto: ["¿Cuál es tu presupuesto aproximado?"], 
    pedir_datos: ["Perfecto. Para que un asesor te contacte, ¿me compartes tu nombre, teléfono y correo?"],
    cerrar: [
        "¡Perfecto! Ya tengo tus datos. Un asesor se pondrá en contacto contigo pronto.",
        "Excelente. Un asesor te llamará próximamente para ayudarte.",
        "Listo, ya guardé tu información. Un asesor te contactará muy pronto."
    ]
};
const obtenerRespuestaDirecta = (i) => { const o = RESPUESTAS_DIRECTAS[i]; return o ? o[Math.floor(Math.random() * o.length)] : null; };

/* ==========================================================
   PROMPT DE MAX
========================================================== */
const generarPromptMax = (memoria, estado, instruccion, servicioInfo) => {
    let p = `REGLAS DE SEGURIDAD:
- SOLO español. NUNCA digas que eres IA.
- NUNCA inventes portales, procesos legales o métodos.
- Si el usuario habla de temas NO relacionados (deportes, clima, recetas, política), responde ÚNICAMENTE: "Puedo ayudarte únicamente con servicios inmobiliarios, administración y soporte de Vive Más. ¿Tienes alguna consulta sobre esto?"
- ANTI-ALUCINACIONES TÉCNICAS: Si el usuario pregunta por FUNCIONES TÉCNICAS de la plataforma que NO estén en tu información (ej: "carga masiva", "subir Excel", "APIs", "formato de carga", "migrar datos", "publicar masivo"), NUNCA las inventes. Di: "Actualmente no contamos con esa función. Te recomiendo escribir a soporte@SomosViveMas.com para ver opciones a la medida."
- Si el usuario muestra frustración ("no sirves", "no me ayudas"), discúlpate y ofrece hablar con un humano. NUNCA respondas de forma robótica.

Eres Max, asesor inmobiliario de Vive Más.`;
    
    if (servicioInfo) {
        p += `\n\n--- INFORMACIÓN EXACTA ---\nServicio: ${servicioInfo.nombre}\nPara quién: ${servicioInfo.objetivo}\nBeneficio: ${servicioInfo.beneficio}\nIncluye: ${servicioInfo.incluye.join(', ')}\n${servicioInfo.precio ? `Precio: ${servicioInfo.precio}` : (servicioInfo.requiereCotizacion ? 'Precio: Requiere cotización personalizada.' : '')}\nCTA: "${servicioInfo.cta}"\n--- FIN ---\nExplica esto destacando el BENEFICIO, usa el CTA y pregunta la ciudad.`;
    }

    p += `\n\nMEMORIA:\n✅ Servicio: ${memoria.servicio ? SERVICIOS_VIVE_MAS[memoria.servicio]?.nombre : 'Por detectar'}\n✅ Ciudad: ${memoria.ciudad || 'No'}\n`;
    if (memoria.tipoFlujo === 'propiedad') p += `✅ Uso: ${memoria.uso || 'No'}\n✅ Presupuesto: ${memoria.presupuesto || 'No'}\n`;
    p += `✅ Nombre: ${memoria.nombre || 'No'}\n✅ Tel: ${memoria.telefono || 'No'}\n✅ Email: ${memoria.email || 'No'}\n\nESTADO: ${estado}`;

    const inst = { 
        pedir_uso: "Confirma ciudad. Pregunta si es para vivir o inversión.", 
        pedir_presupuesto: "Confirma uso. Pregunta presupuesto.", 
        pedir_datos: "Confirma datos. Pide nombre, teléfono y email.", 
        explicar_servicio: "Explica servicio mencionando objetivo y beneficio. Usa CTA y pregunta ciudad.",
        cerrar: "Confirma datos del usuario. Dile que un asesor se contactará pronto. NO expliques el proceso.",
        esperar_ciudad: "Confirma brevemente que entendiste al usuario. Después pregunta en qué ciudad o zona busca la propiedad.",
        esperar_uso: "Confirma brevemente la ciudad. Después pregunta si la propiedad es para vivir o como inversión.",
        esperar_presupuesto: "Confirma brevemente el uso. Después pregunta cuál es su presupuesto aproximado."
    };
    
    if (inst[instruccion]) p += `\n\nINSTRUCCIÓN: ${inst[instruccion]}`;
    
    if (memoria.uso === 'No especificado' || memoria.presupuesto === 'No especificado') {
        p += `\n\n¡IMPORTANTE! El usuario previamente respondió "no importa" o similar para un dato. NO vuelvas a preguntar sobre ese tema. Avanza a la siguiente pregunta pendiente.`;
    }
    
    p += `\n\nFecha: ${getFechaActual()}`;
    return p;
};

/* ==========================================================
   RATE LIMITER
========================================================== */
const rateLimiter = { intentos: new Map(), MAX: 30, WINDOW: 15 * 60 * 1000, verificar(ip) { const a = Date.now(); const r = this.intentos.get(ip); if (!r || a - r.inicio > this.WINDOW) { this.intentos.set(ip, { inicio: a, c: 1 }); return { ok: true }; } if (r.c >= this.MAX) { logBot('RATE_LIMIT', { ip }); return { ok: false, msg: `Intenta en ${Math.ceil((this.WINDOW - (a - r.inicio)) / 60000)} min.` }; } r.c++; return { ok: true }; } };
setInterval(() => { const a = Date.now(); for (const [ip, r] of rateLimiter.intentos.entries()) if (a - r.inicio > rateLimiter.WINDOW) rateLimiter.intentos.delete(ip); }, 3600000);

/* ==========================================================
   CONTROLADORES
========================================================== */
const chatSoporte = async (req, res) => {
    try {
        const { mensaje, historial = [] } = req.body;
        if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });
        const ip = req.headers["x-forwarded-for"]?.split(',')[0] || req.socket.remoteAddress;
        const rate = rateLimiter.verificar(ip); if (!rate.ok) return res.status(429).json({ error: rate.msg });
        if (mensaje.length > 1000) return res.json({ ok: true, respuesta: "¿Podrías resumirme tu consulta? 😊", tipo: 'soporte', esLead: false });

        if (contieneAlgunaPalabra(mensaje, ["hablar con alguien", "asesor humano", "llamame"])) { logBot('TRANSFERENCIA_A_HUMANO', { bot: 'Vivi' }); return res.json({ ok: true, respuesta: "Claro, con gusto. ¿Me compartes tu nombre y teléfono para conectararte?", tipo: 'soporte', esLead: true }); }
        if (/^(hola|buenos días|buenas tardes|buenas noches)[\s!.,]*$/i.test(mensaje.trim()) && historial.length === 0) return res.json({ ok: true, respuesta: "¡Hola! 😊 ¿En qué te puedo ayudar hoy?", tipo: 'soporte', esLead: false });
        
        for (const config of Object.values(SOLUCIONES_SOPORTE)) { if (contieneAlgunaPalabra(mensaje, config.palabras)) return res.json({ ok: true, respuesta: config.solucion, tipo: 'soporte', esLead: false }); }

        const SISTEMA_VIVI = `Eres Vivi, soporte de Vive Más. PROHIBIDO: Inglés. TEMAS: Login, planes, publicar. Fuera de tema: "Puedo ayudarte únicamente con servicios inmobiliarios, administración y soporte de Vive Más."`;
        const messages = [{ role: "system", content: SISTEMA_VIVI + `\nFecha: ${getFechaActual()}` }, ...historial.filter(h => h.role === "user" || h.role === "assistant").slice(-10).map(h => ({ role: h.role, content: h.text || h.content })), { role: "user", content: mensaje }];
        
        const completion = await groq.chat.completions.create({ ...CONFIG_VIVI, messages });
        let respuesta = completion.choices?.[0]?.message?.content?.trim() || "¿Podrías repetirlo?";
        if (/(regarding|about|please|sorry)/i.test(respuesta)) { const r2 = await groq.chat.completions.create({ ...CONFIG_VIVI, messages: [...messages, {role:"assistant", content:respuesta}, {role:"user", content:"SOLO español."}], temperature: 0.2 }); const fix = r2.choices?.[0]?.message?.content?.trim(); if (fix && !/(regarding|please)/i.test(fix)) respuesta = fix; else respuesta = "Entiendo. ¿Podrías darme más detalles? 😊"; }
        
        return res.json({ ok: true, respuesta: respuesta.replace(/¿Hay algo más.*?\?/gi, '').replace(/\n{3,}/g, "\n\n").trim(), tipo: "soporte", esLead: /nombre|telefono|contactar/i.test((respuesta + " " + mensaje).toLowerCase()) });
    } catch (error) { logBot('ERROR_VALIDACION', { bot: 'Vivi', error: error.message }); return res.status(500).json({ ok: false, respuesta: "Hubo un problema técnico. Escribe a soporte@SomosViveMas.com. 😊", tipo: "soporte", esLead: false }); }
};

const chatServicios = async (req, res) => {
    try {
        const { mensaje, historial = [], estado: estadoActual = 'inicio', memoria: memoriaRaw = {} } = req.body;
        if (!mensaje) return res.status(400).json({ error: "Mensaje requerido" });
        const ip = req.headers["x-forwarded-for"]?.split(',')[0] || req.socket.remoteAddress;
        const rate = rateLimiter.verificar(ip); if (!rate.ok) return res.status(429).json({ error: rate.msg });
        if (mensaje.length > 1000) return res.json({ ok: true, respuesta: "¿Podrías resumirme tu consulta? 😊", tipo: "servicios", esLead: false, estado: estadoActual, memoria: memoriaRaw });

        const memoriaCompleta = sanitizarMemoria(memoriaRaw);

        // MANEJO INTELIGENTE DE INTENCIONES (Sin pasar al LLM)
        
        // 1. Despedidas
        if (contieneAlgunaPalabra(mensaje, ["gracias", "muchas gracias", "adios", "adiós", "nos vemos", "bye", "hasta luego", "que tengas buen dia"])) {
            logBot('DESPEDIDA_DETECTADA', { msg: mensaje.substring(0, 30) });
            return res.json({ ok: true, respuesta: "¡Hasta luego! Si necesitas algo más en el futuro, aquí estaré. ¡Que tengas un excelente día! 😊", tipo: "servicios", esLead: false, estado: estadoActual, memoria: memoriaCompleta });
        }

        // 2. Frustración directa
        if (contieneAlgunaPalabra(mensaje, ["no sirves", "no me sirves", "eres inutil", "eres inútil", "no sabes", "no me ayudaste", "malo", "pesimo", "pésimo"])) {
            logBot('FRUSTRACION_DETECTADA', { msg: mensaje.substring(0, 30) });
            return res.json({ ok: true, respuesta: "Lamento mucho no haber podido ayudarte como esperabas. Si quieres, puedo conectarte con un asesor humano que tal vez tenga una solución diferente para ti. ¿O prefieres intentar con otra consulta?", tipo: "servicios", esLead: true, redireccion: { tipo: "humano" }, estado: estadoActual, memoria: memoriaCompleta });
        }

        // 3. Preguntas técnicas inexistentes
        if (contieneAlgunaPalabra(mensaje, ["carga masiva", "publicacion masiva", "publicación masiva", "formato excel", "formato de carga", "plantilla excel", "api de propiedades", "integracion", "integración", "importar propiedades", "migrar propiedades"])) {
            logBot('ALUCINACION_TECNICA_BLOQUEADA', { msg: mensaje.substring(0, 40) });
            return res.json({ ok: true, respuesta: "Actualmente nuestra plataforma no cuenta con una función de carga masiva por Excel o API. Las propiedades se publican de forma individual desde el panel de usuario. Si tienes un volumen muy alto de propiedades, te recomiendo contactar a soporte en **soporte@SomosViveMas.com** para evaluar opciones a la medida. ¿Te puedo ayudar con algo más?", tipo: "servicios", esLead: false, estado: estadoActual, memoria: memoriaCompleta });
        }

        // 4. Preguntas sobre la plataforma
        if (contieneAlgunaPalabra(mensaje, ["como publico", "cómo publico", "como creo cuenta", "cómo creo cuenta", "quiero publicar propiedad", "subir propiedad", "dar de alta"])) {
            logBot('CONSULTA_PLATAFORMA');
            return res.json({ ok: true, respuesta: "Para publicar propiedades en Vive Más, primero debes crear tu cuenta en nuestra plataforma desde la página principal. Una vez dentro de tu panel, puedes agregar tus propiedades individualmente llenando los datos y subiendo las fotos. Si tienes dudas sobre los planes disponibles, con gusto te las explico. ¿Te gustaría saber sobre nuestros planes?", tipo: "servicios", esLead: false, estado: estadoActual, memoria: memoriaCompleta });
        }

        // 5. PETICIÓN DIRECTA DE ASESOR
        const quiereAsesorExplicito = contieneAlgunaPalabra(mensaje, [
            "quiero un asesor", "me gustaria un asesor", "me gustaría un asesor", 
            "necesito un asesor", "asignar asesor", "hablar con asesor", "contactar asesor",
            "comunicarme con alguien", "que me contacten"
        ]);
        
        const respuestaAfirmativaCorta = /^(si|sip|ok|claro|dale|vale|bueno|sí)[\s!.,]*$/i.test(mensaje.trim());

        if ((quiereAsesorExplicito || respuestaAfirmativaCorta) && !memoriaCompleta.nombre && !memoriaCompleta.telefono) {
            logBot('PETICION_ASESOR_SIN_DATOS', { msg: mensaje.substring(0, 30) });
            return res.json({ 
                ok: true, 
                respuesta: "Perfecto. Para que un asesor te contacte de inmediato, ¿me compartes tu nombre completo y un número de teléfono?", 
                tipo: "servicios", 
                esLead: false, 
                estado: 'esperando_datos',
                memoria: memoriaCompleta 
            });
        }

        if ((quiereAsesorExplicito || respuestaAfirmativaCorta) && memoriaCompleta.nombre && memoriaCompleta.telefono && !memoriaCompleta.leadGuardado) {
            logBot('ASESOR_DIRECTO_CON_DATOS', { nombre: memoriaCompleta.nombre });
            const folio = memoriaCompleta.folio || generarFolio();
            memoriaCompleta.folio = folio;
            memoriaCompleta.leadGuardado = true;
            
            try {
                await Lead.create({ 
                    nombre: memoriaCompleta.nombre, 
                    telefono: memoriaCompleta.telefono, 
                    email: memoriaCompleta.email, 
                    servicio: SERVICIOS_VIVE_MAS[memoriaCompleta.servicio]?.nombre || 'Asesoría general', 
                    tipo: memoriaCompleta.tipoFlujo || 'servicio', 
                    conversacion: JSON.stringify(historial.slice(-20)), 
                    ip, 
                    ciudad: memoriaCompleta.ciudad, 
                    pais: "México", 
                    folio 
                });
            } catch (e) { logBot('ERROR_VALIDACION', { error: e.message }); }
            
            return res.json({ 
                ok: true, 
                respuesta: `¡Listo ${memoriaCompleta.nombre}! Un asesor te contactará muy pronto.\n\n📋 Tu número de solicitud es: *${folio}*\n\n¿Necesitas algo más?`, 
                tipo: "servicios", 
                esLead: true, 
                estado: 'completado', 
                memoria: memoriaCompleta 
            });
        }

        // 6. Manejo de baja confianza en servicios
        if (!memoriaCompleta.servicio) {
            const deteccion = detectarTipoServicio(mensaje);
            if (deteccion && deteccion.aclarar) {
                logBot('INTENCION_DESCONOCIDA', { sugerencias: deteccion.sugerencias });
                const listaSugerencias = deteccion.sugerencias.join(' o ');
                return res.json({ ok: true, respuesta: `¿Te refieres al servicio de ${listaSugerencias}? Para poder darte la información correcta, me ayudas a confirmar. 😊`, tipo: "servicios", esLead: false, estado: estadoActual, memoria: memoriaCompleta });
            }
        }

        // Preguntar por PRECIO usando datos estructurados
        if (memoriaCompleta.servicio && esPreguntaDePrecio(mensaje)) {
            const servicio = SERVICIOS_VIVE_MAS[memoriaCompleta.servicio];
            if (servicio) {
                const respPrecio = servicio.precio ? `${servicio.precio} ${servicio.cta}` : `El costo de ${servicio.nombre} depende de las características específicas y requiere cotización personalizada. ${servicio.cta}`;
                return res.json({ ok: true, respuesta: respPrecio, tipo: "servicios", esLead: false, estado: estadoActual, memoria: memoriaCompleta });
            }
        }

        // Buscar en FAQ usando sinónimos
        if (memoriaCompleta.servicio) {
            const respFAQ = buscarEnFAQ(mensaje, memoriaCompleta.servicio);
            if (respFAQ) {
                const servicio = SERVICIOS_VIVE_MAS[memoriaCompleta.servicio];
                return res.json({ ok: true, respuesta: `${respFAQ}\n\n${servicio.cta}`, tipo: "servicios", esLead: false, estado: estadoActual, memoria: memoriaCompleta });
            }
        }

        const decisionFlujo = gestionarFlujo(mensaje, estadoActual, memoriaCompleta);
        let nuevoEstado = estadoActual, respuesta, usoLLM = true, instruccionActual = null, servicioInfo = null;

        if (decisionFlujo) {
            nuevoEstado = decisionFlujo.nuevoEstado;
            instruccionActual = decisionFlujo.instruccion;
            if (decisionFlujo.servicioDetectado) servicioInfo = SERVICIOS_VIVE_MAS[decisionFlujo.servicioDetectado];
            if (['pedir_uso', 'pedir_presupuesto', 'pedir_datos', 'cerrar'].includes(instruccionActual)) { respuesta = obtenerRespuestaDirecta(instruccionActual); usoLLM = false; }
        }

        if (usoLLM) {
            const systemPrompt = generarPromptMax(memoriaCompleta, nuevoEstado, instruccionActual, servicioInfo);
            const messages = [{ role: "system", content: systemPrompt }, ...historial.filter(h => h.role === "user" || h.role === "assistant").slice(-8).map(h => ({ role: h.role, content: h.text || h.content })), { role: "user", content: mensaje }];
            const completion = await groq.chat.completions.create({ ...CONFIG_MAX, messages });
            respuesta = completion.choices?.[0]?.message?.content?.trim() || "¿Podrías contarme un poco más?";
            respuesta = respuesta.replace(/¿Hay algo más.*?\?/gi, "").replace(/\n{3,}/g, "\n\n").trim();
        }

        // Generar folio si tenemos datos completos
        const tieneDatosCompletos = memoriaCompleta.nombre && memoriaCompleta.telefono;
        const llmIntentoCerrar = contieneAlgunaPalabra(respuesta, ["contactara pronto", "te contactara", "te llamar", "te llamaremos", "te pondra en contacto"]);
        
        if ((nuevoEstado === 'completado' || llmIntentoCerrar) && tieneDatosCompletos && !memoriaCompleta.leadGuardado) {
            const folio = memoriaCompleta.folio || generarFolio();
            memoriaCompleta.folio = folio;
            memoriaCompleta.leadGuardado = true;
            
            try {
                await Lead.create({ 
                    nombre: memoriaCompleta.nombre, 
                    telefono: memoriaCompleta.telefono, 
                    email: memoriaCompleta.email, 
                    servicio: SERVICIOS_VIVE_MAS[memoriaCompleta.servicio]?.nombre || 'Asesoría general', 
                    tipo: memoriaCompleta.tipoFlujo || 'servicio', 
                    conversacion: JSON.stringify(historial.slice(-20)), 
                    ip, 
                    ciudad: memoriaCompleta.ciudad, 
                    pais: "México", 
                    folio 
                });
                
                if (!nuevoEstado || nuevoEstado !== 'completado') nuevoEstado = 'completado';
                
                if (!respuesta.includes(folio)) {
                    respuesta += `\n\n📋 Tu número de solicitud es: *${folio}*`;
                }
                logBot('LEAD_COMPLETO', { folio, servicio: memoriaCompleta.servicio });
            } catch (e) { 
                logBot('ERROR_VALIDACION', { error: e.message }); 
                if (!respuesta.includes(folio)) respuesta += `\n\n📋 Tu número de solicitud es: *${folio}*`; 
            }
        }

        return res.json({ ok: true, respuesta, tipo: "servicios", esLead: nuevoEstado === 'completado', estado: nuevoEstado, memoria: memoriaCompleta });
    } catch (error) { logBot('ERROR_VALIDACION', { bot: 'Max', error: error.message }); return res.status(500).json({ error: "Error al procesar." }); }
};

const guardarLead = async (req, res) => {
    try {
        const { nombre, telefono, email, servicio } = req.body;
        if (!nombre || !telefono) return res.status(400).json({ error: "Nombre y teléfono requeridos" });
        if (!validarTelefonoMX(telefono)) return res.status(400).json({ error: "Teléfono inválido." });
        const folio = generarFolio();
        const lead = await Lead.create({ nombre, telefono: telefono.replace(/\D/g,''), email, servicio, folio, pais: "México" });
        logBot('DATOS_CAPTURADOS', { folio, origen: 'manual' });
        res.json({ ok: true, mensaje: "Lead guardado.", lead, folio });
    } catch (error) { logBot('ERROR_VALIDACION', { error: error.message }); res.status(500).json({ error: error.message }); }
};

module.exports = { chatSoporte, chatServicios, guardarLead, rateLimiter };