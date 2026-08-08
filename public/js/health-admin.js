// ==================== CENTRO DE SALUD DEL SISTEMA ====================
// Panel administrativo de infraestructura, recursos y salud del sistema.
// Consume las rutas protegidas /api/admin/health/* (solo rol admin).

let healthTimer = null;

// Utilidades de formato
const fmtMB = (mb) => {
  if (mb == null || isNaN(mb)) return '—';
  if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB';
  return Math.round(mb) + ' MB';
};

const fmtFecha = (f) => {
  if (!f) return '—';
  const d = new Date(f);
  return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
};

const fmtSeg = (s) => {
  if (s == null) return '—';
  if (s < 60) return Math.round(s) + 's';
  if (s < 3600) return Math.round(s / 60) + 'm';
  if (s < 86400) return (s / 3600).toFixed(1) + 'h';
  return (s / 86400).toFixed(1) + 'd';
};

// Estado de un servicio (para el dot)
const estadoClase = (estado) => {
  if (estado === 'normal' || estado === 'bueno' || estado === 'healthy') return 'normal';
  if (estado === 'atencion' || estado === 'warning' || estado === 'advertencia') return 'atencion';
  if (estado === 'critico' || estado === 'emergencia') return 'critico';
  return 'off';
};

// ==================== CARGA DE SNAPSHOT ====================
async function cargarHealthSnapshot() {
  const cont = document.getElementById('health-snapshot');
  if (!cont) return;
  cont.innerHTML = '<div class="loading">Cargando estado del sistema...</div>';

  try {
    const data = await api.get('/admin/health');
    if (!data.ok) throw new Error(data.error || 'Error al obtener salud');

    renderHealthGeneral(data);
    renderHealthTarjetas(data);
    renderHealthAlertas(data.alertas || []);
    renderHealthRiesgos(data);
    renderHealthConfig(data.config);
    renderHealthLogs();
    renderHealthHistorial(7);
  } catch (e) {
    cont.innerHTML = `<div style="padding:24px;color:#dc2626;font-size:14px">❌ ${e.message}</div>`;
  }
}

// ==================== ESTADO GENERAL ====================
function renderHealthGeneral(data) {
  const cont = document.getElementById('health-general');
  if (!cont) return;

  const salud = data.saludGeneral || 0;
  const clase = salud >= 80 ? 'bueno' : salud >= 60 ? 'atencion' : 'critico';
  const servicios = data.servicios || [];
  const criticas = servicios.filter((s) => s.estado === 'critico').length;
  const atencion = servicios.filter((s) => s.estado === 'atencion').length;
  const normales = servicios.filter((s) => s.estado === 'normal').length;

  cont.innerHTML = `
    <div class="health-encabezado">
      <div class="health-puntaje">
        <div class="health-puntaje-num ${clase}">${salud}</div>
        <div>
          <div style="font-size:18px;font-weight:700;font-family:'Bricolage Grotesque',sans-serif;color:var(--text)">SALUD DEL SISTEMA</div>
          <div class="health-encabezado-meta">
            Servicios: ✓ ${normales} · ⚠ ${atencion} · ✗ ${criticas}<br>
            Alertas: ${criticas} críticas · ${atencion} advertencias<br>
            Última revisión: ${fmtFecha(data.ultimaActualizacion)}
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-outline" style="padding:8px 16px;font-size:13px" onclick="cargarHealthSnapshot()">↻ Actualizar</button>
        <button class="btn btn-primary" style="padding:8px 16px;font-size:13px" onclick="ejecutarHealthCheckManual()">▶ Ejecutar health check</button>
      </div>
    </div>
  `;
}

