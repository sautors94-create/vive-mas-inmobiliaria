const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 587,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const generarCodigo = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const enviarCodigoVerificacion = async (email, nombre, codigo) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background: #f8f9fa; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #0f1923, #1a472a); padding: 40px; text-align: center; }
        .logo { font-size: 28px; font-weight: 700; color: white; }
        .logo span { color: #f4a261; }
        .body { padding: 40px; }
        .greeting { font-size: 18px; color: #1a1a2e; margin-bottom: 16px; }
        .text { font-size: 15px; color: #6b7280; line-height: 1.6; margin-bottom: 32px; }
        .codigo-box { background: #f0f7f4; border: 2px dashed #1a472a; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px; }
        .codigo { font-size: 48px; font-weight: 700; color: #1a472a; letter-spacing: 8px; }
        .codigo-label { font-size: 13px; color: #6b7280; margin-top: 8px; }
        .warning { font-size: 13px; color: #6b7280; background: #f8f9fa; border-radius: 8px; padding: 16px; }
        .footer { background: #f8f9fa; padding: 24px 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Vive<span>Más</span> Inmobiliaria</div>
        </div>
        <div class="body">
          <div class="greeting">Hola, ${nombre} 👋</div>
          <div class="text">Gracias por registrarte en Vive Más Inmobiliaria. Para verificar tu cuenta usa el siguiente código:</div>
          <div class="codigo-box">
            <div class="codigo">${codigo}</div>
            <div class="codigo-label">Código de verificación — válido por 15 minutos</div>
          </div>
          <div class="warning">
            Si no solicitaste este código, ignora este mensaje. Tu cuenta permanecerá segura.
          </div>
        </div>
        <div class="footer">
          © 2024 Vive Más Inmobiliaria · México<br>
          Este es un correo automático, no respondas a este mensaje.
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `${codigo} — Tu código de verificación Vive Más`,
    html,
  });
};

const enviarCodigoVerificacionCorreoCorporativo = async (email, razonSocial, codigo) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background: #f8f9fa; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #0f1923, #1a472a); padding: 40px; text-align: center; }
        .logo { font-size: 28px; font-weight: 700; color: white; }
        .logo span { color: #f4a261; }
        .body { padding: 40px; }
        .greeting { font-size: 18px; color: #1a1a2e; margin-bottom: 16px; }
        .text { font-size: 15px; color: #6b7280; line-height: 1.6; margin-bottom: 32px; }
        .codigo-box { background: #f0f7f4; border: 2px dashed #1a472a; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px; }
        .codigo { font-size: 48px; font-weight: 700; color: #1a472a; letter-spacing: 8px; }
        .codigo-label { font-size: 13px; color: #6b7280; margin-top: 8px; }
        .warning { font-size: 13px; color: #6b7280; background: #f8f9fa; border-radius: 8px; padding: 16px; }
        .footer { background: #f8f9fa; padding: 24px 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Vive<span>Más</span> Inmobiliaria</div>
        </div>
        <div class="body">
          <div class="greeting">Verificación de correo corporativo</div>
          <div class="text">Estás validando este correo como el correo corporativo de <b>${razonSocial || 'tu empresa'}</b> dentro de tu verificación KYB. Usa el siguiente código para confirmarlo:</div>
          <div class="codigo-box">
            <div class="codigo">${codigo}</div>
            <div class="codigo-label">Código de verificación — válido por 15 minutos</div>
          </div>
          <div class="warning">
            Si no solicitaste este código, ignora este mensaje.
          </div>
        </div>
        <div class="footer">
          © 2024 Vive Más Inmobiliaria · México<br>
          Este es un correo automático, no respondas a este mensaje.
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `${codigo} — Verifica tu correo corporativo · Vive Más`,
    html,
  });
};

const enviarBienvenida = async (email, nombre, plan) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background: #f8f9fa; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #0f1923, #1a472a); padding: 40px; text-align: center; }
        .logo { font-size: 28px; font-weight: 700; color: white; }
        .logo span { color: #f4a261; }
        .body { padding: 40px; text-align: center; }
        .emoji { font-size: 56px; margin-bottom: 16px; }
        .titulo { font-size: 24px; font-weight: 700; color: #1a1a2e; margin-bottom: 12px; }
        .text { font-size: 15px; color: #6b7280; line-height: 1.6; margin-bottom: 32px; }
        .btn { display: inline-block; background: #1a472a; color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; }
        .footer { background: #f8f9fa; padding: 24px 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Vive<span>Más</span> Inmobiliaria</div>
        </div>
        <div class="body">
          <div class="emoji">🎉</div>
          <div class="titulo">¡Bienvenido, ${nombre}!</div>
          <div class="text">Tu cuenta ha sido verificada exitosamente. Estás en el plan <strong>${plan}</strong> y ya puedes empezar a publicar tus propiedades.</div>
          <a href="${process.env.APP_URL || 'http://localhost:3000'}/pages/dashboard.html" class="btn">Ir a mi panel</a>
        </div>
        <div class="footer">
          © 2024 Vive Más Inmobiliaria · México
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `¡Bienvenido a Vive Más Inmobiliaria, ${nombre}!`,
    html,
  });
};

const enviarNotificacionMensaje = async (emailPropietario, nombrePropietario, nombreInteresado, tituloPropiedad, mensaje) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background: #f8f9fa; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #0f1923, #1a472a); padding: 40px; text-align: center; }
        .logo { font-size: 28px; font-weight: 700; color: white; }
        .logo span { color: #f4a261; }
        .body { padding: 40px; }
        .greeting { font-size: 18px; color: #1a1a2e; margin-bottom: 16px; font-weight: 600; }
        .text { font-size: 15px; color: #6b7280; line-height: 1.6; margin-bottom: 24px; }
        .mensaje-box { background: #f0f7f4; border-left: 4px solid #1a472a; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
        .mensaje-label { font-size: 12px; font-weight: 600; color: #1a472a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
        .mensaje-texto { font-size: 15px; color: #1a1a2e; line-height: 1.6; }
        .propiedad-box { background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid #e5e7eb; }
        .propiedad-label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
        .propiedad-titulo { font-size: 16px; font-weight: 600; color: #1a1a2e; }
        .btn { display: inline-block; background: #1a472a; color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; }
        .aviso { font-size: 12px; color: #9ca3af; background: #f8f9fa; border-radius: 8px; padding: 12px; margin-top: 24px; }
        .footer { background: #f8f9fa; padding: 24px 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Vive<span>Más</span> Inmobiliaria</div>
        </div>
        <div class="body">
          <div class="greeting">¡Hola, ${nombrePropietario}! 👋</div>
          <div class="text">Tienes un nuevo mensaje de interés en tu propiedad. <strong>${nombreInteresado}</strong> quiere más información.</div>
          
          <div class="propiedad-box">
            <div class="propiedad-label">Propiedad de interés</div>
            <div class="propiedad-titulo">🏠 ${tituloPropiedad}</div>
          </div>

          <div class="mensaje-box">
            <div class="mensaje-label">Mensaje recibido</div>
            <div class="mensaje-texto">"${mensaje}"</div>
          </div>

          <div style="text-align:center">
          <a href="${process.env.APP_URL || 'http://localhost:3000'}/pages/dashboard.html" class="btn">Ver mensaje completo</a>
          </div>

          <div class="aviso">
            🔒 Los datos de contacto del interesado están protegidos. Responde a través de tu panel en Vive Más Inmobiliaria para mantener la comunicación segura.
          </div>
        </div>
        <div class="footer">
          © 2024 Vive Más Inmobiliaria · México<br>
          Puedes configurar tus notificaciones desde tu panel de usuario.
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: emailPropietario,
    subject: `💬 Nuevo mensaje sobre tu propiedad — ${tituloPropiedad}`,
    html,
  });
};

// ==========================================
// RECUPERAR CONTRASEÑA
// ==========================================
const enviarEnlaceRecuperacion = async (email, nombre, token) => {
  const enlace = `${process.env.APP_URL || 'http://localhost:3000'}/pages/nueva-contrasena.html?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background: #f8f9fa; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #0f1923, #1a472a); padding: 40px; text-align: center; }
        .logo { font-size: 28px; font-weight: 700; color: white; }
        .logo span { color: #f4a261; }
        .body { padding: 40px; }
        .greeting { font-size: 18px; color: #1a1a2e; margin-bottom: 16px; }
        .text { font-size: 15px; color: #6b7280; line-height: 1.6; margin-bottom: 32px; }
        .btn { display: block; background: #1a472a; color: white; padding: 16px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px; text-align: center; margin-bottom: 32px; }
        .warning { font-size: 13px; color: #6b7280; background: #f8f9fa; border-radius: 8px; padding: 16px; text-align: center; }
        .footer { background: #f8f9fa; padding: 24px 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Vive<span>Más</span> Inmobiliaria</div>
        </div>
        <div class="body">
          <div class="greeting">Hola, ${nombre} 🔑</div>
          <div class="text">Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el siguiente botón para crear una nueva contraseña. Este enlace es válido por 30 minutos:</div>
          <a href="${enlace}" class="btn">Restablecer mi contraseña</a>
          <div class="warning">
            Si no solicitaste este cambio, puedes ignorar este correo de forma segura. Tu contraseña actual no sufrirá ningún cambio.
          </div>
        </div>
        <div class="footer">
          © 2024 Vive Más Inmobiliaria · México<br>
          Este es un correo automático, no respondas a este mensaje.
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `🔑 Restablecer contraseña — Vive Más Inmobiliaria`,
    html,
  });
};

// ==========================================
// ALERTA 2FA DESACTIVADO
// ==========================================
const enviarAlerta2FADesactivado = async (email, nombre) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background: #f8f9fa; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #0f1923, #7f1d1d); padding: 40px; text-align: center; }
        .logo { font-size: 28px; font-weight: 700; color: white; }
        .logo span { color: #f4a261; }
        .body { padding: 40px; }
        .greeting { font-size: 18px; color: #7f1d1d; margin-bottom: 16px; font-weight: 600; }
        .text { font-size: 15px; color: #6b7280; line-height: 1.6; margin-bottom: 24px; }
        .alerta-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin-bottom: 32px; text-align: center; }
        .alerta-text { font-size: 15px; color: #991b1b; font-weight: 600; }
        .btn { display: block; background: #1a472a; color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; text-align: center; }
        .footer { background: #f8f9fa; padding: 24px 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Vive<span>Más</span> Inmobiliaria</div>
        </div>
        <div class="body">
          <div class="greeting">⚠️ Alerta de Seguridad</div>
          <div class="text">Hola, <strong>${nombre}</strong>. Se ha utilizado un <strong>código de recuperación</strong> para iniciar sesión en tu cuenta.</div>
          
          <div class="alerta-box">
            <div class="alerta-text">La Autenticación en Dos Pasos (2FA) ha sido desactivada automáticamente.</div>
          </div>

          <div class="text" style="margin-bottom: 32px;">Si tú no realizaste esta acción, tu cuenta podría estar comprometida. Te recomendamos cambiar tu contraseña inmediatamente y volver a activar el 2FA desde tu panel de usuario.</div>

          <a href="${process.env.APP_URL || 'http://localhost:3000'}/pages/dashboard.html" class="btn">Ir a mi panel de seguridad</a>
        </div>
        <div class="footer">
          © 2024 Vive Más Inmobiliaria · México<br>
          Este es un correo automático de seguridad.
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `⚠️ Alerta de Seguridad: 2FA desactivado — Vive Más`,
    html,
  });
};

// ==========================================
// NOVEDAD / CAMPAÑA
// ==========================================
const enviarNovedad = async (email, nombre, novedad) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background: #f8f9fa; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #0f1923, #1a472a); padding: 40px; text-align: center; }
        .logo { font-size: 28px; font-weight: 700; color: white; }
        .logo span { color: #f4a261; }
        .body { padding: 40px; }
        .greeting { font-size: 18px; color: #1a1a2e; margin-bottom: 16px; font-weight: 600; }
        .titulo { font-size: 20px; font-weight: 700; color: #1a472a; margin-bottom: 12px; }
        .text { font-size: 15px; color: #6b7280; line-height: 1.6; margin-bottom: 24px; white-space: pre-wrap; }
        ${novedad.imagen ? '.imagen { width: 100%; border-radius: 10px; margin-bottom: 24px; }' : ''}
        .btn { display: inline-block; background: #1a472a; color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; }
        .footer { background: #f8f9fa; padding: 24px 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Vive<span>Más</span> Inmobiliaria</div>
        </div>
        <div class="body">
          <div class="greeting">¡Hola, ${nombre}! 👋</div>
          ${novedad.imagen ? `<img src="${novedad.imagen}" class="imagen">` : ''}
          <div class="titulo">${novedad.titulo}</div>
          <div class="text">${novedad.mensaje}</div>
          ${novedad.link ? `<div style="text-align:center"><a href="${novedad.link}" class="btn">Ver más</a></div>` : ''}
        </div>
        <div class="footer">
          © 2024 Vive Más Inmobiliaria · México<br>
          Recibiste este correo porque tienes activadas las notificaciones de novedades y promociones. Puedes desactivarlas desde tu panel de usuario.
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `📰 ${novedad.titulo} — Vive Más Inmobiliaria`,
    html,
  });
};

// ==========================================
// COINCIDENCIA DE BÚSQUEDA
// ==========================================
const enviarCoincidenciaBusqueda = async (email, nombre, propiedad) => {
  const url = `${process.env.APP_URL || 'http://localhost:3000'}/pages/propiedad.html?id=${propiedad._id}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background: #f8f9fa; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #0f1923, #1a472a); padding: 40px; text-align: center; }
        .logo { font-size: 28px; font-weight: 700; color: white; }
        .logo span { color: #f4a261; }
        .body { padding: 40px; }
        .greeting { font-size: 18px; color: #1a1a2e; margin-bottom: 16px; font-weight: 600; }
        .text { font-size: 15px; color: #6b7280; line-height: 1.6; margin-bottom: 24px; }
        .propiedad-box { background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid #e5e7eb; }
        ${propiedad.fotos && propiedad.fotos[0] ? '.foto { width: 100%; border-radius: 8px; margin-bottom: 12px; }' : ''}
        .propiedad-titulo { font-size: 16px; font-weight: 600; color: #1a1a2e; }
        .propiedad-precio { font-size: 18px; font-weight: 700; color: #1a472a; margin-top: 4px; }
        .btn { display: inline-block; background: #1a472a; color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; }
        .footer { background: #f8f9fa; padding: 24px 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Vive<span>Más</span> Inmobiliaria</div>
        </div>
        <div class="body">
          <div class="greeting">¡Hola, ${nombre}! 👋</div>
          <div class="text">Encontramos una nueva propiedad que coincide con una de tus búsquedas recientes.</div>
          <div class="propiedad-box">
            ${propiedad.fotos && propiedad.fotos[0] ? `<img src="${propiedad.fotos[0]}" class="foto">` : ''}
            <div class="propiedad-titulo">🏠 ${propiedad.titulo}</div>
            <div class="propiedad-precio">$${Number(propiedad.precio).toLocaleString('es-MX')} MXN</div>
          </div>
          <div style="text-align:center">
            <a href="${url}" class="btn">Ver propiedad</a>
          </div>
        </div>
        <div class="footer">
          © 2024 Vive Más Inmobiliaria · México<br>
          Recibiste este correo porque tienes activadas las notificaciones de novedades y promociones. Puedes desactivarlas desde tu panel de usuario.
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `🏠 Nueva propiedad que podría interesarte — ${propiedad.titulo}`,
    html,
  });
};

module.exports = { 
  transporter,
  generarCodigo, 
  enviarCodigoVerificacion, 
  enviarCodigoVerificacionCorreoCorporativo,
  enviarBienvenida, 
  enviarNotificacionMensaje,
  enviarEnlaceRecuperacion,       
  enviarAlerta2FADesactivado,
  enviarNovedad,
  enviarCoincidenciaBusqueda
};