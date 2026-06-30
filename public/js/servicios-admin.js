if (!auth.isLoggedIn()) window.location.href = 'login.html';

const user = auth.getUser();
if (user && user.role !== 'admin' && user.role !== 'services') {
  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
  if (user) document.getElementById('sidebar-nombre').textContent = user.nombre;
  cargarLeads();
});

const mostrarSeccion = (seccion) => {
  document.querySelectorAll('.dash-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`sec-${seccion}`).style.display = 'block';
  event.target.closest('.sidebar-link')?.classList.add('active');
  if (seccion === 'stats') cargarStats();
};

const cargarLeads = async () => {
  const lista = document.getElementById('leads-lista');
  const search = document.getElementById('search-leads')?.value || '';
  const status = document.getElementById('filtro-status-lead')?.value || '';
  const url = `/services/leads?${status ? 'status=' + status : ''}${search ? '&search=' + search : ''}`;
  const data = await api.get(url);

  if (!data.leads || data.leads.length === 0) {
    lista.innerHTML = '<div class="loading">No hay leads aún.</div>';
    return;
  }

  lista.innerHTML = data.leads.map(l => `
    <div class="prop-admin-card" style="flex-wrap:wrap;gap:12px">
      <div style="width:44px;height:44px;border-radius:50%;background:#1a3a6e;color:white;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;flex-shrink:0">
        ${l.nombre.charAt(0).toUpperCase()}
      </div>
      <div class="prop-admin-info">
       <div class="prop-admin-titulo">${l.folio || ''} — ${l.nombre}</div>
        <div class="prop-admin-meta">
          📞 ${l.telefono}
          ${l.email ? ' · 📧 ' + l.email : ''}
          ${l.servicio ? ' · 🏠 ' + l.servicio : ''}
        </div>
        <div class="prop-admin-meta" style="margin-top:4px">
          📅 ${new Date(l.createdAt).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
          ${l.atendidoPor ? ' · Atendido por: ' + l.atendidoPor.nombre : ''}
        </div>
        ${l.notas ? `<div style="font-size:12px;color:var(--primary);margin-top:4px">📝 ${l.notas}</div>` : ''}
      </div>
      <div class="prop-admin-actions" style="flex-wrap:wrap;gap:6px">
        <span class="status-badge status-${l.status === 'nuevo' ? 'revision' : l.status === 'contactado' ? 'aprobada' : 'rechazada'}">${l.status}</span>
        <button class="btn btn-primary" style="padding:5px 12px;font-size:12px" onclick="verLead('${l._id}')">Ver detalle</button>
        <select onchange="cambiarStatus('${l._id}', this.value)" style="padding:5px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;cursor:pointer">
          <option value="">Cambiar status</option>
          <option value="nuevo" ${l.status === 'nuevo' ? 'selected' : ''}>Nuevo</option>
          <option value="contactado" ${l.status === 'contactado' ? 'selected' : ''}>Contactado</option>
          <option value="cerrado" ${l.status === 'cerrado' ? 'selected' : ''}>Cerrado</option>
        </select>
        <button class="btn btn-outline" style="padding:5px 12px;font-size:12px;border-color:#c62828;color:#c62828" onclick="eliminarLead('${l._id}')">Eliminar</button>
      </div>
    </div>`).join('');
};

const verLead = async (id) => {
  const data = await api.get(`/services/leads/${id}`);
  if (!data.ok) return;
  const l = data.lead;

  document.getElementById('modal-lead-content').innerHTML = `
    <div style="display:grid;gap:16px">
      
      <!-- FOLIO Y STATUS -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--bg-secondary);border-radius:12px;border:1px solid var(--border)">
        <div>
          <div style="font-size:11px;color:var(--text-light);text-transform:uppercase;font-weight:600">Folio</div>
          <div style="font-size:20px;font-weight:700;color:var(--primary);font-family:'Bricolage Grotesque',sans-serif">${l.folio || 'VM-0000'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:var(--text-light);text-transform:uppercase;font-weight:600">Fecha</div>
          <div style="font-size:13px;font-weight:500">${new Date(l.createdAt).toLocaleDateString('es-MX', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
        </div>
      </div>

      <!-- DATOS DE CONTACTO -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-grupo">
          <label>Nombre</label>
          <input class="form-input" value="${l.nombre}" disabled>
        </div>
        <div class="form-grupo">
          <label>Teléfono</label>
          <input class="form-input" value="${l.telefono}" disabled>
        </div>
        <div class="form-grupo">
          <label>Email</label>
          <input class="form-input" value="${l.email || 'No proporcionado'}" disabled>
        </div>
        <div class="form-grupo">
          <label>Servicio de interés</label>
          <input class="form-input" value="${l.servicio || 'No especificado'}" disabled>
        </div>
      </div>

      <!-- UBICACIÓN -->
      <div style="display:flex;gap:12px;padding:12px 16px;background:#f0f7f4;border-radius:12px;border:1px solid #d1e7dd;align-items:center">
        <span style="font-size:24px">📍</span>
        <div>
          <div style="font-size:12px;color:var(--text-light);font-weight:600">Ubicación aproximada</div>
          <div style="font-size:14px;font-weight:500">${l.ciudad ? l.ciudad + ', ' + l.pais : 'No disponible'}</div>
          <div style="font-size:11px;color:var(--text-light)">IP: ${l.ip || 'No disponible'}</div>
        </div>
      </div>

      <!-- USUARIO REGISTRADO -->
      ${l.usuarioRegistrado ? `
        <div style="display:flex;gap:12px;padding:12px 16px;background:#e8f5e9;border-radius:12px;border:1px solid #c8e6c9;align-items:center">
          <div style="width:40px;height:40px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;flex-shrink:0">
            ${l.usuarioRegistrado.nombre.charAt(0)}
          </div>
          <div style="flex:1">
            <div style="font-size:12px;color:#2e7d32;font-weight:600">✓ Usuario registrado en plataforma</div>
            <div style="font-size:14px;font-weight:500">${l.usuarioRegistrado.nombre}</div>
            <div style="font-size:12px;color:var(--text-light)">${l.usuarioRegistrado.email} · Plan ${l.usuarioRegistrado.plan}</div>
          </div>
          <a href="dashboard.html" target="_blank" class="btn btn-outline" style="padding:6px 12px;font-size:12px">Ver perfil</a>
        </div>` : `
        <div style="padding:10px 16px;background:#fff3e0;border-radius:10px;border:1px solid #ffe0b2;font-size:13px;color:#e65100">
          👤 Usuario no registrado en la plataforma
        </div>`}

      <!-- NOTAS -->
      <div class="form-grupo">
        <label>Notas del asesor</label>
        <textarea id="lead-notas-${l._id}" class="form-input" rows="3" placeholder="Agrega tus notas aquí...">${l.notas || ''}</textarea>
      </div>
      <button class="btn btn-primary" onclick="guardarNotas('${l._id}')" style="padding:10px">💾 Guardar notas</button>

      <!-- RESPUESTA INTERNA -->
      ${l.usuarioRegistrado ? `
        <div class="form-grupo">
          <label>Respuesta interna al usuario</label>
          <textarea id="lead-respuesta-${l._id}" class="form-input" rows="3" placeholder="Escribe un mensaje interno para el usuario...">${l.respuestaInterna || ''}</textarea>
        </div>
        <button class="btn btn-outline" onclick="enviarRespuestaInterna('${l._id}')" style="padding:10px;border-color:var(--primary);color:var(--primary)">
          📨 Enviar mensaje interno
        </button>` : ''}

      <!-- CONVERSACIÓN -->
      ${l.conversacion?.length ? `
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--text-light);text-transform:uppercase;display:block;margin-bottom:8px">Conversación del chatbot</label>
          <div style="background:var(--bg-secondary);border-radius:12px;padding:16px;max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:8px">
            ${l.conversacion.map(m => `
              <div style="display:flex;justify-content:${m.role === 'user' ? 'flex-end' : 'flex-start'}">
                <div style="max-width:80%;padding:8px 12px;border-radius:10px;font-size:12px;background:${m.role === 'user' ? '#1a3a6e' : 'white'};color:${m.role === 'user' ? 'white' : 'var(--text)'};border:1px solid var(--border)">
                  ${m.text || m.content}
                </div>
              </div>`).join('')}
          </div>
        </div>` : ''}
    </div>`;

  document.getElementById('modal-lead').style.display = 'flex';
};

