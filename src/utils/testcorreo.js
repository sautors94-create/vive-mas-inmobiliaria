const nodemailer = require('nodemailer');

const pruebas = [
  { nombre: 'Prueba 1: Puerto 465 SSL', host: 'smtp.hostinger.com', port: 465, secure: true },
  { nombre: 'Prueba 2: Puerto 587 STARTTLS', host: 'smtp.hostinger.com', port: 587, secure: false },
  { nombre: 'Prueba 3: Puerto 465 SSL sin secure', host: 'smtp.hostinger.com', port: 465, secure: false },
  { nombre: 'Prueba 4: Puerto 2525', host: 'smtp.hostinger.com', port: 2525, secure: false },
];

async function probar() {
  const user = 'contacto@somosvivemas.com';
  const pass = 'PEGA_AQUI_TU_CONTRASENA_DE_APLICACION';

  for (const p of pruebas) {
    console.log(`\n--- ${p.nombre} ---`);
    try {
      const t = nodemailer.createTransport({
        host: p.host,
        port: p.port,
        secure: p.secure,
        auth: { user, pass },
      });
      await t.verify();
      console.log('✅ FUNCIONÓ');
      return;
    } catch (err) {
      console.log('❌', err.message);
    }
  }
  console.log('\nNinguna funcionó');
}

probar();