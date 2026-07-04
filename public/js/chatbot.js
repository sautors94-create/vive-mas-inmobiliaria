const CHATBOT_I18N = {
  es: {
    supportName: 'Vivi',
    servicesName: 'Max',
    supportSubtitle: 'Soporte de cuenta',
    servicesSubtitle: 'Asesor de servicios',
    supportWelcome: '¡Hola! Soy Vivi 🎧 ¿En qué puedo ayudarte? Cuéntame tu problema.',
    servicesWelcome: '¡Hola! Soy Max 🏠 ¿Qué tipo de servicio inmobiliario necesitas?',
    leadTitle: '📋 Déjanos tus datos',
    leadNamePlaceholder: 'Tu nombre',
    leadPhonePlaceholder: 'Tu teléfono',
    leadSendButton: 'Enviar mis datos',
    inputPlaceholder: 'Escribe tu mensaje...',
    inactivityClosed: '⏰ Sesión cerrada por inactividad. ¡Hasta pronto! Estoy aquí cuando me necesites.',
    followup: '¿Hay algo más en que pueda ayudarte? 😊',
    genericError: 'Lo siento, hubo un error. Intenta de nuevo.',
    networkError: 'Error de conexión. Verifica tu internet.',
    leadValidation: 'Por favor llena nombre y teléfono',
    leadThanks: '¡Gracias {nombre}! Un asesor te contactará al {tel} muy pronto. 😊'
  },
  en: {
    supportName: 'Vivi',
    servicesName: 'Max',
    supportSubtitle: 'Account support',
    servicesSubtitle: 'Services advisor',
    supportWelcome: 'Hi! I’m Vivi 🎧 How can I help you today? Tell me what happened.',
    servicesWelcome: 'Hi! I’m Max 🏠 What kind of real estate service do you need?',
    leadTitle: '📋 Leave us your details',
    leadNamePlaceholder: 'Your name',
    leadPhonePlaceholder: 'Your phone',
    leadSendButton: 'Send my details',
    inputPlaceholder: 'Type your message...',
    inactivityClosed: '⏰ Session closed due to inactivity. See you soon! I’ll be here when you need me.',
    followup: 'Is there anything else I can help you with? 😊',
    genericError: 'Sorry, there was an error. Please try again.',
    networkError: 'Connection error. Please check your internet.',
    leadValidation: 'Please enter name and phone number',
    leadThanks: 'Thanks {nombre}! An advisor will contact you at {tel} very soon. 😊'
  },
  pt: {
    supportName: 'Vivi',
    servicesName: 'Max',
    supportSubtitle: 'Suporte da conta',
    servicesSubtitle: 'Consultor de serviços',
    supportWelcome: 'Olá! Sou a Vivi 🎧 Como posso te ajudar? Conte seu problema.',
    servicesWelcome: 'Olá! Sou o Max 🏠 Que tipo de serviço imobiliário você precisa?',
    leadTitle: '📋 Deixe seus dados',
    leadNamePlaceholder: 'Seu nome',
    leadPhonePlaceholder: 'Seu telefone',
    leadSendButton: 'Enviar meus dados',
    inputPlaceholder: 'Digite sua mensagem...',
    inactivityClosed: '⏰ Sessão encerrada por inatividade. Até logo! Estarei aqui quando precisar.',
    followup: 'Posso te ajudar com mais alguma coisa? 😊',
    genericError: 'Desculpe, ocorreu um erro. Tente novamente.',
    networkError: 'Erro de conexão. Verifique sua internet.',
    leadValidation: 'Por favor, preencha nome e telefone',
    leadThanks: 'Obrigado {nombre}! Um consultor entrará em contato no {tel} em breve. 😊'
  }
};

const getChatbotLang = () => {
  try {
    const fromStorage = (localStorage.getItem('vm_lang') || '').toLowerCase();
    const normalizedStorage = fromStorage.slice(0, 2);
    if (CHATBOT_I18N[normalizedStorage]) return normalizedStorage;
  } catch (e) {}
  const nav = (navigator.language || 'es').toLowerCase().slice(0, 2);
  return CHATBOT_I18N[nav] ? nav : 'es';
};

const tChat = (lang, key) => {
  const dict = CHATBOT_I18N[lang] || CHATBOT_I18N.es;
  return dict[key] || CHATBOT_I18N.es[key] || key;
};