const cerrarModalLead = () => {
  document.getElementById('modal-lead').style.display = 'none';
};

const guardarNotas = async (id) => {
  const notas = document.getElementById(`lead-notas-${id}`)?.value;
  const data = await api.patch(`/services/leads/${id}`, { notas });
  if (data.ok) {
    cerrarModalLead();
    cargarLeads();
  }
};

const cambiarStatus = async (id, status) => {
  if (!status) return;
  const data = await api.patch(`/services/leads/${id}`, { status });
  if (data.ok) cargarLeads();
};

const eliminarLead = async (id) => {
  const ok = await dsConfirm({ title: '¿Eliminar lead?', message: 'El lead se eliminará permanentemente.', confirmText: 'Eliminar', danger: true });
  if (!ok) return;
  const data = await api.delete(`/services/leads/${id}`);
  if (data.ok) cargarLeads();
};

const cargarStats = async () => {
  const grid = document.getElementById('stats-servicios');
  const data = await api.get('/services/leads');
  if (!data.leads) return;
  const total = data.leads.length;
  const nuevos = data.leads.filter(l => l.status === 'nuevo').length;
  const contactados = data.leads.filter(l => l.status === 'contactado').length;
  const cerrados = data.leads.filter(l => l.status === 'cerrado').length;
  grid.innerHTML = `
    <div class="stat-card azul"><div class="stat-numero">${total}</div><div class="stat-label">Total leads</div></div>
    <div class="stat-card naranja"><div class="stat-numero">${nuevos}</div><div class="stat-label">Nuevos</div></div>
    <div class="stat-card verde"><div class="stat-numero">${contactados}</div><div class="stat-label">Contactados</div></div>
    <div class="stat-card rojo"><div class="stat-numero">${cerrados}</div><div class="stat-label">Cerrados</div></div>`;
};
const exportarExcel = async () => {
  const data = await api.get('/services/leads');
  if (!data.leads || !data.leads.length) { dsToast({ title: 'Sin leads', message: 'No hay leads para exportar.', type: 'error' }); return; }

  const rows = data.leads.map(l => ({
    Nombre: l.nombre,
    Teléfono: l.telefono,
    Email: l.email || '',
    Servicio: l.servicio || '',
    Status: l.status,
    Notas: l.notas || '',
    Fecha: new Date(l.createdAt).toLocaleDateString('es-MX')
  }));

  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  XLSX.writeFile(wb, `leads-vivemas-${new Date().toLocaleDateString('es-MX').replace(/\//g,'-')}.xlsx`);
};

