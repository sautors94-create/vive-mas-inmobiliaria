const Groq = require('groq-sdk');

if (!process.env.GROQ_API_KEY) throw new Error('❌ FATAL: Falta GROQ_API_KEY');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// qwen/qwen3.6-27b es, al momento de escribir esto, el único modelo con
// visión disponible en Groq (los anteriores —llama-4-scout/maverick,
// llama-3.3-70b-versatile— fueron dados de baja en 2026). Groq lo sirve
// como "preview", no como modelo de producción garantizada; si Groq lo
// retira, este agente cae automáticamente a BLOCKED_FOR_REVIEW (ver abajo)
// en vez de tronar o aprobar a ciegas.
const MODELO_VISION = 'qwen/qwen3.6-27b';
const MAX_IMAGENES = 5; // límite conservador de imágenes por análisis

const SYSTEM_PROMPT = `Eres un Agente de Inteligencia Artificial especializado en la moderación y validación de publicaciones inmobiliarias para Vive Más Inmobiliaria.

Tu responsabilidad es proteger la calidad, seguridad y confiabilidad de la plataforma. Tu prioridad NO es aprobar propiedades; tu prioridad es detectar cualquier anomalía antes de que una propiedad sea publicada. Si existe cualquier duda razonable, debes enviar la propiedad a revisión por un administrador humano. Nunca inventes información. Nunca asumas datos que no existen. Nunca ignores inconsistencias.

Recibirás: los datos de texto de la propiedad, los "issues" ya detectados por un validador automático de reglas (Agente de Validación), el historial del propietario en la plataforma, y hasta ${MAX_IMAGENES} imágenes de la propiedad.

Analiza las imágenes con atención (usa tu capacidad de visión, incluyendo OCR de cualquier texto visible en ellas) y evalúa el conjunto completo:

IMÁGENES — envía a revisión si detectas: capturas de pantalla, flyers, publicidad, banners, renders como única imagen, imágenes generadas por IA que aparenten ser fotografías reales, memes, dibujos, logos gigantes, fotos oscuras/blancas/negras/borrosas/pixeladas, imágenes sin relación con una propiedad inmobiliaria, texto visible con teléfonos/WhatsApp/redes sociales/URLs/emails/códigos QR, marcas de agua o publicidad ocupando parte importante de la imagen, lenguaje ofensivo o contenido inapropiado, personas como elemento principal de la foto, menores claramente identificables, documentos personales visibles, o cualquier señal de que las fotos fueron tomadas de internet/otra publicación/banco de imágenes en vez de ser reales.

COHERENCIA — verifica que las imágenes correspondan con la descripción (ej. si la descripción dice "casa de dos pisos" pero las fotos muestran un terreno vacío, es una inconsistencia grave).

HISTORIAL DEL USUARIO — considera su historial: cuentas nuevas con contenido sospechoso, usuarios con rechazos o bloqueos previos, o patrones de publicaciones duplicadas son señales de mayor riesgo.

Solo puedes decidir APPROVED cuando no hay inconsistencias, las imágenes son válidas y reales, no hay información de contacto filtrada, la dirección y precio parecen razonables, y el riesgo general es bajo. En cualquier otro caso: BLOCKED_FOR_REVIEW. Ante la duda, NO apruebes — es preferible enviar una publicación válida a revisión humana que aprobar automáticamente una publicación fraudulenta o que incumpla las políticas.

Responde ÚNICAMENTE con un JSON con esta forma exacta, sin texto adicional antes ni después:
{
  "decision": "APPROVED" | "BLOCKED_FOR_REVIEW",
  "confidence": 0.00,
  "risk_score": 0,
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "summary": "Resumen corto del análisis en español.",
  "issues": [
    { "severity": "LOW" | "MEDIUM" | "HIGH", "category": "TEXT|TITLE|PRICE|ADDRESS|IMAGES|OCR|USER|DUPLICATE|FRAUD", "field": "nombre del campo o número de imagen", "message": "descripción clara del problema, en español" }
  ]
}`;

const construirMensajeUsuario = ({ propiedad, issuesAgente1, historialUsuario }) => {
  const datos = {
    titulo: propiedad.titulo,
    descripcion: propiedad.descripcion,
    operacion: propiedad.operacion,
    tipo: propiedad.tipo,
    precio: propiedad.precio,
    ubicacion: propiedad.ubicacion,
    caracteristicas: propiedad.caracteristicas,
    cantidad_fotos: propiedad.fotos?.length || 0,
  };
  return `DATOS DE LA PROPIEDAD:\n${JSON.stringify(datos, null, 2)}\n\nISSUES DETECTADOS POR EL AGENTE DE VALIDACIÓN (reglas automáticas, no definitivos):\n${JSON.stringify(issuesAgente1, null, 2)}\n\nHISTORIAL DEL PROPIETARIO:\n${JSON.stringify(historialUsuario, null, 2)}\n\nAnaliza las imágenes adjuntas junto con estos datos y responde con el JSON de decisión.`;
};

const respuestaPorDefectoAntesFallo = (motivo) => ({
  decision: 'BLOCKED_FOR_REVIEW',
  confidence: 0,
  risk_score: 100,
  risk_level: 'HIGH',
  summary: `No se pudo completar el análisis automático (${motivo}). Enviada a revisión humana por precaución.`,
  issues: [{ severity: 'MEDIUM', category: 'FRAUD', field: 'sistema', message: `El agente de moderación no pudo evaluar la propiedad (${motivo}). Requiere revisión manual.` }],
});

const moderarPropiedadConIA = async ({ propiedad, issuesAgente1, historialUsuario }) => {
  try {
    const fotos = (propiedad.fotos || []).slice(0, MAX_IMAGENES);
    const contenido = [
      { type: 'text', text: construirMensajeUsuario({ propiedad, issuesAgente1, historialUsuario }) },
      ...fotos.map(url => ({ type: 'image_url', image_url: { url } })),
    ];

    const completion = await groq.chat.completions.create({
      model: MODELO_VISION,
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: contenido },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) return respuestaPorDefectoAntesFallo('respuesta vacía del modelo');

    const parsed = JSON.parse(raw);
    if (!['APPROVED', 'BLOCKED_FOR_REVIEW'].includes(parsed.decision)) {
      return respuestaPorDefectoAntesFallo('respuesta del modelo con formato inesperado');
    }
    return parsed;
  } catch (error) {
    console.error('❌ Error en agente de moderación IA:', error.message);
    return respuestaPorDefectoAntesFallo('error técnico al analizar la propiedad');
  }
};

module.exports = { moderarPropiedadConIA, MODELO_VISION };