// ==================== TARJETAS DE SERVICIOS ====================
function renderHealthTarjetas(data) {
  const cont = document.getElementById('health-tarjetas');
  if (!cont) return;

  const m = data.metricas || {};
  const servicios = data.servicios || [];
  const estadoDe = (nombre) => {
    const s = servicios.find((x) => x.nombre === nombre);
    return s ? s.estado : 'off';
  };

  let html = '';

  // --- Hostinger ---
  const host = m.hostinger || {};
  const hostEstado = estadoDe('hostinger');
  html += `
    <div class="health-card">
      <div class="health-card-head">
        <div class="health-card-title">HOSTINGER</div>
        <span class="health-dot ${estadoClase(hostEstado)}"></span>
      </div>
      <div class="health-card-body">
        ${host.disponible
          ? `<strong>${fmtMB(host.almacenamientoUsadoMB)}</strong> / ${fmtMB(host.almacenamientoLímiteMB)}<br>${host.almacenamientoPorcentaje || 0}% utilizado`
          : `<em>${host.error || 'Información no disponible mediante API'}</em>`}
      </div>
      ${host.disponible ? `<div class="health-bar"><div class="health-bar-fill ${host.almacenamientoPorcentaje >= 90 ? 'critico' : host.almacenamientoPorcentaje >= 70 ? 'atencion' : 'bueno'}" style="width:${Math.min(host.almacenamientoPorcentaje || 0, 100)}%"></div></div>` : ''}
    </div>`;

  // --- MongoDB ---
  const mongo = m.mongodb || {};
  const mongoEstado = estadoDe('mongodb');
  html += `
    <div class="health-card">
      <div class="health-card-head">
        <div class="health-card-title">MONGODB</div>
        <span class="health-dot ${estadoClase(mongoEstado)}"></span>
      </div>
      <div class="health-card-body">
        ${mongo.cacheado
          ? '<em>Datos cacheados (se actualizan periódicamente)</em>'
          : mongo.healthy
            ? `<strong>${fmtMB(mongo.tamanoBaseMB)}</strong> · ${mongo.nombreBase || '—'}<br>Conexiones: ${mongo.conexionesActivas || 0} · Latencia: ${mongo.latenciaMs || 0}ms`
            : `<em>${mongo.error || 'No saludable'}</em>`}
      </div>
    </div>`;

  // --- Cloudinary ---
  const cloud = m.cloudinary || {};
  const cloudEstado = estadoDe('cloudinary');
  const cloudPct = cloud.almacenamientoPorcentaje || 0;
  html += `
    <div class="health-card">
      <div class="health-card-head">
        <div class="health-card-title">CLOUDINARY</div>
        <span class="health-dot ${estadoClase(cloudEstado)}"></span>
      </div>
      <div class="health-card-body">
        ${cloud.error
          ? `<em>${cloud.error}</em>`
          : `<strong>${fmtMB(cloud.almacenamientoUsadoMB)}</strong> / ${fmtMB(cloud.almacenamientoLímiteMB)}<br>${cloudPct}% utilizado · ${cloud.recursos || 0} recursos`}
      </div>
      ${!cloud.error ? `<div class="health-bar"><div class="health-bar-fill ${cloudPct >= 90 ? 'critico' : cloudPct >= 70 ? 'atencion' : 'bueno'}" style="width:${Math.min(cloudPct, 100)}%"></div></div>` : ''}
    </div>`;

  // --- Node.js ---
  const node = m.node || {};
  const nodeEstado = estadoDe('node');
  html += `
    <div class="health-card">
      <div class="health-card-head">
        <div class="health-card-title">NODE.JS</div>
        <span class="health-dot ${estadoClase(nodeEstado)}"></span>
      </div>
      <div class="health-card-body">
        <strong>${node.version || '—'}</strong> · Uptime: ${fmtSeg(node.uptimeSegundos)}<br>
        CPU: ${node.cpuPorcentaje || 0}% · RAM: ${node.ramPorcentaje || 0}%<br>
        Heap: ${fmtMB(node.heapUsadoMB)} / ${fmtMB(node.heapTotalMB)}
      </div>
      <div class="health-bar"><div class="health-bar-fill ${(node.cpuPorcentaje || 0) >= 90 ? 'critico' : (node.cpuPorcentaje || 0) >= 70 ? 'atencion' : 'bueno'}" style="width:${Math.min(node.cpuPorcentaje || 0, 100)}%"></div></div>
    </div>`;

  // --- Website ---
  const web = m.website || {};
  const webEstado = estadoDe('website');
  html += `
    <div class="health-card">
      <div class="health-card-head">
        <div class="health-card-title">WEBSITE</div>
        <span class="health-dot ${estadoClase(webEstado)}"></span>
      </div>
      <div class="health-card-body">
        ${web.online
          ? `<strong>🟢 ONLINE</strong><br>HTTP: ${web.httpStatus || '—'} · Respuesta: ${web.tiempoRespuestaMs || 0}ms`
          : `<strong>🔴 OFFLINE</strong><br>HTTP: ${web.httpStatus || '—'}`}
      </div>
    </div>`;

  // --- Backups ---
  const bk = m.backups || {};
  const bkEstado = estadoDe('backups');
  html += `
    <div class="health-card">
      <div class="health-card-head">
        <div class="health-card-title">BACKUPS</div>
        <span class="health-dot ${estadoClase(bkEstado)}"></span>
      </div>
      <div class="health-card-body">
        ${bk.estado === 'no_configurado'
          ? '<em>No configurado — no se asume que exista un backup</em>'
          : bk.estado === 'correcto'
            ? `<strong>Último backup:</strong> ${fmtFecha(bk.ultimoBackup)}<br>Tamaño: ${fmtMB(bk.tamanoUltimoMB)}`
            : `<em>${bk.estado || '—'}</em>`}
      </div>
    </div>`;

  cont.innerHTML = html;
}

