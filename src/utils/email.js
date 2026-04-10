const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
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
          <a href="http://localhost:3000/pages/dashboard.html" class="btn">Ir a mi panel</a>
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

module.exports = { generarCodigo, enviarCodigoVerificacion, enviarBienvenida };