const exportarPDF = async () => {
  const data = await api.get('/services/leads');
  if (!data.leads || !data.leads.length) { dsToast({ title: 'Sin leads', message: 'No hay leads para exportar.', type: 'error' }); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.setTextColor(26, 71, 42);
  doc.text('Vive Más Inmobiliaria', 14, 20);
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`Reporte de Leads — ${new Date().toLocaleDateString('es-MX')}`, 14, 28);

  const rows = data.leads.map(l => [
    l.nombre,
    l.telefono,
    l.email || '-',
    l.servicio || '-',
    l.status,
    new Date(l.createdAt).toLocaleDateString('es-MX')
  ]);

  doc.autoTable({
    startY: 35,
    head: [['Nombre', 'Teléfono', 'Email', 'Servicio', 'Status', 'Fecha']],
    body: rows,
    headStyles: { fillColor: [26, 71, 42] },
    alternateRowStyles: { fillColor: [240, 247, 244] },
    styles: { fontSize: 10 }
  });

  doc.save(`leads-vivemas-${new Date().toLocaleDateString('es-MX').replace(/\//g,'-')}.pdf`);
};
const enviarRespuestaInterna = async (id) => {
  const respuesta = document.getElementById(`lead-respuesta-${id}`)?.value.trim();
  if (!respuesta) { dsToast({ title: 'Falta el mensaje', message: 'Escribe un mensaje antes de enviar.', type: 'error' }); return; }
  const data = await api.patch(`/services/leads/${id}`, { respuestaInterna: respuesta, status: 'contactado' });
  if (data.ok) {
    alert('✓ Mensaje interno enviado al usuario');
    cerrarModalLead();
    cargarLeads();
  }
};