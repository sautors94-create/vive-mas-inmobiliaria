// Panel admin — Marcas y Profesionales Aliados (moderación posterior).
// Las marcas se publican solas; aquí el admin consulta, busca, bloquea, desactiva, elimina
// y envía solicitudes de modificación. Todo se valida de nuevo en el servidor
// (/api/admin/marcas exige sesión de admin) — ocultar botones aquí no es la seguridad.
(() => {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const img = (u) => (typeof u === 'string' && /^https:\/\//i.test(u) ? u : '');
  const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  const fechaCorta = (iso) => (iso ? new Date(iso).toLocaleDateString('es-MX', { dateStyle: 'medium', timeZone: 'UTC' }) : '—');

  const aviso = (title, message, type = 'success') => {
    if (typeof window.dsToast === 'function') window.dsToast({ title, message, type });
    else alert(`${title}\n${message || ''}`);
  };
  const confirmar = async (title, message, confirmText = 'Confirmar', danger = true) => {
    if (typeof window.dsConfirm === 'function') return window.dsConfirm({ title, message, confirmText, danger });
    return confirm(`${title}\n${message}`);
  };

  const ESTADOS = {
    borrador: ['Borrador', '#eef2f7', '#475569'], publicado: ['Publicado', '#e8f5e9', '#2e7d32'],
    despublicado: ['Despublicado', '#fff3e0', '#e65100'], bloqueado: ['Bloqueado', '#fbe9e7', '#bf360c'],
    desactivado: ['Desactivado', '#f3e8ff', '#7e22ce'], eliminado: ['Eliminado', '#fee2e2', '#991b1b'],
  };
  const CAMPOS = { portada: 'Imagen de portada', logo: 'Logotipo', fotoPerfil: 'Fotografía de perfil', galeria: 'Galería', nombre: 'Nombre', descripcion: 'Descripción', servicios: 'Servicios', categorias: 'Categorías', ciudades: 'Ciudades', contacto: 'Contacto', promociones: 'Promociones', otro: 'Otro' };
  const pill = (e) => { const [n, bg, fg] = ESTADOS[e] || [e, '#eee', '#333']; return `<span class="am-pill" style="background:${bg};color:${fg}">${esc(n)}</span>`; };

  const estilos = `
    .am-fila{display:flex;gap:14px;align-items:center;background:#fff;border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:10px;flex-wrap:wrap}
    .am-fila img,.am-fila .am-sin{width:48px;height:48px;border-radius:12px;object-fit:cover;background:var(--bg-secondary);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--primary);flex-shrink:0}
    .am-info{flex:1;min-width:200px}.am-info strong{font-size:15px}.am-sub{font-size:12px;color:var(--text-light);margin-top:2px;line-height:1.5}
    .am-pill{display:inline-block;font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;margin-left:6px;vertical-align:middle}
    .am-alerta{background:#fff3e0;color:#e65100}.am-ok{background:#e3f2fd;color:#1565c0}
    .am-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:12000;display:none;align-items:flex-start;justify-content:center;padding:30px 14px;overflow-y:auto}
    .am-overlay.on{display:flex}.am-modal{background:#fff;border-radius:18px;max-width:880px;width:100%;box-shadow:0 25px 60px rgba(0,0,0,.3)}
    .am-mh{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:18px 22px;border-bottom:1px solid var(--border);position:sticky;top:0;background:#fff;border-radius:18px 18px 0 0;z-index:2}
    .am-mb{padding:20px 22px 26px}.am-x{border:none;background:none;font-size:22px;cursor:pointer;color:var(--text-light)}
    .am-bloque{border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px}.am-bloque h4{font-size:14px;margin-bottom:10px}
    .am-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px;font-size:13px}.am-grid b{display:block;font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
    .am-imgs{display:flex;flex-wrap:wrap;gap:10px}.am-imgs a{display:block}.am-imgs img{height:90px;border-radius:10px;border:1px solid var(--border);object-fit:cover}
    .am-in,.am-ta,.am-sel{width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;box-sizing:border-box;font-family:inherit;margin-bottom:8px}
    .am-ta{min-height:70px;resize:vertical}.am-fila-btns{display:flex;flex-wrap:wrap;gap:8px}
    .am-sol{border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px;font-size:13px}.am-sol.abierta{border-color:#fed7aa;background:#fffaf3}
    .am-log{font-size:12px;border-bottom:1px solid var(--border);padding:7px 0;line-height:1.5}
    @media(max-width:700px){.am-grid{grid-template-columns:1fr}.am-overlay{padding:0}.am-modal{border-radius:0;min-height:100vh}.am-mh{border-radius:0}}
  `;
  const inyectarEstilos = () => { if (document.getElementById('am-estilos')) return; const s = document.createElement('style'); s.id = 'am-estilos'; s.textContent = estilos; document.head.appendChild(s); };

  let pagina = 1;
  let temporizador = null;
  let abierta = null; // id de la marca abierta en el detalle

  const val = (id) => (document.getElementById(id) || {}).value || '';

  // ---------------------------------------------------------- listado
  window.cargarMarcasAdmin = async (p) => {
    inyectarEstilos();
    if (typeof p === 'number') pagina = p;
    const lista = document.getElementById('mar-lista');
    if (!lista) return;
    lista.innerHTML = '<div class="loading">Cargando marcas…</div>';
    const q = new URLSearchParams({ pagina, limite: 20 });
    if (val('mar-q').trim()) q.set('q', val('mar-q').trim());
    if (val('mar-estado')) q.set('estado', val('mar-estado'));
    if (val('mar-solicitudes')) q.set('solicitudes', val('mar-solicitudes'));
    const r = await api.get(`/admin/marcas?${q}`);
    if (!r.ok) { lista.innerHTML = `<div class="loading" style="color:#c62828">${esc(r.error || 'No se pudo cargar el listado.')}</div>`; return; }

    const st = r.stats || {};
    document.getElementById('mar-kpis').innerHTML = ['publicado', 'borrador', 'despublicado', 'bloqueado', 'desactivado', 'eliminado']
      .map((k) => `<div class="mod-kpi-card"><div class="mod-kpi-num">${st[k] || 0}</div><div class="mod-kpi-label">${ESTADOS[k][0]}${(st[k] || 0) === 1 ? '' : 's'}</div></div>`).join('');

    lista.innerHTML = r.marcas.length ? r.marcas.map((m) => `
      <div class="am-fila">
        ${img(m.imagen) ? `<img src="${img(m.imagen)}" alt="">` : `<div class="am-sin">${esc((m.nombre || '?')[0].toUpperCase())}</div>`}
        <div class="am-info">
          <strong>${esc(m.nombre)}</strong>${pill(m.estado)}
          ${m.ocultoPorModeracion ? '<span class="am-pill am-alerta">Oculta por moderación</span>' : ''}
          ${m.solicitudesAbiertas ? `<span class="am-pill am-alerta">${m.solicitudesAbiertas} solicitud(es) abierta(s)</span>` : ''}
          ${m.solicitudesAtendidas ? `<span class="am-pill am-ok">${m.solicitudesAtendidas} atendida(s) por revisar</span>` : ''}
          <div class="am-sub">${esc(m.cuenta.email || '—')} · ${esc(m.cuenta.telefono || '—')}</div>
          <div class="am-sub">${esc((m.categorias || []).join(', ') || 'Sin categorías')} · ${esc((m.ciudades || []).slice(0, 4).join(', ') || 'Sin ciudades')}${(m.ciudades || []).length > 4 ? '…' : ''}</div>
        </div>
        <button class="btn btn-outline" style="padding:8px 16px;font-size:13px" onclick="abrirMarcaAdmin('${esc(m.id)}')">Ver y moderar</button>
      </div>`).join('') : '<div class="loading">No hay marcas con esos criterios.</div>';

    document.getElementById('mar-paginacion').innerHTML = r.paginas > 1 ? `
      <button class="btn btn-outline" ${r.pagina <= 1 ? 'disabled' : ''} onclick="cargarMarcasAdmin(${r.pagina - 1})">← Anterior</button>
      <span style="font-size:13px;color:var(--text-light)">Página ${r.pagina} de ${r.paginas} · ${r.total} marcas</span>
      <button class="btn btn-outline" ${r.pagina >= r.paginas ? 'disabled' : ''} onclick="cargarMarcasAdmin(${r.pagina + 1})">Siguiente →</button>` : `<span style="font-size:13px;color:var(--text-light)">${r.total} marca(s)</span>`;
  };

  window.buscarMarcasAdmin = () => { clearTimeout(temporizador); temporizador = setTimeout(() => { pagina = 1; cargarMarcasAdmin(); }, 300); };
  window.filtrarMarcasAdmin = () => { pagina = 1; cargarMarcasAdmin(); };

  // ---------------------------------------------------------- modal genérico
  const modal = (id, titulo, cuerpo) => {
    let o = document.getElementById(id);
    if (!o) { o = document.createElement('div'); o.id = id; o.className = 'am-overlay'; document.body.appendChild(o); o.addEventListener('click', (e) => { if (e.target === o) o.classList.remove('on'); }); }
    o.innerHTML = `<div class="am-modal"><div class="am-mh"><h3 style="margin:0">${titulo}</h3><button class="am-x" aria-label="Cerrar" onclick="this.closest('.am-overlay').classList.remove('on')">✕</button></div><div class="am-mb">${cuerpo}</div></div>`;
    o.classList.add('on');
    return o;
  };

  // ---------------------------------------------------------- detalle
  window.abrirMarcaAdmin = async (id) => {
    inyectarEstilos();
    abierta = id;
    const r = await api.get(`/admin/marcas/${id}`);
    if (!r.ok) return aviso('No se pudo abrir', r.error || '', 'error');
    const m = r.marca; const c = m.contacto || {}; const redes = c.redes || {};
    const cta = m.cuenta || {};
    const noPublicable = ['bloqueado', 'desactivado', 'eliminado'].includes(m.estado);
    const imagenes = [m.logo, m.fotoPerfil, m.portada, ...(m.galeria || [])].filter(img);

    const acciones = `
      <div class="am-bloque">
        <h4>Acciones de moderación</h4>
        <textarea class="am-ta" id="am-motivo" placeholder="Motivo (obligatorio para bloquear; opcional para desactivar o eliminar)"></textarea>
        <div class="am-fila-btns">
          ${m.estado !== 'bloqueado' && m.estado !== 'eliminado' ? '<button class="btn btn-outline" style="border-color:#c62828;color:#c62828" onclick="moderarMarca(\'bloquear\')">⛔ Bloquear</button>' : ''}
          ${!noPublicable ? '<button class="btn btn-outline" onclick="moderarMarca(\'desactivar\')">Desactivar</button>' : ''}
          ${noPublicable ? '<button class="btn btn-outline" style="border-color:#2e7d32;color:#2e7d32" onclick="moderarMarca(\'reactivar\')">♻️ Reactivar</button>' : ''}
          ${m.estado !== 'eliminado' ? '<button class="btn btn-outline" style="border-color:#c62828;color:#c62828" onclick="moderarMarca(\'eliminar\')">🗑️ Eliminar</button>' : '<button class="btn btn-outline" style="border-color:#991b1b;color:#991b1b" onclick="moderarMarca(\'purgar\')">Eliminar definitivamente</button>'}
        </div>
        <div class="am-sub" style="margin-top:8px"><b>Bloquear</b>: oculta la marca y evita que se republique. <b>Desactivar</b>: la retira del directorio sin sanción. <b>Eliminar</b>: eliminación lógica (los datos se conservan; se puede restaurar). La eliminación definitiva borra la marca y sus imágenes; la bitácora se conserva.</div>
        ${m.estado === 'bloqueado' && m.motivoBloqueo ? `<div class="am-sub" style="margin-top:6px"><b>Motivo del bloqueo:</b> ${esc(m.motivoBloqueo)}</div>` : ''}
      </div>`;

    const form = `
      <div class="am-bloque">
        <h4>Solicitar modificación al proveedor</h4>
        <select class="am-sel" id="am-sol-campo">${Object.entries(CAMPOS).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>
        <input class="am-in" id="am-sol-motivo" maxlength="200" placeholder="Motivo (ej. Fotografía de portada inadecuada)">
        <textarea class="am-ta" id="am-sol-msg" maxlength="2000" placeholder="Mensaje para el proveedor: qué debe corregir y cómo"></textarea>
        <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-bottom:10px"><input type="checkbox" id="am-sol-ocultar"> Ocultar la marca del directorio mientras corrige (si no, sigue publicada)</label>
        <button class="btn btn-primary" onclick="enviarSolicitudMarca()">Enviar solicitud</button>
      </div>`;

    const sols = (r.solicitudes || []).map((s) => `
      <div class="am-sol ${s.estado === 'abierta' ? 'abierta' : ''}">
        <strong>${esc(s.motivo)}</strong> · ${esc(CAMPOS[s.campo] || 'Otro')} · <b>${esc(s.estado)}</b>${s.ocultarMientras ? ' · oculta mientras' : ''}
        <div class="am-sub">${fecha(s.createdAt)} por ${esc(s.creadaPorNombre || 'admin')}</div>
        <div style="margin:6px 0;white-space:pre-line">${esc(s.mensaje)}</div>
        ${s.notaProveedor ? `<div class="am-sub"><b>Respuesta del proveedor:</b> ${esc(s.notaProveedor)}</div>` : ''}
        <div class="am-fila-btns" style="margin-top:6px">
          ${['abierta', 'atendida'].includes(s.estado) ? `<button class="btn btn-outline" style="padding:5px 12px;font-size:12px" onclick="gestionarSolicitudMarca('${esc(s._id)}','resolver')">Marcar resuelta</button><button class="btn btn-outline" style="padding:5px 12px;font-size:12px" onclick="gestionarSolicitudMarca('${esc(s._id)}','cancelar')">Cancelar</button>` : ''}
          ${['atendida', 'resuelta'].includes(s.estado) ? `<button class="btn btn-outline" style="padding:5px 12px;font-size:12px" onclick="gestionarSolicitudMarca('${esc(s._id)}','reabrir')">Reabrir</button>` : ''}
        </div>
      </div>`).join('') || '<div class="am-sub">Sin solicitudes.</div>';

    const promos = (m.promociones || []).map((p) => `<div class="am-sub" style="margin-bottom:6px">🏷️ <b>${esc(p.titulo || (p.porcentaje ? p.porcentaje + '%' : p.tipo))}</b> — ${esc(p.descripcion)} <i>(${p.activa ? (p.vigente ? 'vigente' : 'fuera de vigencia') : 'inactiva'}${p.vigenciaFin ? ', hasta ' + fechaCorta(p.vigenciaFin) : ''})</i>${p.condiciones ? `<br>Condiciones: ${esc(p.condiciones)}` : ''}</div>`).join('') || '<div class="am-sub">Sin promociones.</div>';

    const log = (r.auditoria || []).map((a) => `<div class="am-log"><b>${esc(a.accion)}</b> · ${fecha(a.createdAt)} · ${esc(a.adminNombre || a.adminEmail)}${a.detalle ? ` — ${esc(a.detalle)}` : ''}</div>`).join('') || '<div class="am-sub">Sin acciones registradas.</div>';

    modal('am-detalle', `${esc(m.nombreComercial || '(sin nombre)')} ${pill(m.estado)}`, `
      ${m.ocultoPorModeracion ? '<div class="am-bloque" style="background:#fff3e0;border-color:#fed7aa">Esta marca está oculta del directorio mientras haya una solicitud abierta con “ocultar”.</div>' : ''}
      <div class="am-bloque"><h4>Cuenta (privado)</h4><div class="am-grid">
        <div><b>Correo de acceso</b>${esc(cta.email || '—')} ${cta.emailVerificado ? '✅' : ''}</div>
        <div><b>Teléfono de acceso</b>${esc(cta.telefono || '—')} ${cta.telefonoVerificado ? '✅' : ''}</div>
        <div><b>Último acceso</b>${fecha(cta.ultimoAcceso)}</div>
        <div><b>Creada</b>${fecha(m.createdAt)}</div>
        <div><b>Publicada</b>${fecha(m.publicadoEn)}</div>
        <div><b>Perfil público</b>${m.estado === 'publicado' && !m.ocultoPorModeracion ? `<a target="_blank" rel="noopener" href="marca.html?s=${encodeURIComponent(m.slug)}">/marca.html?s=${esc(m.slug)}</a>` : 'No visible'}</div>
      </div></div>
      <div class="am-bloque"><h4>Perfil</h4><div class="am-grid">
        <div><b>Responsable</b>${esc(m.responsable || '—')}</div>
        <div><b>Perfil completo</b>${r.completitud.completa ? 'Sí' : 'No: ' + esc(r.completitud.faltantes.join('; '))}</div>
        <div><b>Categorías</b>${esc((m.categorias || []).map((x) => x.nombre).join(', ') || '—')}</div>
        <div><b>Ciudades</b>${esc((m.ciudades || []).map((x) => x.nombre).join(', ') || '—')}</div>
        <div><b>Servicios</b>${esc((m.servicios || []).join(', ') || '—')}</div>
        <div><b>Zonas adicionales</b>${esc((m.zonasAdicionales || []).join(', ') || '—')}</div>
      </div>
      <div style="margin-top:12px;font-size:13px;white-space:pre-line"><b style="font-size:11px;color:var(--text-light)">DESCRIPCIÓN BREVE</b><br>${esc(m.descripcionCorta || '—')}</div>
      <div style="margin-top:10px;font-size:13px;white-space:pre-line"><b style="font-size:11px;color:var(--text-light)">DESCRIPCIÓN</b><br>${esc(m.descripcion || '—')}</div>
      <div style="margin-top:10px;font-size:13px;white-space:pre-line"><b style="font-size:11px;color:var(--text-light)">SERVICIOS (DETALLE)</b><br>${esc(m.serviciosDetalle || '—')}</div></div>
      <div class="am-bloque"><h4>Contacto publicado</h4><div class="am-grid">
        <div><b>Teléfono</b>${esc(c.telefono || '—')}</div><div><b>WhatsApp</b>${esc(c.whatsapp || '—')}</div>
        <div><b>Correo</b>${esc(c.email || '—')}</div><div><b>Sitio web</b>${esc(c.sitioWeb || '—')}</div>
        <div style="grid-column:1/-1"><b>Redes</b>${esc(Object.entries(redes).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—')}</div>
      </div></div>
      <div class="am-bloque"><h4>Imágenes (${imagenes.length})</h4>${imagenes.length ? `<div class="am-imgs">${imagenes.map((u) => `<a href="${u}" target="_blank" rel="noopener"><img src="${u}" alt="" loading="lazy"></a>`).join('')}</div>` : '<div class="am-sub">Sin imágenes.</div>'}</div>
      <div class="am-bloque"><h4>Promociones</h4>${promos}</div>
      ${acciones}${form}
      <div class="am-bloque"><h4>Solicitudes de modificación</h4>${sols}</div>
      <div class="am-bloque"><h4>Bitácora de acciones</h4>${log}</div>`);
  };

  const refrescar = async () => { await abrirMarcaAdmin(abierta); await cargarMarcasAdmin(); };

  window.moderarMarca = async (accion) => {
    const motivo = val('am-motivo').trim();
    if (accion === 'bloquear' && motivo.length < 5) return aviso('Falta el motivo', 'Escribe el motivo del bloqueo (mínimo 5 caracteres).', 'error');
    const textos = {
      bloquear: ['¿Bloquear esta marca?', 'Dejará de aparecer en el directorio y no podrá volver a publicarse hasta que la reactives.', 'Bloquear'],
      desactivar: ['¿Desactivar esta marca?', 'Se retira del directorio sin sanción. Sus datos se conservan.', 'Desactivar'],
      reactivar: ['¿Reactivar esta marca?', 'Quedará despublicada; el proveedor decidirá cuándo volver a publicarla.', 'Reactivar'],
      eliminar: ['¿Eliminar esta marca?', 'Se oculta de todo el sitio. Los datos se conservan y podrás restaurarla o eliminarla definitivamente.', 'Eliminar'],
      purgar: ['¿Eliminar DEFINITIVAMENTE?', 'Se borran la marca, sus imágenes y solicitudes. Esta acción no se puede deshacer. La bitácora se conserva.', 'Eliminar definitivamente'],
    }[accion];
    if (!(await confirmar(textos[0], textos[1], textos[2], accion !== 'reactivar'))) return;
    let r;
    if (accion === 'purgar') r = await api.delete(`/admin/marcas/${abierta}?definitivo=true`, { confirmar: true });
    else if (accion === 'eliminar') r = await api.delete(`/admin/marcas/${abierta}`, { motivo });
    else r = await api.post(`/admin/marcas/${abierta}/${accion}`, { motivo });
    if (!r.ok) return aviso('No se pudo completar', r.error || '', 'error');
    aviso('Listo', r.mensaje);
    if (accion === 'purgar') { document.getElementById('am-detalle')?.classList.remove('on'); return cargarMarcasAdmin(); }
    refrescar();
  };

  window.enviarSolicitudMarca = async () => {
    const cuerpo = { campo: val('am-sol-campo'), motivo: val('am-sol-motivo').trim(), mensaje: val('am-sol-msg').trim(), ocultarMientras: !!document.getElementById('am-sol-ocultar')?.checked };
    if (cuerpo.motivo.length < 3 || cuerpo.mensaje.length < 10) return aviso('Faltan datos', 'Escribe el motivo y un mensaje claro (mínimo 10 caracteres).', 'error');
    const r = await api.post(`/admin/marcas/${abierta}/solicitudes`, cuerpo);
    if (!r.ok) return aviso('No se pudo enviar', r.error || '', 'error');
    aviso('Solicitud enviada', r.mensaje);
    refrescar();
  };

  window.gestionarSolicitudMarca = async (sid, accion) => {
    const r = await api.patch(`/admin/marcas/${abierta}/solicitudes/${sid}`, { accion });
    if (!r.ok) return aviso('No se pudo actualizar', r.error || '', 'error');
    aviso('Listo', r.mensaje);
    refrescar();
  };

  // ---------------------------------------------------------- catálogos (categorías y ciudades)
  window.abrirCatalogosMarcas = async () => {
    inyectarEstilos();
    const r = await api.get('/admin/marcas/catalogos');
    if (!r.ok) return aviso('No se pudo cargar', r.error || '', 'error');
    const filas = (r.categorias || []).map((c) => `
      <div class="am-fila" style="padding:10px 12px;margin-bottom:6px">
        <div class="am-info"><input class="am-in" style="margin:0" id="cat-n-${esc(c._id)}" value="${esc(c.nombre)}" maxlength="80"><div class="am-sub">${c.marcas} marca(s) · ${c.activa ? 'activa' : 'inactiva'}</div></div>
        <button class="btn btn-outline" style="padding:6px 12px;font-size:12px" onclick="guardarCategoriaMarca('${esc(c._id)}', ${c.activa ? 'true' : 'false'}, false)">Renombrar</button>
        <button class="btn btn-outline" style="padding:6px 12px;font-size:12px" onclick="guardarCategoriaMarca('${esc(c._id)}', ${c.activa ? 'true' : 'false'}, true)">${c.activa ? 'Desactivar' : 'Activar'}</button>
      </div>`).join('');
    const ciudades = (r.ciudades || []).map((c) => `
      <div class="am-fila am-ciudad" data-n="${esc((c.nombre + ' ' + c.estado).toLowerCase())}" style="padding:8px 12px;margin-bottom:6px">
        <div class="am-info"><strong style="font-size:13px">${esc(c.nombre)}</strong> <span class="am-sub">${esc(c.estado)} · ${c.marcas} marca(s) · ${esc(c.origen)}</span></div>
        <button class="btn btn-outline" style="padding:5px 12px;font-size:12px" onclick="alternarCiudadMarca('${esc(c._id)}', ${c.activa ? 'false' : 'true'})">${c.activa ? 'Desactivar' : 'Activar'}</button>
      </div>`).join('');
    modal('am-catalogos', 'Categorías y ciudades', `
      <div class="am-bloque"><h4>Categorías de servicio</h4>${filas}
        <div style="display:flex;gap:8px;margin-top:10px"><input class="am-in" style="margin:0" id="cat-nueva" maxlength="80" placeholder="Nueva categoría"><button class="btn btn-primary" onclick="crearCategoriaMarca()">Agregar</button></div>
        <div class="am-sub" style="margin-top:6px">Desactivar una categoría la oculta de filtros y panel; las marcas que ya la tienen no se modifican.</div></div>
      <div class="am-bloque"><h4>Ciudades</h4>
        <input class="am-in" id="ciudad-buscar" placeholder="Buscar ciudad…" oninput="filtrarCiudadesMarcas()">
        <div style="max-height:300px;overflow-y:auto">${ciudades}</div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><input class="am-in" style="margin:0;flex:1;min-width:140px" id="ciudad-nueva" maxlength="80" placeholder="Nueva ciudad"><input class="am-in" style="margin:0;flex:1;min-width:140px" id="ciudad-estado" maxlength="80" placeholder="Estado"><button class="btn btn-primary" onclick="crearCiudadMarca()">Agregar</button></div></div>`);
  };
  window.filtrarCiudadesMarcas = () => { const q = val('ciudad-buscar').toLowerCase(); document.querySelectorAll('.am-ciudad').forEach((f) => { f.style.display = f.dataset.n.includes(q) ? '' : 'none'; }); };
  window.crearCategoriaMarca = async () => { const r = await api.post('/admin/marcas/catalogos/categorias', { nombre: val('cat-nueva') }); if (!r.ok) return aviso('No se pudo crear', r.error || '', 'error'); aviso('Categoría creada', ''); abrirCatalogosMarcas(); };
  window.guardarCategoriaMarca = async (id, activa, alternar) => {
    const r = await api.put(`/admin/marcas/catalogos/categorias/${id}`, { nombre: val(`cat-n-${id}`), activa: alternar ? !activa : activa });
    if (!r.ok) return aviso('No se pudo guardar', r.error || '', 'error'); aviso('Categoría actualizada', ''); abrirCatalogosMarcas();
  };
  window.crearCiudadMarca = async () => { const r = await api.post('/admin/marcas/catalogos/ciudades', { nombre: val('ciudad-nueva'), estado: val('ciudad-estado') }); if (!r.ok) return aviso('No se pudo crear', r.error || '', 'error'); aviso('Ciudad creada', ''); abrirCatalogosMarcas(); };
  window.alternarCiudadMarca = async (id, activa) => { const r = await api.put(`/admin/marcas/catalogos/ciudades/${id}`, { activa }); if (!r.ok) return aviso('No se pudo guardar', r.error || '', 'error'); abrirCatalogosMarcas(); };
})();