class Chatbot {
  constructor(tipo) {
    this.tipo = tipo;
    this.historial = [];
    this.abierto = false;
    this.timerInactividad = null;
    this.timerSeguimiento = null;
    this.TIEMPO_INACTIVIDAD = 1 * 60 * 1000;
    this.lang = getChatbotLang();
    this.nombre = tipo === 'soporte' ? tChat(this.lang, 'supportName') : tChat(this.lang, 'servicesName');
    this.emoji = tipo === 'soporte' ? '🎧' : '🏠';
    this.color = tipo === 'soporte' ? '#1a472a' : '#1a3a6e';
    this.bienvenida = tipo === 'soporte'
      ? tChat(this.lang, 'supportWelcome')
      : tChat(this.lang, 'servicesWelcome');
    this.render();
    try {
      const userActual = typeof auth !== 'undefined' ? auth.getUser() : null;
      if (userActual && this.tipo === 'servicios') {
        setTimeout(() => {
          const leadNombre = document.getElementById(`chatbot-${this.tipo}-lead-nombre`);
          const leadTel = document.getElementById(`chatbot-${this.tipo}-lead-tel`);
          if (leadNombre) leadNombre.value = userActual.nombre || '';
          if (leadTel) leadTel.value = userActual.telefono || '';
        }, 500);
      }
    } catch(e) {}
  }