// ==================== ALERTAS ====================
function renderHealthAlertas(alertas) {
  const cont = document.getElementById('health-alertas');
  if (!cont) return;

  if (!alertas.length) {
    cont.innerHTML = '<div style="font-size:13px;color:var(--text-light)">No hay alertas activas. 🎉</div>';
    return;
  }

  const iconos = { info: 'ℹ️', warning: '⚠️', advertencia: '🟠', critico: '🔴', emergencia: '🚨' };

  cont.innerHTML = alertas.map((a) => `
    <div class="health-alerta ${a.severidad}">
      <div class="health-alerta-icono">${iconos[a.severidad] || 'ℹ️'}</div>
      <div class="health-alerta-body">
        <div class="health-alerta-titulo">${a.servicio.toUpperCase()} — ${a.severidad.toUpperCase()}</div>
        <div class="health-alerta-desc">${a.descripcion || ''}</div>
        ${a.recomendacion ? `<div class="health-alerta-desc" style="color:var(--primary)">💡 ${a.recomendacion}</div>` : ''}
        <div class="health-alerta-fecha">${fmtFecha(a.fecha)}</div>
      </div>
      <button class="btn btn-outline" style="padding:6px 12px;font-size:12px;flex-shrink:0" onclick="atenderHealthAlerta('${a._id}')">Atender</button>
    </div>
  `).join('');
}

async function atenderHealthAlerta(id) {
  try {
    const data = await api.post(`/admin/health/alertas/${id}/atender`);
    if (data.ok) {
      if (typeof dsToast === 'function') dsToast({ title: 'Alerta atendida', message: 'La alerta se marcó como resuelta.', type: 'success' });
      cargarHealthSnapshot();
    }
  } catch (e) {
    if (typeof dsToast === 'function') dsToast({ title: 'Error', message: e.message, type: 'error' });
  }
}

// ==================== RIESGOS ====================
function renderHealthRiesgos(data) {
  const cont = document.getElementById('health-riesgos');
  if (!cont) return;

  // Los riesgos se calculan en el backend; aquí usamos los servicios para una vista rápida
  const servicios = data.servicios || [];
  const criticos = servicios.filter((s) => s.estado === 'critico');
  const atencion = servicios.filter((s) => s.estado === 'atencion');
  const normales = servicios.filter((s) => s.estado === 'normal');

  const items = [
    ...criticos.map((s) => ({ nivel: 'alto', texto: `${s.nombre.toUpperCase()} en estado crítico` })),
    ...atencion.map((s) => ({ nivel: 'medio', texto: `${s.nombre.toUpperCase()} requiere atención` })),
    ...normales.map((s) => ({ nivel: 'bajo', texto: `${s.nombre.toUpperCase()} estable` })),
  ];

  if (!items.length) {
    cont.innerHTML = '<div style="font-size:13px;color:var(--text-light)">Sin riesgos detectados.</div>';
    return;
  }

  cont.innerHTML = items.map((r) => `
    <div class="health-riesgo ${r.nivel}">
      <span>${r.nivel === 'alto' ? '🔴' : r.nivel === 'medio' ? '🟡' : '🟢'}</span>
      <span>${r.texto}</span>
    </div>
  `).join('');
}

