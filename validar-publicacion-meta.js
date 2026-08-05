// ==========================================
// VALIDADOR DE PUBLICACIÓN EN META (Facebook/Instagram)
// ==========================================
// Diagnostica el flujo de publicación automática en redes sociales.
// Escribe el resultado en validacion-meta-resultado.txt (ruta absoluta).
// NO publica nada: solo contrasta credenciales y estado. Seguro de ejecutar.
//
// Uso:  node validar-publicacion-meta.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const SocialConfig = require('./src/models/SocialConfig');
const Property = require('./src/models/Property');
const metaConfig = require('./services/marketingAutomation/config/meta.config');

const LOG_FILE = path.join(__dirname, 'validacion-meta-resultado.txt');
const SEP = '='.repeat(70);

const line = (t) => {
  const msg = '  ' + t;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, msg + '\n', 'utf8');
};
const header = (t) => {
  const block = '\n' + SEP + '\n' + t + '\n' + SEP + '\n';
  console.log(block);
  fs.appendFileSync(LOG_FILE, block, 'utf8');
};

fs.writeFileSync(LOG_FILE, '', 'utf8');

const callGraph = async (url) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const json = await res.json();
    return { httpStatus: res.status, json };
  } catch (e) {
    return { httpStatus: 0, json: { error: { message: e.message } } };
  }
};

const probarToken = async (token, etiqueta) => {
  header('PROBANDO TOKEN: ' + etiqueta);
  if (!token || token === '') {
    line('Token vacio/ausente. No se puede validar.');
    line('  -> Configura META_TEST_*_TOKEN en .env o conecta la cuenta via OAuth.');
    return null;
  }
  const mascara = token.length > 12 ? token.slice(0, 6) + '...' + token.slice(-4) : '***';
  line('Token: ' + mascara + ' (' + token.length + ' chars)');

  const { httpStatus, json } = await callGraph(
    metaConfig.baseUrl + '/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=' + token
  );

  if (!json || json.error) {
    line('TOKEN INVALIDO o EXPIRADO');
    line('   HTTP ' + httpStatus);
    line('   Codigo: ' + (json && json.error ? json.error.code : 'N/A'));
    line('   Mensaje: ' + (json && json.error ? json.error.message : 'Sin mensaje'));
    return { valido: false, httpStatus, error: json ? json.error : null };
  }

  const cuentas = json.data || [];
  line('TOKEN VALIDO - HTTP ' + httpStatus);
  line('   Paginas asociadas: ' + cuentas.length);
  for (const page of cuentas) {
    const igId = page.instagram_business_account ? page.instagram_business_account.id : null;
    line('   Pagina: ' + page.name + ' (id: ' + page.id + ')' + (igId ? ' | IG: ' + igId : ' | sin IG'));
    if (page.id === metaConfig.facebook.pageId) {
      line('      <= Esta es la pagina configurada');
    }
  }
  return { valido: true, httpStatus, cuentas };
};

