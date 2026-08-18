const readline = require('readline');
const { exec } = require('child_process');
const OpenAI = require('openai');

// PON TU API KEY AQUÍ
const openai = new OpenAI({ apiKey: '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' }); 

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

// MÉTODO 1: Extracción con IA (Inteligente)
async function extractDataWithIA(fbText) {
  const prompt = `
    Eres un asistente inmobiliario. Analiza este texto de Facebook y extrae SOLO un JSON con estas claves:
    - ubicacion (string, ej: Polanco, CDMX)
    - precio_estimado (string, ej: $15000. Si no dice pon "No especificado")
    - tipo_propiedad (string: "Casa", "Departamento", "Habitación", "Local", etc)
    
    Texto:
    "${fbText}"
    
    Responde SOLO con el JSON.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  let jsonStr = response.choices[0].message.content.trim();
  if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/```json?|```/g, '').trim();
  return JSON.parse(jsonStr);
}

// MÉTODO 2: Extracción local (Gratis, de emergencia)
function extractDataLocally(fbText) {
  let ubicacion = "No especificada", precio_estimado = "No especificado", tipo_propiedad = "Propiedad";
  const zonas = ['Roma', 'Condesa', 'Polanco', 'Coyoacán', 'Juárez', 'Cuauhtémoc', 'Nápoles', 'Del Valle', 'Toluca', 'Querétaro', 'Monterrey', 'Guadalajara', 'Mérida', 'Cancún', 'Puebla'];
  for (let zona of zonas) { if (fbText.toLowerCase().includes(zona.toLowerCase())) { ubicacion = zona; break; } }
  const priceMatch = fbText.match(/\$?\s*([\d,]+)\s*(mxn|pesos|mx|mes|mil)?/i);
  if (priceMatch && !fbText.toLowerCase().includes('m2')) precio_estimado = "$" + priceMatch[1].replace(',', '');
  if (fbText.toLowerCase().includes('departamento') || fbText.toLowerCase().includes('depa')) tipo_propiedad = "Departamento";
  else if (fbText.toLowerCase().includes('casa')) tipo_propiedad = "Casa";
  else if (fbText.toLowerCase().includes('habitación') || fbText.toLowerCase().includes('cuarto')) tipo_propiedad = "Habitación";
  return { ubicacion, precio_estimado, tipo_propiedad };
}

function generateWhatsAppLink(phone, message) {
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.startsWith('52') && cleanPhone.length === 12) {}
  else if (cleanPhone.length === 10) cleanPhone = '52' + cleanPhone;
  else if (cleanPhone.startsWith('5252')) cleanPhone = cleanPhone.substring(2);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

async function main() {
  console.log("\n=====================================================");
  console.log("🤖 BOT CAZADOR HÍBRIDO (IA + Respaldo Local)");
  console.log("=====================================================\n");

  const fbText = await ask("1. Pega el texto de Facebook:\n> ");
  if (!fbText || fbText.trim().length < 15) { console.log("❌ Texto muy corto."); rl.close(); return; }

  console.log("\n⏳ Analizando...");
  let data;

  try {
    // INTENTA USAR IA PRIMERO
    data = await extractDataWithIA(fbText);
    console.log("🧠 Análisis hecho con Inteligencia Artificial.");
  } catch (error) {
    // SI LA IA FALLA (SIN SALDO, ETC), USA EL MÉTODO GRATIS
    console.log("⚠️ IA no disponible, usando extractor local...");
    data = extractDataLocally(fbText);
  }

  console.log(`\n✅ Datos extraídos:`);
  console.log(`   -> Tipo: ${data.tipo_propiedad}`);
  console.log(`   -> Ubicación: ${data.ubicacion}`);
  console.log(`   -> Precio: ${data.precio_estimado}`);

  const phone = await ask(`\n2. WhatsApp del publicador:\n> `);
  if (!phone || phone.replace(/\D/g, '').length < 10) { console.log("❌ Número inválido."); rl.close(); return; }

  const linkRegistro = "http://localhost:3000/admin/agentes-fundadores"; // Cambia a tu dominio real

  const mensaje = `Hola, vi tu publicación del ${data.tipo_propiedad} en ${data.ubicacion} (${data.precio_estimado}). 
  
Te escribo porque en SomosViveMas armamos una herramienta 100% gratis para asesores. Subes tu propiedad y el sistema te genera automáticamente una "ficha profesional" en imagen para WhatsApp. 

Toma 1 minuto probarla aquí: ${linkRegistro}

¡Saludos!`;

  const waLink = generateWhatsAppLink(phone, mensaje);
  console.log("\n🚀 Abriendo WhatsApp...");

  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(command + ' ' + waLink, (err) => {
    if (err) { console.log("👉 Copia este enlace manualmente:\n" + waLink); }
    rl.close();
  });
}

main();