// ==================== CONFIGURACIÓN DE UMBRALES ====================
function renderHealthConfig(config) {
  const cont = document.getElementById('health-config');
  if (!cont || !config) return;

  const u = config.umbrales || {};
  const cn = config.cloudinaryNiveles || {};

  cont.innerHTML = `
    <div class="health-config-grid">
      <div class="health-config-item">
        <h4>Storage</h4>
        <label>Warning (%)</label>
        <input type="number" id="cfg-storage-warning" value="${u.storage?.warning || 70}" min="0" max="100">
        <label>Critical (%)</label>
        <input type="number" id="cfg-storage-critical" value="${u.storage?.critical || 90}" min="0" max="100">
      </div>
      <div class="health-config-item">
        <h4>CPU</h4>
        <label>Warning (%)</label>
        <input type="number" id="cfg-cpu-warning" value="${u.cpu?.warning || 70}" min="0" max="100">
        <label>Critical (%)</label>
        <input type="number" id="cfg-cpu-critical" value="${u.cpu?.critical || 90}" min="0" max="100">
      </div>
      <div class="health-config-item">
        <h4>RAM</h4>
        <label>Warning (%)</label>
        <input type="number" id="cfg-ram-warning" value="${u.ram?.warning || 75}" min="0" max="100">
        <label>Critical (%)</label>
        <input type="number" id="cfg-ram-critical" value="${u.ram?.critical || 90}" min="0" max="100">
      </div>
      <div class="health-config-item">
        <h4>MongoDB</h4>
        <label>Warning (%)</label>
        <input type="number" id="cfg-mongodb-warning" value="${u.mongodb?.warning || 70}" min="0" max="100">
        <label>Critical (%)</label>
        <input type="number" id="cfg-mongodb-critical" value="${u.mongodb?.critical || 90}" min="0" max="100">
      </div>
      <div class="health-config-item">
        <h4>Cloudinary</h4>
        <label>Warning (%)</label>
        <input type="number" id="cfg-cloudinary-warning" value="${u.cloudinary?.warning || 70}" min="0" max="100">
        <label>Critical (%)</label>
        <input type="number" id="cfg-cloudinary-critical" value="${u.cloudinary?.critical || 90}" min="0" max="100">
      </div>
      <div class="health-config-item">
        <h4>Backup máx sin actualizar</h4>
        <label>Horas</label>
        <input type="number" id="cfg-backup-horas" value="${config.backupMaxHorasSinActualizar || 48}" min="1">
      </div>
    </div>
    <div style="margin-top:16px;display:flex;gap:10px">
      <button class="btn btn-primary" onclick="guardarHealthConfig()">💾 Guardar umbrales</button>
    </div>
  `;
}

async function guardarHealthConfig() {
  const leer = (id) => parseInt(document.getElementById(id)?.value) || 0;
  const body = {
    umbrales: {
      storage: { warning: leer('cfg-storage-warning'), critical: leer('cfg-storage-critical') },
      cpu: { warning: leer('cfg-cpu-warning'), critical: leer('cfg-cpu-critical') },
      ram: { warning: leer('cfg-ram-warning'), critical: leer('cfg-ram-critical') },
      mongodb: { warning: leer('cfg-mongodb-warning'), critical: leer('cfg-mongodb-critical') },
      cloudinary: { warning: leer('cfg-cloudinary-warning'), critical: leer('cfg-cloudinary-critical') },
    },
    backupMaxHorasSinActualizar: leer('cfg-backup-horas'),
  };

  try {
    const data = await api.put('/admin/health/config', body);
    if (data.ok) {
      if (typeof dsToast === 'function') dsToast({ title: 'Configuración guardada', message: 'Los umbrales se actualizaron correctamente.', type: 'success' });
    }
  } catch (e) {
    if (typeof dsToast === 'function') dsToast({ title: 'Error', message: e.message, type: 'error' });
  }
}

// ==================== LOGS ====================
async function renderHealthLogs() {
  const cont = document.getElementById('health-logs');
  if (!cont) return;

  try {
    const data = await api.get('/admin/health/logs?limite=50');
    const logs = data.logs || [];

    if (!logs.length) {
      cont.innerHTML = '<div style="font-size:13px;color:var(--text-light)">Sin registros de auditoría.</div>';
      return;
    }

    cont.innerHTML = logs.map((l) => `
      <div class="health-logs-fila">
        <span class="log-hora">${fmtFecha(l.fecha)}</span>
        <span class="log-accion">${l.accion}</span>
        <span class="log-resultado ${l.resultado}">${l.resultado}</span>
        <span style="color:var(--text-light)">${l.usuario || '—'}</span>
      </div>
    `).join('');
  } catch (e) {
    cont.innerHTML = `<div style="font-size:13px;color:#dc2626">❌ ${e.message}</div>`;
  }
}

