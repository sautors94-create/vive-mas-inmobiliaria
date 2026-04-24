class Chatbot {
  constructor(tipo) {
    this.tipo = tipo;
    this.historial = [];
    this.abierto = false;
    this.timerInactividad = null;
    this.TIEMPO_INACTIVIDAD = 1 * 60 * 1000;
    this.nombre = tipo === 'soporte' ? 'Vivi' : 'Max';
    this.emoji = tipo === 'soporte' ? '🎧' : '🏠';
    this.color = tipo === 'soporte' ? '#1a472a' : '#1a3a6e';
    this.bienvenida = tipo === 'soporte'
      ? '¡Hola! Soy Vivi 🎧 ¿En qué puedo ayudarte? Cuéntame tu problema.'
      : '¡Hola! Soy Max 🏠 ¿Qué tipo de servicio inmobiliario necesitas?';
    this.render();
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
            <div style="color:rgba(255,255,255,0.7);font-size:11px">${this.tipo === 'soporte' ? 'Soporte de cuenta' : 'Asesor de servicios'}</div>
          </div>
          <div onclick="chatbots['${this.tipo}'].toggle()" style="margin-left:auto;color:rgba(255,255,255,0.7);cursor:pointer;font-size:18px;padding:4px">✕</div>
        </div>
        <div id="${id}-msgs" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#f8f9fa"></div>
        ${this.tipo === 'servicios' ? `
        <div id="${id}-lead" style="display:none;padding:12px 16px;background:#f0f7f4;border-top:1px solid #e5e7eb">
          <div style="font-size:12px;font-weight:600;color:#1a472a;margin-bottom:8px">📋 Déjanos tus datos</div>
          <input id="${id}-lead-nombre" placeholder="Tu nombre" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;margin-bottom:6px;outline:none">
          <input id="${id}-lead-tel" placeholder="Tu teléfono" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;margin-bottom:6px;outline:none">
          <button onclick="chatbots['${this.tipo}'].enviarLead()" style="width:100%;background:#1a472a;color:white;border:none;padding:8px;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600">Enviar mis datos</button>
        </div>` : ''}
        <div style="padding:12px 16px;border-top:1px solid #e5e7eb;display:flex;gap:8px;background:white">
          <input id="${id}-input" placeholder="Escribe tu mensaje..." style="flex:1;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:20px;font-size:13px;outline:none;font-family:inherit"
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
    }
  }

  reiniciarTimer() {
    if (this.timerInactividad) clearTimeout(this.timerInactividad);
    this.timerInactividad = setTimeout(() => {
      if (this.abierto) {
        this.agregarMensaje('bot', '⏰ Sesión cerrada por inactividad. ¡Hasta pronto! Estoy aquí cuando me necesites.');
        setTimeout(() => {
          this.toggle();
          this.historial = [];
          const msgs = document.getElementById(`chatbot-${this.tipo}-msgs`);
          if (msgs) {
            msgs.innerHTML = '';
            this.agregarMensaje('bot', this.bienvenida);
          }
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
        background:${isBot ? 'white' : this.color};
        color:${isBot ? '#1a1a2e' : 'white'};
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
      const res = await fetch(`http://localhost:3000/api/chat/${this.tipo}`, {
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
         if (this.timerSeguimiento) clearTimeout(this.timerSeguimiento);
         this.timerSeguimiento = setTimeout(() => {
         if (this.abierto && this.historial.length > 2) {
          this.agregarMensaje('bot', '¿Hay algo más en que pueda ayudarte? 😊');
         }  }, 45 * 1000);
        if (data.esLead) {
          const leadForm = document.getElementById(`chatbot-${this.tipo}-lead`);
          if (leadForm) leadForm.style.display = 'block';
        }
      } else {
        this.agregarMensaje('bot', 'Lo siento, hubo un error. Intenta de nuevo.');
      }
    } catch(e) {
      this.quitarTyping();
      this.agregarMensaje('bot', 'Error de conexión. Verifica tu internet.');
    }
    this.reiniciarTimer();
  }

  async enviarLead() {
    const nombre = document.getElementById(`chatbot-${this.tipo}-lead-nombre`)?.value.trim();
    const tel = document.getElementById(`chatbot-${this.tipo}-lead-tel`)?.value.trim();
    if (!nombre || !tel) { alert('Por favor llena nombre y teléfono'); return; }
    await fetch('http://localhost:3000/api/chat/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, telefono: tel, tipo: this.tipo })
    });
    document.getElementById(`chatbot-${this.tipo}-lead`).style.display = 'none';
    this.agregarMensaje('bot', `¡Gracias ${nombre}! Un asesor te contactará al ${tel} muy pronto. 😊`);
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