const run = async () => {
  header('VALIDADOR DE PUBLICACION EN META (Facebook/Instagram)');

  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 10000 });
    line('Conectado a MongoDB');
  } catch (e) {
    line('No se pudo conectar a MongoDB: ' + e.message);
    process.exit(1);
  }

  header('CONFIGURACION DE META');
  line('App ID: ' + metaConfig.appId);
  line('API Version: ' + metaConfig.apiVersion);
  line('Base URL: ' + metaConfig.baseUrl);
  line('Pagina FB: ' + metaConfig.facebook.pageId + ' (' + metaConfig.facebook.pageName + ')');
  line('IG Business: ' + metaConfig.instagram.businessAccountId + ' (@' + metaConfig.instagram.username + ')');

  header('SOCIAL CONFIG EN BASE DE DATOS');
  const configs = await SocialConfig.find({});
  if (configs.length === 0) {
    line('NO hay ninguna SocialConfig en la BD.');
    line('   -> El flujo usaria el fallback metaConfig.testTokens.pageAccessToken.');
  } else {
    for (const c of configs) {
      const conectada = c.isConnected ? 'CONECTADA' : 'DESCONECTADA';
      line('* tenant: ' + c.tenantId + ' | ' + conectada);
      line('   FB pageId: ' + (c.facebook ? c.facebook.pageId : '-'));
      const pt = c.facebook ? c.facebook.pageAccessToken : null;
      line('   FB token: ' + (pt ? pt.slice(0, 6) + '...' + pt.slice(-4) : '-'));
      line('   FB token expira: ' + (c.facebook && c.facebook.pageTokenExpiresAt ? c.facebook.pageTokenExpiresAt : '-'));
      line('   IG id: ' + (c.instagram ? c.instagram.businessAccountId : '-'));
    }
  }

  const configActiva = configs.find(function (c) { return c.isConnected; });
  const tokenAUsar = (configActiva && configActiva.facebook && configActiva.facebook.pageAccessToken) || metaConfig.testTokens.pageAccessToken;
  const origenToken = configActiva ? 'BD (SocialConfig)' : 'FALLBACK (testTokens)';
  header('TOKEN EFECTIVO QUE SE USARIA');
  line('Origen: ' + origenToken);

  const resultado = await probarToken(tokenAUsar, origenToken);

  header('PROPIEDADES APROBADAS');
  const aprobadas = await Property.find({ status: 'aprobada' }).limit(20);
  line('Aprobadas (muestra max 20): ' + aprobadas.length);
  const conFotos = aprobadas.filter(function (p) { return (p.fotos || []).length >= 1; });
  line('Con al menos 1 foto: ' + conFotos.length);
  line('Sin fotos: ' + (aprobadas.length - conFotos.length));

  let fotosValidas = 0, fotosInvalidas = 0;
  for (const p of aprobadas.slice(0, 10)) {
    const foto = p.fotos ? p.fotos[0] : null;
    const redes = [];
    if (p.operacion === 'renta') redes.push('FB');
    if (p.operacion === 'venta') redes.push('IG');
    const sm = p.socialMedia || {};
    let estadoFoto = '-';
    if (foto) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(function () { controller.abort(); }, 10000);
        const res = await fetch(foto, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) { fotosValidas++; estadoFoto = 'accesible'; }
        else { fotosInvalidas++; estadoFoto = 'HTTP ' + res.status; }
      } catch (e) {
        fotosInvalidas++;
        estadoFoto = e.message;
      }
    } else {
      fotosInvalidas++;
      estadoFoto = 'sin foto';
    }
    const fbStatus = (sm.facebook && sm.facebook.status) || 'pending';
    const igStatus = (sm.instagram && sm.instagram.status) || 'pending';
    line('* ' + p.titulo.slice(0, 40) + ' | op:' + p.operacion + ' ->[' + redes.join(',') + '] | foto:' + estadoFoto);
    line('   FB:' + fbStatus + ' | IG:' + igStatus);
  }
  line('Resumen fotos: ' + fotosValidas + ' validas, ' + fotosInvalidas + ' invalidas/sin foto');

  header('SIMULACION DE LA LOGICA DE PUBLICACION');
  const propRenta = aprobadas.find(function (p) { return p.operacion === 'renta'; });
  const propVenta = aprobadas.find(function (p) { return p.operacion === 'venta'; });
  const simular = function (prop) {
    if (!prop) return 'no hay propiedad de este tipo aprobada';
    const plataforma = prop.operacion === 'renta' ? 'facebook' : 'instagram';
    const ok = prop.status === 'aprobada' && (prop.fotos || []).length >= 1;
    return '-> ' + prop.operacion + ' => ' + plataforma + ' | ' + (ok ? 'pasaria condiciones' : 'fallaria');
  };
  line('Renta (->Facebook):  ' + simular(propRenta));
  line('Venta (->Instagram): ' + simular(propVenta));

  if (resultado && resultado.valido) {
    const pageConfig = resultado.cuentas.find(function (p) { return p.id === metaConfig.facebook.pageId; });
    const igId = pageConfig && pageConfig.instagram_business_account ? pageConfig.instagram_business_account.id : null;
    header('INSTAGRAM BUSINESS');
    if (igId) {
      line('La pagina tiene IG Business id: ' + igId);
      line('Coincide: ' + (igId === metaConfig.instagram.businessAccountId ? 'SI' : 'NO - revisa meta.config.js'));
    } else {
      line('La pagina NO tiene Instagram Business vinculado.');
    }
  }

  await mongoose.disconnect();
  header('DIAGNOSTICO COMPLETADO');
  line('Resultado en: ' + LOG_FILE);
  process.exit(0);
};

run().catch(function (e) {
  console.error('Error fatal: ' + e.message);
  fs.appendFileSync(LOG_FILE, '\nERROR FATAL: ' + e.message + '\n', 'utf8');
  mongoose.disconnect();
  process.exit(1);
});