// ==================== HISTORIAL / GRÁFICAS ====================
async function renderHealthHistorial(dias = 7) {
  const cont = document.getElementById('health-historial');
  if (!cont) return;

  try {
    const data = await api.get(`/admin/health/historial?dias=${dias}`);
    const registros = data.registros || [];

    if (!registros.length) {
      cont.innerHTML = '<div style="font-size:13px;color:var(--text-light)">Aún no hay datos históricos suficientes. Se generarán con el tiempo.</div>';
      return;
    }

    // Extraer series
    const fechas = registros.map((r) => new Date(r.timestamp).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' }));
    const cpu = registros.map((r) => r.node?.cpuPorcentaje || 0);
    const ram = registros.map((r) => r.node?.ramPorcentaje || 0);
    const cloud = registros.map((r) => r.cloudinary?.almacenamientoPorcentaje || 0);
    const mongo = registros.map((r) => r.mongodb?.tamanoBaseMB || 0);

    // Gráfica simple con barras (sin librería externa)
    const maxVal = Math.max(...cpu, ...ram, ...cloud, 1);
    const maxMongo = Math.max(...mongo, 1);

    const barra = (val, max, color) => `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">
        <div style="width:100%;height:80px;display:flex;align-items:flex-end;background:var(--bg-secondary);border-radius:6px;overflow:hidden">
          <div style="width:100%;height:${Math.max((val / max) * 100, 2)}%;background:${color};border-radius:4px 4px 0 0"></div>
        </div>
        <div style="font-size:10px;color:var(--text-light)">${val}%</div>
      </div>`;

    cont.innerHTML = `
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:280px">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text)">CPU (%) — últimos ${dias} días</div>
          <div style="display:flex;gap:4px;align-items:flex-end">${cpu.map((v, i) => barra(v, maxVal, '#1a472a')).join('')}</div>
        </div>
        <div style="flex:1;min-width:280px">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text)">RAM (%) — últimos ${dias} días</div>
          <div style="display:flex;gap:4px;align-items:flex-end">${ram.map((v, i) => barra(v, maxVal, '#f4a261')).join('')}</div>
        </div>
        <div style="flex:1;min-width:280px">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text)">Cloudinary (%) — últimos ${dias} días</div>
          <div style="display:flex;gap:4px;align-items:flex-end">${cloud.map((v, i) => barra(v, maxVal, '#e76f51')).join('')}</div>
        </div>
        <div style="flex:1;min-width:280px">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text)">MongoDB (MB) — últimos ${dias} días</div>
          <div style="display:flex;gap:4px;align-items:flex-end">${mongo.map((v, i) => barra(v, maxMongo, '#3b82f6')).join('')}</div>
        </div>
      </div>
      <div style="margin-top:12px;font-size:11px;color:var(--text-light)">Fechas: ${fechas.join(' · ')}</div>
    `;
  } catch (e) {
    cont.innerHTML = `<div style="font-size:13px;color:#dc2626">❌ ${e.message}</div>`;
  }
}

// ==================== HEALTH CHECK MANUAL ====================
async function ejecutarHealthCheckManual() {
  try {
    const data = await api.get('/admin/health');
    if (data.ok) {
      if (typeof dsToast === 'function') dsToast({ title: 'Health check ejecutado', message: `Salud general: ${data.saludGeneral}/100`, type: 'success' });
      cargarHealthSnapshot();
    }
  } catch (e) {
    if (typeof dsToast === 'function') dsToast({ title: 'Error', message: e.message, type: 'error' });
  }
}

// ==================== AUTO-REFRESH ====================
function iniciarHealthAutoRefresh() {
  if (healthTimer) clearInterval(healthTimer);
  // Actualizar cada 30 segundos (configurable en backend)
  healthTimer = setInterval(() => {
    // Solo si la sección está visible
    const sec = document.getElementById('sec-salud');
    if (sec && sec.style.display !== 'none') {
      cargarHealthSnapshot();
    }
  }, 30000);
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  // Si existe la sección de salud, cargar
  if (document.getElementById('sec-salud')) {
    cargarHealthSnapshot();
    iniciarHealthAutoRefresh();
  }
});