  render() {
    const id = `chatbot-${this.tipo}`;
    if (document.getElementById(id)) return;
    const wrap = document.createElement('div');
    wrap.id = id;
    wrap.innerHTML = `
      <div id="${id}-btn" style="
        position:fixed;bottom:${this.tipo === 'soporte' ? '24px' : '88px'};right:24px;
        width:52px;height:52px;border-radius:50%;background:${this.color};
        color:white;font-size:22px;display:flex;align-items:center;justify-content:center;
        cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.2);z-index:9998;
        transition:transform 0.2s;user-select:none"
        onclick="chatbots['${this.tipo}'].toggle()"
        onmouseover="this.style.transform='scale(1.1)'"
        onmouseout="this.style.transform='scale(1)'">
        ${this.emoji}
      </div>
      <div id="${id}-window" style="
        position:fixed;bottom:${this.tipo === 'soporte' ? '88px' : '152px'};right:24px;
        width:340px;height:480px;background:white;border-radius:20px;
        box-shadow:0 8px 40px rgba(0,0,0,0.15);z-index:9999;
        display:none;flex-direction:column;overflow:hidden;
        border:1px solid rgba(0,0,0,0.1)">
        <div style="background:${this.color};padding:16px 20px;display:flex;align-items:center;gap:12px">
          <div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:18px">${this.emoji}</div>
          <div>
            <div style="color:white;font-weight:600;font-size:15px">${this.nombre}</div>
            <div style="color:rgba(255,255,255,0.7);font-size:11px">${this.tipo === 'soporte' ? tChat(this.lang, 'supportSubtitle') : tChat(this.lang, 'servicesSubtitle')}</div>
          </div>
          <div onclick="chatbots['${this.tipo}'].toggle()" style="margin-left:auto;color:rgba(255,255,255,0.7);cursor:pointer;font-size:18px;padding:4px">✕</div>
        </div>
        <div id="${id}-msgs" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#f8f9fa"></div>
        <div id="${id}-lead" style="display:none;padding:12px 16px;background:#f0f7f4;border-top:1px solid #e5e7eb">
          <div style="font-size:12px;font-weight:600;color:#1a472a;margin-bottom:8px">${tChat(this.lang, 'leadTitle')}</div>
          <input id="${id}-lead-nombre" placeholder="${tChat(this.lang, 'leadNamePlaceholder')}" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;margin-bottom:6px;outline:none">
          <input id="${id}-lead-tel" placeholder="${tChat(this.lang, 'leadPhonePlaceholder')}" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;margin-bottom:6px;outline:none">
          <button onclick="chatbots['${this.tipo}'].enviarLead()" style="width:100%;background:#1a472a;color:white;border:none;padding:8px;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600">${tChat(this.lang, 'leadSendButton')}</button>
        </div>
        <div style="padding:12px 16px;border-top:1px solid #e5e7eb;display:flex;gap:8px;background:white">
          <input id="${id}-input" placeholder="${tChat(this.lang, 'inputPlaceholder')}" style="flex:1;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:20px;font-size:13px;outline:none;font-family:inherit"
            onkeydown="if(event.key==='Enter') chatbots['${this.tipo}'].enviar()">
          <button onclick="chatbots['${this.tipo}'].enviar()" style="width:38px;height:38px;border-radius:50%;background:${this.color};color:white;border:none;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center">➤</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    this.agregarMensaje('bot', this.bienvenida);
  }

  toggle() {
    this.abierto = !this.abierto;
    const win = document.getElementById(`chatbot-${this.tipo}-window`);
    win.style.display = this.abierto ? 'flex' : 'none';
    if (this.abierto) {
      document.getElementById(`chatbot-${this.tipo}-input`).focus();
      this.reiniciarTimer();
    } else {
      if (this.timerInactividad) clearTimeout(this.timerInactividad);
      if (this.timerSeguimiento) clearTimeout(this.timerSeguimiento);
    }
  }

  reiniciarTimer() {
    if (this.timerInactividad) clearTimeout(this.timerInactividad);
    this.timerInactividad = setTimeout(() => {
      if (this.abierto) {
        this.agregarMensaje('bot', tChat(this.lang, 'inactivityClosed'));
        setTimeout(() => {
          this.toggle();
          this.historial = [];
          const msgs = document.getElementById(`chatbot-${this.tipo}-msgs`);
          if (msgs) { msgs.innerHTML = ''; this.agregarMensaje('bot', this.bienvenida); }
        }, 3000);
      }
    }, this.TIEMPO_INACTIVIDAD);
  }

  agregarMensaje(rol, texto) {
    const msgs = document.getElementById(`chatbot-${this.tipo}-msgs`);
    const isBot = rol === 'bot';
    const div = document.createElement('div');
    div.style.cssText = `display:flex;justify-content:${isBot ? 'flex-start' : 'flex-end'}`;
    div.innerHTML = `
      <div style="
        max-width:80%;padding:10px 14px;border-radius:${isBot ? '4px 16px 16px 16px' : '16px 4px 16px 16px'};
        background:${isBot ? 'white' : this.color};color:${isBot ? '#1a1a2e' : 'white'};
        font-size:13px;line-height:1.5;
        box-shadow:${isBot ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'};
        border:${isBot ? '1px solid #e5e7eb' : 'none'}">
        ${texto.replace(/\n/g, '<br>')}
      </div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    if (!isBot || this.historial.length > 0) {
      this.historial.push({ role: isBot ? 'assistant' : 'user', text: texto });
    }
  }

  agregarTyping() {
    const msgs = document.getElementById(`chatbot-${this.tipo}-msgs`);
    const div = document.createElement('div');
    div.id = `chatbot-${this.tipo}-typing`;
    div.style.cssText = 'display:flex;justify-content:flex-start';
    div.innerHTML = `
      <div style="padding:10px 16px;background:white;border-radius:4px 16px 16px 16px;border:1px solid #e5e7eb;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
        <span style="display:inline-flex;gap:4px">
          <span style="width:6px;height:6px;border-radius:50%;background:#9ca3af;animation:typing 1s infinite 0s"></span>
          <span style="width:6px;height:6px;border-radius:50%;background:#9ca3af;animation:typing 1s infinite 0.2s"></span>
          <span style="width:6px;height:6px;border-radius:50%;background:#9ca3af;animation:typing 1s infinite 0.4s"></span>
        </span>
      </div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  quitarTyping() {
    const typing = document.getElementById(`chatbot-${this.tipo}-typing`);
    if (typing) typing.remove();
  }

async enviar() {
    const input = document.getElementById(`chatbot-${this.tipo}-input`);
    const mensaje = input.value.trim();
    if (!mensaje) return;
    input.value = '';
    this.agregarMensaje('user', mensaje);
    this.agregarTyping();
    try {
      const res = await fetch(`${API_URL}/api/chat/${this.tipo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje,
          historial: this.historial.slice(-10).map(h => ({
            role: h.role === 'model' ? 'assistant' : h.role,
            text: h.text
          }))
        })
      });
      const data = await res.json();
      this.quitarTyping();
      if (data.ok) {
        this.agregarMensaje('bot', data.respuesta);
        
        // Manejar redireccionamiento si existe
        if (data.redireccion) {
          this.manejarRedireccion(data.redireccion);
        }
        
        if (this.timerSeguimiento) clearTimeout(this.timerSeguimiento);
        this.timerSeguimiento = setTimeout(() => {
          if (this.abierto && this.historial.length > 2) {
            this.agregarMensaje('bot', tChat(this.lang, 'followup'));
          }
        }, 45 * 1000);
        if (data.esLead) {
          const leadForm = document.getElementById(`chatbot-${this.tipo}-lead`);
          if (leadForm) leadForm.style.display = 'block';
        }
      } else {
        this.agregarMensaje('bot', tChat(this.lang, 'genericError'));
      }
    } catch(e) {
      this.quitarTyping();
      this.agregarMensaje('bot', tChat(this.lang, 'networkError'));
    }
    this.reiniciarTimer();
  }

  manejarRedireccion(redireccion) {
    if (!redireccion.botones || redireccion.botones.length === 0) return;
    
    // Añadir botones de accion
    const msgs = document.getElementById(`chatbot-${this.tipo}-msgs`);
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;justify-content:flex-start';
    
    redireccion.botones.forEach(btn => {
      const btnEl = document.createElement('button');
      btnEl.textContent = btn.texto;
      btnEl.style.cssText = `
        padding:8px 12px;
        background:${this.color};
        color:white;
        border:none;
        border-radius:16px;
        font-size:12px;
        cursor:pointer;
        font-weight:500;
        transition:all 0.2s;
      `;
      btnEl.onmouseover = () => { btnEl.style.opacity = '0.8'; };
      btnEl.onmouseout = () => { btnEl.style.opacity = '1'; };
      btnEl.onclick = () => this.ejecutarAccion(btn.accion, redireccion.tipo);
      btnContainer.appendChild(btnEl);
    });
    
    msgs.appendChild(btnContainer);
    msgs.scrollTop = msgs.scrollHeight;
  }

  ejecutarAccion(accion, tipoRedireccion) {
    if (accion === 'whatsapp') {
      const telefono = '525512345678'; // WhatsApp de Vive Más
      window.open(`https://wa.me/${telefono}?text=Hola,%20quiero%20atención%20personalizada`, '_blank');
    } else if (accion === 'email') {
      window.open('mailto:soporte@vivemas.mx?subject=Quiero atención personalizada', '_blank');
    } else if (accion === 'catalogo') {
      const basePath = window.location.pathname.includes('/pages/') ? '' : 'pages/';
      window.location.href = basePath + 'catalogo.html';
    } else if (accion === 'continuar') {
      // Continuar el chat normalmente
      this.agregarMensaje('bot', '¡Perfecto! ¿En qué más puedo ayudarte? 😊');
    }
  }

  async enviarLead() {
    const nombre = document.getElementById(`chatbot-${this.tipo}-lead-nombre`)?.value.trim();
    const tel = document.getElementById(`chatbot-${this.tipo}-lead-tel`)?.value.trim();
   if (!nombre || !tel) {
      if (typeof dsToast === 'function') {
        dsToast({ title: 'Faltan datos', message: tChat(this.lang, 'leadValidation'), type: 'error' });
      } else {
        // Notificación inline dentro del chatbot (no depende de toasts.js)
        const chatBody = document.getElementById(`chatbot-${this.tipo}-messages`);
        if (chatBody) {
          const msg = document.createElement('div');
          msg.style.cssText = 'padding:8px 12px;background:#fef2f2;color:#dc2626;border-radius:8px;font-size:13px;margin:6px 0;border-left:3px solid #dc2626';
          msg.textContent = tChat(this.lang, 'leadValidation');
          chatBody.appendChild(msg);
          chatBody.scrollTop = chatBody.scrollHeight;
          setTimeout(() => msg.remove(), 4000);
        }
      }
      return;
    }
    try {
      const userActual = typeof auth !== 'undefined' ? auth.getUser() : null;
      const token = typeof auth !== 'undefined' ? auth.getToken() : null;
      await fetch(`${API_URL}/api/chat/lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          nombre, telefono: tel, tipo: this.tipo,
          conversacion: this.historial,
          usuarioId: userActual?._id || null,
          email: userActual?.email || null
        })
      });
    } catch(e) {}
    document.getElementById(`chatbot-${this.tipo}-lead`).style.display = 'none';
    this.agregarMensaje('bot', tChat(this.lang, 'leadThanks').replace('{nombre}', nombre).replace('{tel}', tel));
  }
}

const style = document.createElement('style');
style.textContent = `@keyframes typing { 0%,100%{opacity:0.3;transform:translateY(0)} 50%{opacity:1;transform:translateY(-3px)} }`;
document.head.appendChild(style);

window.chatbots = window.chatbots || {};
if (!window.chatbots['soporte']) window.chatbots['soporte'] = new Chatbot('soporte');
if (!window.SOLO_SOPORTE && !window.chatbots['servicios']) {
  window.chatbots['servicios'] = new Chatbot('servicios');
}