<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mi Panel — Vive Más Inmobiliaria</title>
  <script>(function(){try{var t=JSON.parse(localStorage.getItem('vm_tema')||'{}');if(t&&t.primary){var e=document.createElement('style');e.textContent=':root{--primary:'+t.primary+' !important;--primary-light:'+t.primaryLight+' !important;--accent:'+t.accent+' !important;--accent-dark:'+t.accentDark+' !important;--bg-dark:'+t.bgDark+' !important}';document.head.appendChild(e);}}catch(e){}})();</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700&family=Inter:wght@300;400;500&family=Playfair+Display:wght@600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <link rel="stylesheet" href="../css/styles.css">
  <link rel="stylesheet" href="../css/design-system.css">
  <link rel="stylesheet" href="../css/dashboard-premium.css">
  <link rel="stylesheet" href="../css/dashboard.css">
  <link rel="stylesheet" href="../css/mis-propiedades-workspace.css">
  <link rel="stylesheet" href="../css/topbar-premium.css">

  <!-- ===== ESTILOS DEL PROGRAMA DE EMBAJADORES ===== -->
  <style>
    /* Badge circular de nivel */
    .emb-badge-circle{
      width:80px;height:80px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;flex-direction:column;
      border:2.5px solid;flex-shrink:0;
    }
    .emb-badge-circle .emb-bc-icon{font-size:26px;line-height:1}
    .emb-badge-circle .emb-bc-label{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;margin-top:2px}

    /* Barra de progreso */
    .emb-progress-track{height:10px;background:var(--bg-secondary,#f3f4f6);border-radius:50px;overflow:hidden}
    .emb-progress-fill{height:100%;border-radius:50px;transition:width .8s ease;position:relative}
    .emb-progress-fill::after{content:'';position:absolute;right:0;top:0;bottom:0;width:20px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35));border-radius:50px}
    .emb-progress-locked .emb-progress-fill{background:#e5e7eb!important}
    .emb-progress-locked .emb-progress-fill::after{display:none}

    /* Roadmap de 5 niveles */
    .emb-levels-row{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
    .emb-level-card{background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px 8px;text-align:center;position:relative;transition:all .2s}
    .emb-level-card.current{box-shadow:0 0 0 2px var(--lc-color,var(--primary))}
    .emb-level-card.locked{opacity:.4}
    .emb-lc-check{position:absolute;top:6px;right:6px;width:18px;height:18px;border-radius:50%;background:#22c55e;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px}
    .emb-lc-lock{position:absolute;top:8px;right:8px;font-size:11px;color:#9ca3af}

    /* Botones de compartir */
    .emb-share-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:1px solid var(--border);border-radius:8px;background:#fff;color:var(--text);font-family:inherit;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;text-decoration:none}
    .emb-share-btn:hover{border-color:var(--primary);color:var(--primary)}

    /* Botones de plantilla */
    .emb-tpl-btn{padding:6px 14px;border:1px solid var(--border);border-radius:50px;background:#fff;font-family:inherit;font-size:12px;font-weight:500;color:var(--text-light);cursor:pointer;transition:all .2s}
    .emb-tpl-btn.active{border-color:var(--primary);color:var(--primary);background:rgba(0,0,0,.03)}

    /* Preview del generador */
    .emb-gen-preview{background:var(--bg-secondary,#f9fafb);border:1px solid var(--border);border-radius:12px;padding:20px;display:flex;align-items:center;justify-content:center;min-height:240px;margin-bottom:14px;overflow:hidden}
    .emb-gen-preview img{max-width:100%;max-height:380px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.12)}

    /* Info cards de la landing */
    .emb-info-card{background:#fff;border:1px solid var(--border);border-radius:12px;padding:24px 20px;transition:all .2s}
    .emb-info-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.06);transform:translateY(-2px)}
    .emb-info-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;margin-bottom:14px}
    .emb-info-card h4{font-size:15px;font-weight:700;margin-bottom:10px}
    .emb-info-card ul{list-style:none;padding:0}
    .emb-info-card ul li{font-size:13px;color:var(--text-light);padding:3px 0 3px 16px;position:relative;line-height:1.5}
    .emb-info-card ul li::before{content:'';position:absolute;left:0;top:10px;width:5px;height:5px;border-radius:50%;background:#d1d5db}

    /* Welcome bar */
    .emb-welcome{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;background:#fff;border:1px solid var(--border);border-radius:12px;padding:18px 22px;margin-bottom:20px}
    .emb-code-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(0,0,0,.03);border:1px solid var(--border);padding:7px 14px;border-radius:8px;font-size:13px;font-weight:700;color:var(--primary);letter-spacing:.5px}
    .emb-code-badge i{cursor:pointer;opacity:.5;transition:opacity .2s}
    .emb-code-badge i:hover{opacity:1}

    /* Nivel hero */
    .emb-level-hero{display:flex;align-items:center;gap:24px;background:#fff;border:1px solid var(--border);border-radius:12px;padding:28px;margin-bottom:20px}
    .emb-lock-notice{display:flex;align-items:center;gap:8px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;font-size:12px;color:#991b1b;margin-top:12px}

    /* Responsive */
    @media(max-width:900px){.emb-levels-row{grid-template-columns:repeat(3,1fr)}.emb-level-hero{flex-direction:column;text-align:center;gap:16px}.emb-welcome{flex-direction:column;align-items:flex-start}}
    @media(max-width:600px){.emb-levels-row{grid-template-columns:repeat(2,1fr)}}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
  </style>
</head>
<body>

  <div class="ds-topbar">
    <div class="container ds-topbar-inner">
      <div class="ds-topbar-left">
        <a href="/" class="logo" style="text-decoration:none">
          <span class="logo-vive">Vive</span><span class="logo-mas">Más</span>
          <span class="logo-sub">Inmobiliaria</span>
        </a>
        <div class="ds-topbar-title">
          <div class="kicker">Panel de usuario</div>
          <div class="main">Resumen & publicaciones</div>
        </div>
      </div>

      <div class="ds-topbar-search">
        <span class="icon" aria-hidden="true">
          <span class="li-icon ds-lucide" data-lucide="list"></span>
        </span>
        <input id="ds-global-search" type="text" placeholder="Buscar en tu dashboard..." />
      </div>

            <div class="ds-topbar-right">
        
        <button id="ds-notif-btn" class="ds-icon-btn" type="button" aria-label="Ir al Resumen Ejecutivo" onclick="mostrarSeccion('resumen')" style="cursor:pointer; border-radius: 8px; padding: 6px; display: flex; align-items: center; gap: 8px; background: var(--bg-secondary); border: 1px solid var(--border);">
          <span class="li-icon" data-lucide="dashboard" style="width:20px;height:20px;color:var(--primary)"></span>
        </button>

        <div id="ds-avatar-wrap" style="position:relative">
          <div id="ds-avatar-btn" class="ds-avatar">
            <span id="ds-avatar-bg" class="badge" aria-hidden="true"><span id="ds-user-initials">U</span></span>
            <div class="meta">
              <div class="name" id="ds-user-name">Usuario</div>
              <div class="plan" id="ds-user-plan">Plan</div>
            </div>
          </div>

          <div id="ds-avatar-menu" class="ds-dropdown">
            <div class="ds-dropdown-header">
              <div class="title">Cuenta</div>
              <div class="subtitle">Acciones rápidas</div>
            </div>
            <div class="ds-dropdown-body">
              <div class="ds-dropdown-item" onclick="window.mostrarSeccion && window.mostrarSeccion('mis-propiedades')">
                <div class="t">Mi panel</div>
                <div class="d">Ver propiedades y leads</div>
              </div>
              <div class="ds-dropdown-item" onclick="window.mostrarSeccion && window.mostrarSeccion('nueva-propiedad')">
                <div class="t">Nueva publicación</div>
                <div class="d">Envía tu propiedad en minutos</div>
              </div>
              <div class="ds-dropdown-item" onclick="window.location.href='catalogo.html'">
                <div class="t">Explorar</div>
                <div class="d">Catálogo de propiedades</div>
              </div>
            </div>
            <div class="ds-dropdown-actions">
              <button class="btn btn-outline" style="flex:1" onclick="auth.logout()">Cerrar sesión</button>
              <button class="btn btn-primary" style="flex:1" id="btn-mejorar-plan" onclick="mostrarModalPlanes()">⬆️ Mejorar plan</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>

  <div class="dashboard-layout">
    <aside class="dashboard-sidebar">
      <div class="sidebar-user">
        <div class="user-avatar" id="user-avatar">U</div>
        <div class="user-info">
          <div class="user-name" id="sidebar-nombre">Cargando...</div>
          <div class="user-plan" id="sidebar-plan">plan gratuito</div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <a href="#" class="sidebar-link active" onclick="mostrarSeccion('mis-propiedades')">
          <span class="li-icon" data-lucide="home"></span>
          <span>Mis propiedades</span>
        </a>
        <a href="#" class="sidebar-link" onclick="mostrarSeccion('nueva-propiedad')">
          <span class="li-icon" data-lucide="plus-circle"></span>
          <span>Nueva publicación</span>
        </a>
        <a href="#" class="sidebar-link" onclick="mostrarSeccion('favoritos')">
          <span class="li-icon" data-lucide="heart"></span>
          <span>Favoritos</span>
        </a>
        <a href="#" class="sidebar-link" onclick="mostrarSeccion('leads')">
          <span class="li-icon" data-lucide="list"></span>
          <span>Mis leads</span>
        </a>
        <a href="#" class="sidebar-link" onclick="mostrarSeccion('mensajes')">
          <span class="li-icon" data-lucide="message-square"></span>
          <span style="flex:1;min-width:0">Mensajes</span>
          <span id="mensajes-badge" class="nav-badge" style="display:none">0</span>
        </a>
        <a href="#" class="sidebar-link" onclick="mostrarSeccion('agente-fundador')">
          <span class="li-icon" data-lucide="rocket"></span>
          <span>Embajadores</span>
        </a>
        <a href="#" class="sidebar-link" onclick="mostrarSeccion('mi-cuenta')">
          <span class="li-icon" data-lucide="user"></span>
          <span>Mi cuenta</span>
        </a>
      </nav>
    </aside>

    <main class="dashboard-main">

      <!-- RESUMEN EJECUTIVO -->
      <section id="sec-resumen" class="dash-section">
        <div class="dash-section-header">
          <h2>Resumen ejecutivo</h2>
          <span class="badge-premium" id="resume-plan-pill" style="display:none">Plan: —</span>
        </div>
        
        <div class="resumen-wrapper" id="resumen-ejecutivo-wrapper">
          <div class="resumen-content" id="resume-content">
            <div class="stats-grid" style="margin-bottom:18px" id="resume-stats-grid">
              <div class="stat-card ds-skeleton" style="height:104px"></div>
              <div class="stat-card ds-skeleton" style="height:104px"></div>
              <div class="stat-card ds-skeleton" style="height:104px"></div>
              <div class="stat-card ds-skeleton" style="height:104px"></div>
            </div>
            <div class="form-card" style="padding:18px 18px" id="resume-insights-card">
              <div style="display:flex;gap:14px;align-items:flex-start">
                <div class="stat-icon" style="width:44px;height:44px;border-radius:16px">
                  <span class="li-icon" data-lucide="activity"></span>
                </div>
                <div style="flex:1">
                  <div style="font-size:13px;color:var(--text-light);margin-bottom:6px">Tu actividad reciente</div>
                  <div style="font-weight:800;font-size:16px" id="resume-insights-title">Cargando...</div>
                  <div style="font-size:13px;color:var(--text-light);line-height:1.45;margin-top:6px" id="resume-insights-desc">Estamos preparando tu resumen.</div>
                </div>
              </div>
            </div>
            
            <div style="margin-top: 32px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
                <h3 style="font-size:18px;margin:0;font-family:'Bricolage Grotesque',sans-serif">Mis publicaciones</h3>
                <button class="btn btn-primary" style="padding:8px 16px;font-size:13px" onclick="mostrarSeccion('nueva-propiedad')">+ Nueva</button>
              </div>
              <div id="mis-props-container-resumen" class="mis-props-grid mis-props-view-grid">
                <div class="loading">Cargando tus propiedades...</div>
              </div>
            </div>
          </div>
          
          <div class="lock-overlay">
            <h3>🔒 Función Premium</h3>
            <p>Desbloquea el análisis completo de tus propiedades y métricas avanzadas.</p>
            <button class="btn-upgrade-plan" onclick="mostrarModalPlanes()">Mejorar a Básico</button>
          </div>
        </div>
      </section>

      <!-- MIS PROPIEDADES -->
      <section id="sec-mis-propiedades" class="dash-section mpw" style="display:none">
        <div class="mpw-header">
          <div class="mpw-header-top">
            <div>
              <h2 class="mpw-title">Mis publicaciones</h2>
              <p class="mpw-subtitle">Gestiona y analiza todas tus propiedades desde un solo lugar.</p>
            </div>
            <div class="mpw-header-actions">
              <button type="button" class="btn btn-outline" onclick="cargarMisPropiedades()">Actualizar</button>
              <button class="btn btn-primary" onclick="mostrarSeccion('nueva-propiedad')">+ Nueva publicación</button>
            </div>
          </div>
          <div class="mpw-plan-bar">
            <div class="mpw-plan-bar-track"><div id="mpw-plan-bar-fill" class="mpw-plan-bar-fill" style="width:0%"></div></div>
            <div id="mpw-plan-bar-label" class="mpw-plan-bar-label">Cargando plan...</div>
          </div>
        </div>

        <div id="mpw-health" class="mpw-health"></div>

        <div id="mpw-kpis" class="mpw-kpis"></div>

        <div id="mpw-insights" class="mpw-insights" style="display:none"></div>

        <div class="mpw-body">
          <div class="mpw-main">
            <div class="mpw-filters">
              <div class="mpw-filters-row">
                <input type="text" id="mpw-filtro-buscar" class="form-input mpw-filtro-buscar" placeholder="Buscar por título..." oninput="aplicarFiltrosMisProps()">
                <select id="mpw-filtro-estado" class="form-input" onchange="aplicarFiltrosMisProps()">
                  <option value="">Todos los estados</option>
                  <option value="aprobada">Activa</option>
                  <option value="revision">En revisión</option>
                  <option value="pausada">Pausada</option>
                  <option value="rechazada">Rechazada</option>
                </select>
                <select id="mpw-filtro-tipo" class="form-input" onchange="aplicarFiltrosMisProps()">
                  <option value="">Todos los tipos</option>
                  <option value="casa">Casa</option>
                  <option value="departamento">Departamento</option>
                  <option value="terreno">Terreno</option>
                  <option value="local">Local comercial</option>
                </select>
                <select id="mpw-filtro-operacion" class="form-input" onchange="aplicarFiltrosMisProps()">
                  <option value="">Renta o venta</option>
                  <option value="renta">Renta</option>
                  <option value="venta">Venta</option>
                </select>
                <select id="mpw-filtro-ciudad" class="form-input" onchange="aplicarFiltrosMisProps()">
                  <option value="">Todas las ciudades</option>
                </select>
                <div class="view-toggle" style="display:flex;gap:8px;align-items:center">
                  <button type="button" id="view-grid-btn" class="btn btn-outline active" style="padding:8px 14px;font-size:13px" onclick="cambiarVistaMisProps('grid')">Grid</button>
                  <button type="button" id="view-list-btn" class="btn btn-outline" style="padding:8px 14px;font-size:13px" onclick="cambiarVistaMisProps('tabla')">Tabla</button>
                </div>
              </div>
              <div id="mpw-filtros-activos" class="mpw-filtros-activos"></div>
            </div>

            <div id="mis-props-container" class="mis-props-grid mis-props-view-grid" data-vista="grid">
              <div class="loading">Cargando tus propiedades...</div>
            </div>
          </div>

          <aside class="mpw-sidebar">
            <div class="mpw-feed">
              <div class="mpw-feed-title">Actividad reciente</div>
              <div id="mpw-feed-list" class="mpw-feed-list"></div>
            </div>
          </aside>
        </div>
      </section>

      <!-- NUEVA PROPIEDAD -->
      <section id="sec-nueva-propiedad" class="dash-section" style="display:none">
        <div class="dash-section-header">
          <h2>Nueva publicación</h2>
        </div>
        <div class="form-card">
          <div id="form-error" class="alert alert-error" style="display:none"></div>
          <div id="form-success" class="alert alert-success" style="display:none"></div>

          <div class="ds-stepper" id="publicar-stepper" aria-label="Publicación por pasos">
            <div class="ds-stepper-progress" id="publicar-progress">
              <div class="duo-stepper-progress-bar" id="publicar-progress-bar"></div>
            </div>
            <div class="ds-stepper-steps" id="publicar-steps">
              <button type="button" class="duo-step" data-step="1" onclick="setPublicarStep(1)">1</button>
              <button type="button" class="duo-step" data-step="2" onclick="setPublicarStep(2)">2</button>
              <button type="button" class="duo-step" data-step="3" onclick="setPublicarStep(3)">3</button>
              <button type="button" class="duo-step" data-step="4" onclick="setPublicarStep(4)">4</button>
              <button type="button" class="duo-step" data-step="5" onclick="setPublicarStep(5)">5</button>
              <button type="button" class="duo-step" data-step="6" onclick="setPublicarStep(6)">6</button>
              <button type="button" class="duo-step" data-step="7" onclick="setPublicarStep(7)">7</button>
            </div>
          </div>

          <div class="publicar-steps-content">
            <div class="publicar-step-content" data-step-content="1" style="display:block">
              <div class="form-grid">
                <div class="form-grupo" style="grid-column:1/-1">
                  <label>Título de la propiedad *</label>
                  <input type="text" id="p-titulo" class="form-input" placeholder="Ej: Casa en Colonia Polanco">
                </div>
                <div class="form-grupo" style="grid-column:1/-1">
                  <label>Precio *</label>
                  <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
                    <span style="font-size:13px;color:var(--text-light)">$0</span>
                    <input type="range" id="p-precio-slider" min="0" max="50000000" step="50000" value="0" style="flex:1;accent-color:var(--primary)" oninput="syncPrecio('slider')">
                    <span style="font-size:13px;color:var(--text-light)">$50M</span>
                  </div>
                  <div style="display:flex;gap:10px;align-items:center">
                    <input type="number" id="p-precio" class="form-input" placeholder="Ingresa el precio" min="0" style="flex:1" oninput="syncPrecio('input')">
                    <span id="p-precio-label" style="font-size:15px;font-weight:700;color:var(--primary);white-space:nowrap;min-width:110px;text-align:right">$0 MXN</span>
                  </div>
                </div>
                <div class="form-grupo">
                  <label>Operación *</label>
                  <select id="p-operacion" class="form-input">
                    <option value="">Selecciona</option>
                    <option value="renta">Renta</option>
                    <option value="venta">Venta</option>
                  </select>
                </div>
                <div class="form-grupo">
                  <label>Tipo *</label>
                  <select id="p-tipo" class="form-input">
                    <option value="">Selecciona</option>
                    <option value="casa">Casa</option>
                    <option value="departamento">Departamento</option>
                    <option value="terreno">Terreno</option>
                    <option value="local">Local comercial</option>
                  </select>
                </div>
                <div class="form-grupo" style="grid-column:1/-1;display:none">
                  <label>¿Aceptas créditos o financiamiento? <span style="font-size:11px;color:var(--text-light)">(solo venta)</span></label>
                  <div style="font-size:13px;font-weight:700;margin:14px 0 6px;color:var(--text);text-transform:uppercase;letter-spacing:0.03em">Instituciones de vivienda</div>
                  <div style="display:flex;flex-wrap:wrap;gap:10px">
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="infonavit"> INFONAVIT</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="cofinavit"> Cofinavit</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="fovissste"> FOVISSSTE</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="conavi"> Conavi</label>
                  </div>
                  <div style="font-size:13px;font-weight:700;margin:14px 0 6px;color:var(--text);text-transform:uppercase;letter-spacing:0.03em">Créditos bancarios</div>
                  <div style="display:flex;flex-wrap:wrap;gap:10px">
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="bbva"> BBVA</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="banorte"> Banorte</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="santander"> Santander</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="hsbc"> HSBC</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="scotiabank"> Scotiabank</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="banamex"> Banamex</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="banregio"> Banregio</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="mifel"> Mifel</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="afirme"> Afirme</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="inbursa"> Inbursa</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="banco_azteca"> Banco Azteca (productos específicos)</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="banca_mifel"> Banca Mifel</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="bxplus"> Ve por Más (BX+)</label>
                  </div>
                  <div style="font-size:13px;font-weight:700;margin:14px 0 6px;color:var(--text);text-transform:uppercase;letter-spacing:0.03em">Cajas y organismos</div>
                  <div style="display:flex;flex-wrap:wrap;gap:10px">
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="caja_popular_mexicana"> Caja Popular Mexicana</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="caja_morelia_valladolid"> Caja Morelia Valladolid</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="caja_gonzalo_vega"> Caja Gonzalo Vega</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="caja_san_rafael"> Caja San Rafael</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="pemex"> PEMEX</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="cfe"> CFE</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="banjercito"> Banjército</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="issfam"> ISSFAM</label>
                    <label class="credito-option"><input type="checkbox" class="credito-checkbox" value="imss"> IMSS</label>
                    <label class="credito-option"><input type="text" class="form-input" id="p-credito-otro" placeholder="Otro crédito (especifica)" style="width:220px;padding:8px 12px;font-size:13px"></label>
                  </div>
                </div>
              </div>
            </div>

            <div class="publicar-step-content" data-step-content="2" style="display:none">
              <div class="form-grid">
                <div class="form-grupo" style="grid-column:1/-1">
                  <label>Descripción *</label>
                  <textarea id="p-descripcion" class="form-input" rows="10" placeholder="Describe tu propiedad: características especiales, amenidades, entorno, puntos de interés cercanos..." style="resize:vertical;min-height:200px"></textarea>
                </div>
              </div>
            </div>

            <div class="publicar-step-content" data-step-content="3" style="display:none">
              <div class="form-grid">
                <div class="form-grupo" style="grid-column:1/-1">
                  <label>País</label>
                  <input type="text" class="form-input" value="México" disabled style="background:var(--bg-secondary)">
                </div>
                <div class="form-grupo" style="grid-column:1/-1">
                  <label>Código Postal — autocompleta estado, ciudad y colonia</label>
                  <div style="display:flex;gap:8px">
                    <input type="text" id="p-cp" class="form-input" placeholder="Ej: 06600" maxlength="5" style="flex:1" oninput="buscarPorCP(this.value)">
                    <span id="p-cp-estado" style="display:flex;align-items:center;font-size:13px;color:var(--primary);font-weight:600;white-space:nowrap"></span>
                  </div>
                </div>
                <div class="form-grupo">
                  <label>Estado *</label>
                  <select id="p-estado" class="form-input">
                    <option value="">Selecciona</option>
                    <option value="Aguascalientes">Aguascalientes</option><option value="Baja California">Baja California</option><option value="Baja California Sur">Baja California Sur</option><option value="Campeche">Campeche</option><option value="Chiapas">Chiapas</option><option value="Chihuahua">Chihuahua</option><option value="Ciudad de Mexico">Ciudad de México</option><option value="Coahuila">Coahuila</option><option value="Colima">Colima</option><option value="Durango">Durango</option><option value="Guanajuato">Guanajuato</option><option value="Guerrero">Guerrero</option><option value="Hidalgo">Hidalgo</option><option value="Jalisco">Jalisco</option><option value="Mexico">Estado de México</option><option value="Michoacan">Michoacán</option><option value="Morelos">Morelos</option><option value="Nayarit">Nayarit</option><option value="Nuevo Leon">Nuevo León</option><option value="Oaxaca">Oaxaca</option><option value="Puebla">Puebla</option><option value="Queretaro">Querétaro</option><option value="Quintana Roo">Quintana Roo</option><option value="San Luis Potosi">San Luis Potosí</option><option value="Sinaloa">Sinaloa</option><option value="Sonora">Sonora</option><option value="Tabasco">Tabasco</option><option value="Tamaulipas">Tamaulipas</option><option value="Tlaxcala">Tlaxcala</option><option value="Veracruz">Veracruz</option><option value="Yucatan">Yucatán</option><option value="Zacatecas">Zacatecas</option>
                  </select>
                </div>
                <div class="form-grupo">
                  <label>Ciudad *</label>
                  <input type="text" id="p-ciudad" class="form-input" placeholder="Ej: Guadalajara">
                </div>
                <div class="form-grupo">
                  <label>Colonia</label>
                  <input type="text" id="p-colonia" class="form-input" placeholder="Ej: Polanco">
                </div>
                <div class="form-grupo" style="grid-column:1/-1">
                  <label>Dirección (calle y número)</label>
                  <div style="display:flex;gap:8px">
                    <input type="text" id="p-direccion" class="form-input" placeholder="Ej: Av. Insurgentes 123" style="flex:1">
                    <button type="button" class="btn btn-outline" onclick="buscarDireccion()" style="padding:10px 16px;font-size:13px;white-space:nowrap">📍 Buscar</button>
                  </div>
                  <div style="margin-top:8px;padding:10px 14px;background:#fffbeb;border-radius:8px;border-left:3px solid #f59e0b;font-size:12px;color:#92400e">
                    🔒 <strong>Tu dirección exacta no será visible al público</strong> — solo se mostrará una ubicación aproximada en el mapa para proteger tu privacidad.
                  </div>
                </div>
              </div>
            </div>

            <div class="publicar-step-content" data-step-content="4" style="display:none">
              <div class="form-grid">
                <div class="form-grupo" style="grid-column:1/-1">
                  <label>Ubicación en mapa <span style="font-size:11px;color:var(--text-light)">(haz clic para marcar la ubicación exacta)</span></label>
                  <div id="mapa-publicar" style="height:300px;border-radius:12px;border:1px solid var(--border);margin-top:6px"></div>
                  <div style="display:flex;gap:16px;margin-top:8px">
                    <div style="font-size:12px;color:var(--text-light)">Lat: <span id="coord-lat" style="font-weight:600;color:var(--primary)">--</span></div>
                    <div style="font-size:12px;color:var(--text-light)">Lng: <span id="coord-lng" style="font-weight:600;color:var(--primary)">--</span></div>
                    <div style="font-size:12px;color:var(--text-light)"><span id="coord-estado-label" style="color:var(--primary)"></span></div>
                  </div>
                  <input type="hidden" id="p-lat">
                  <input type="hidden" id="p-lng">
                </div>
              </div>
            </div>

            <div class="publicar-step-content" data-step-content="5" style="display:none">
              <div class="form-grid">
                <div class="form-grupo" style="grid-column:1/-1"><label>Recámaras <span id="label-recamaras" style="color:var(--primary);font-weight:700">0</span></label><div style="display:flex;align-items:center;gap:12px"><input type="range" id="p-recamaras-slider" min="0" max="20" step="1" value="0" style="flex:1;accent-color:var(--primary)" oninput="syncCaracteristica('recamaras')"><input type="number" id="p-recamaras" class="form-input" value="0" min="0" max="20" style="width:80px;text-align:center" oninput="syncCaracteristica('recamaras','input')"></div></div>
                <div class="form-grupo" style="grid-column:1/-1"><label>Baños completos <span id="label-banos" style="color:var(--primary);font-weight:700">0</span></label><div style="display:flex;align-items:center;gap:12px"><input type="range" id="p-banos-slider" min="0" max="10" step="1" value="0" style="flex:1;accent-color:var(--primary)" oninput="syncCaracteristica('banos')"><input type="number" id="p-banos" class="form-input" value="0" min="0" max="10" style="width:80px;text-align:center" oninput="syncCaracteristica('banos','input')"></div></div>
                <div class="form-grupo" style="grid-column:1/-1"><label>Medios baños <span id="label-medios-banos" style="color:var(--primary);font-weight:700">0</span></label><div style="display:flex;align-items:center;gap:12px"><input type="range" id="p-medios-banos-slider" min="0" max="5" step="1" value="0" style="flex:1;accent-color:var(--primary)" oninput="syncCaracteristica('medios-banos')"><input type="number" id="p-medios-banos" class="form-input" value="0" min="0" max="5" style="width:80px;text-align:center" oninput="syncCaracteristica('medios-banos','input')"></div></div>
                <div class="form-grupo" style="grid-column:1/-1"><label>Estacionamientos <span id="label-estacionamientos" style="color:var(--primary);font-weight:700">0</span></label><div style="display:flex;align-items:center;gap:12px"><input type="range" id="p-estacionamientos-slider" min="0" max="10" step="1" value="0" style="flex:1;accent-color:var(--primary)" oninput="syncCaracteristica('estacionamientos')"><input type="number" id="p-estacionamientos" class="form-input" value="0" min="0" max="10" style="width:80px;text-align:center" oninput="syncCaracteristica('estacionamientos','input')"></div></div>
                <div class="form-grupo" style="grid-column:1/-1"><label>Metros cuadrados <span id="label-m2" style="color:var(--primary);font-weight:700">0</span> m²</label><div style="display:flex;align-items:center;gap:12px"><input type="range" id="p-m2-slider" min="0" max="2000" step="5" value="0" style="flex:1;accent-color:var(--primary)" oninput="syncCaracteristica('m2')"><input type="number" id="p-m2" class="form-input" value="0" min="0" style="width:80px;text-align:center" oninput="syncCaracteristica('m2','input')"></div><span style="font-size:13px;color:var(--text-light)">m²</span></div>
              </div>
            </div>

            <div class="publicar-step-content" data-step-content="6" style="display:none">
              <div class="form-grid">
                <div class="form-grupo" style="grid-column:1/-1">
                  <label id="label-fotos-limite">Fotos (JPG/PNG/WEBP, máx 5MB c/u) — <span id="texto-limite-fotos">cargando límite...</span></label>
                  <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
                    <span class="ds-badge ds-badge-primary" id="badge-fotos-count">Fotos: —</span>
                    <span class="ds-badge ds-badge-soft" id="badge-fotos-min">Mínimo 2: Pendiente</span>
                    <span class="ds-badge ds-badge-soft" id="badge-fotos-portada">Portada: Pendiente</span>
                  </div>
                  <div id="p-fotos-drop" class="fotos-drop" style="display:block">
                    <input type="file" id="p-fotos" multiple accept="image/*" onchange="previsualizarFotos(this)" style="display:none">
                    <div class="fotos-drop-inner" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:24px 12px;border:2px dashed var(--border);border-radius:12px;background:var(--bg-secondary);cursor:pointer" onclick="document.getElementById('p-fotos').click()">
                      <div style="font-size:32px">📷</div>
                      <div style="font-weight:700;font-size:15px">Arrastra tus fotos aquí</div>
                      <div style="font-size:12px;color:var(--text-light)">o haz clic para seleccionar (mínimo 2)</div>
                      <button type="button" class="btn btn-outline" style="padding:8px 14px;font-size:13px;margin-top:6px" onclick="event.stopPropagation();document.getElementById('p-fotos').click()">Seleccionar fotos</button>
                    </div>
                  </div>
                  <div id="fotos-preview" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:12px"></div>
                  <div id="fotos-portada-hint" style="margin-top:10px;font-size:12px;color:var(--text-light)">Toca una foto para marcarla como <b>portada</b>. Arrastra para cambiar el orden.</div>
                </div>
              </div>
            </div>

            <div class="publicar-step-content" data-step-content="7" style="display:none">
              <div class="form-grid">
                <div class="form-grupo" style="grid-column:1/-1">
                  <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
                    <span class="ds-badge ds-badge-primary" id="badge-envio-status">Estado: —</span>
                    <span class="ds-badge ds-badge-soft" id="badge-envio-ubic">Ubicación: —</span>
                    <span class="ds-badge ds-badge-soft" id="badge-envio-fotos">Fotos: —</span>
                  </div>
                  <div id="publicar-final-summary" class="alert alert-success" style="display:block">Revisa tus datos y presiona <b>Enviar a revisión</b>.</div>
                </div>
              </div>
            </div>
          </div>

          <div class="publicar-step-actions" style="display:flex;gap:12px;align-items:center;justify-content:space-between;margin-top:18px">
            <button type="button" class="btn btn-outline" id="publicar-back-btn" style="display:none" onclick="publicarPrevStep()">← Atrás</button>
            <button type="button" class="btn btn-primary" id="publicar-next-btn" onclick="publicarNextStep()">Siguiente →</button>
          </div>
          <div id="publicar-submit-wrap" style="display:none">
            <button class="btn btn-primary" style="padding:14px 32px;font-size:16px;margin-top:8px" type="button" onclick="publicarPropiedad()">Enviar a revisión</button>
          </div>
        </div>
      </section>

      <!-- FAVORITOS -->
      <section id="sec-favoritos" class="dash-section" style="display:none">
        <div class="dash-section-header"><h2>Mis favoritos</h2></div>
        <div id="favoritos-grid" class="properties-grid"><div class="loading">Cargando favoritos...</div></div>
      </section>

      <!-- MENSAJES -->
      <section id="sec-mensajes" class="dash-section" style="display:none">
  <div class="dash-section-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
    <h2>Mis mensajes</h2>
  </div>
  <div id="msg-restriccion-banner" style="display:none;background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fde68a;border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#92400e;line-height:1.5">
    <b>🔒 Plan Gratuito:</b> Solo puedes responder <b>1 vez</b> como vendedor en cada conversación. <span style="cursor:pointer;color:#075985;text-decoration:underline;font-weight:600" onclick="mostrarModalPlanes()">Mejorar plan</span>
  </div>
  <div id="msg-chat-container" style="display:grid;grid-template-columns:320px 1fr;gap:0;border:1px solid var(--border);border-radius:12px;overflow:hidden;min-height:500px;background:var(--bg-secondary)">
    <div id="msg-panel-lista" style="border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden">
      <div style="padding:12px;border-bottom:1px solid var(--border)">
        <input type="text" id="msg-buscar" placeholder="Buscar conversación..." style="width:100%;padding:9px 12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none" oninput="filtrarConversaciones(this.value)">
      </div>
      <div id="msg-conversaciones" style="flex:1;overflow-y:auto;padding:6px">
        <div style="padding:30px;text-align:center;color:var(--text-light)">Cargando...</div>
      </div>
    </div>
    <div id="msg-panel-chat" style="display:flex;flex-direction:column;overflow:hidden">
      <div id="msg-vacio" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text-light);padding:30px">
        <div style="font-size:48px;margin-bottom:14px;opacity:0.5">💬</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text)">Selecciona una conversación</div>
        <div style="font-size:13px">Elige un chat de la lista para ver los mensajes</div>
      </div>
      <div id="msg-chat-header" style="display:none;padding:14px 18px;border-bottom:1px solid var(--border);background:var(--bg-secondary)">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div id="msg-chat-nombre" style="font-size:15px;font-weight:700;color:var(--text)"></div>
            <div id="msg-chat-propiedad" style="font-size:12px;color:var(--text-light);margin-top:2px;cursor:pointer;display:none"></div>
          </div>
          <button class="btn btn-outline" style="padding:6px 12px;font-size:12px;color:#6b7280;border-color:#e5e7eb" onclick="mostrarModalReporte({tipo:'mensaje',conversacionId:conversacionActiva})">🚩 Reportar</button>
        </div>
      </div>
      <div id="msg-chat-mensajes" style="display:none;flex:1;overflow-y:auto;padding:18px;flex-direction:column;gap:8px"></div>
      <div id="msg-limite-alcanzado" style="display:none;padding:10px 18px;background:#fef2f2;border-top:1px solid #fecaca;font-size:12px;color:#991b1b;text-align:center">
        🔒 Alcanzaste tu límite de respuestas como vendedor en esta conversación. <span style="cursor:pointer;color:#075985;text-decoration:underline;font-weight:600" onclick="mostrarModalPlanes()">Mejora tu plan</span>
      </div>
      <div id="msg-chat-input-wrap" style="display:none;padding:14px 18px;border-top:1px solid var(--border);background:var(--bg-secondary)">
        <div style="display:flex;gap:10px;align-items:flex-end">
          <textarea id="msg-input" rows="1" placeholder="Escribe tu mensaje..." style="flex:1;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;resize:none;outline:none;max-height:100px;font-family:inherit;line-height:1.4" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();enviarMensajeChat()}" oninput="autoResizeTextarea(this)"></textarea>
          <button id="msg-btn-enviar" onclick="enviarMensajeChat()" style="padding:10px 18px;background:var(--primary);color:white;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap">Enviar</button>
        </div>
      </div>
    </div>
</section>

      <!-- LEADS -->
      <section id="sec-leads" class="dash-section" style="display:none">
        <div class="dash-section-header"><h2>Mis leads</h2></div>
        <div id="leads-usuario-lista" class="mensajes-lista"><div class="loading">Cargando leads...</div></div>
      </section>

      <!-- MI CUENTA -->
      <section id="sec-mi-cuenta" class="dash-section" style="display:none">
        <div class="dash-section-header"><h2>Mi cuenta</h2></div>
        <div class="form-card"><div id="cuenta-info"></div></div>
      </section>

      <!-- ============================================================ -->
      <!-- PROGRAMA DE EMBAJADORES (reemplaza la sección anterior)      -->
      <!-- ============================================================ -->
      <section id="sec-agente-fundador" class="dash-section" style="display:none">
        <div class="dash-section-header">
          <h2>Programa de Embajadores</h2>
          <span id="fund-badge-rango" class="ds-badge ds-badge-soft" style="display:none; font-size:14px; padding: 6px 14px;">Cargando...</span>
        </div>

        <!-- ===== LANDING: No inscrito ===== -->
        <div id="emb-landing">
          <div style="text-align:center; padding: 32px 0 24px;">
            <span class="ds-badge ds-badge-primary" style="font-size:11px; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:14px; display:inline-block;">Programa exclusivo</span>
            <h3 style="font-size:clamp(24px,4vw,32px); font-weight:700; margin-bottom:8px; font-family:'Bricolage Grotesque',sans-serif;">Conviértete en <span style="color:var(--primary)">Embajador</span></h3>
            <p style="color:var(--text-light); max-width:520px; margin:0 auto; font-size:15px;">Crece tu red profesional, obtén reconocimiento y desbloquea beneficios exclusivos como miembro del programa.</p>
          </div>

          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:28px;">
            <!-- Bases -->
            <div class="emb-info-card">
              <div class="emb-info-icon" style="background:rgba(0,0,0,.04); color:var(--primary); border:1px solid rgba(0,0,0,.08);"><i class="fa-solid fa-scale-balanced"></i></div>
              <h4>Bases del Programa</h4>
              <ul>
                <li>Abierto a todos los agentes registrados</li>
                <li>Inscripción gratuita y permanente</li>
                <li>Se asigna un código único de embajador</li>
                <li>Los rangos se obtienen por propiedades publicadas</li>
                <li>El progreso se activa al registrar tu código de referido</li>
                <li>Los beneficios son acumulables e irrevocables</li>
              </ul>
            </div>
            <!-- Cómo funciona -->
            <div class="emb-info-card">
              <div class="emb-info-icon" style="background:rgba(34,197,94,.06); color:#16a34a; border:1px solid rgba(34,197,94,.15);"><i class="fa-solid fa-route"></i></div>
              <h4>Cómo Funciona</h4>
              <ul>
                <li>Da clic en inscribirte — sin formularios</li>
                <li>Recibirás tu código: EMBAJADOR-XXXX</li>
                <li>Ingresa el código de quien te invitó</li>
                <li>Publica propiedades para subir de rango</li>
                <li>Comparte tu enlace en redes sociales</li>
                <li>Genera imágenes de campaña al instante</li>
              </ul>
            </div>
            <!-- Beneficios -->
            <div class="emb-info-card">
              <div class="emb-info-icon" style="background:rgba(168,85,247,.06); color:#9333ea; border:1px solid rgba(168,85,247,.15);"><i class="fa-solid fa-trophy"></i></div>
              <h4>Beneficios por Nivel</h4>
              <ul>
                <li><b>Bronce:</b> Insignia digital y perfil en directorio</li>
                <li><b>Plata:</b> Prioridad en listados de búsqueda</li>
                <li><b>Oro:</b> Badge verificado y mención destacada</li>
                <li><b>Diamante:</b> Sin límites de propiedades premium</li>
                <li><b>Élite:</b> Asesoría personalizada y red exclusiva</li>
              </ul>
            </div>
          </div>

          <div style="text-align:center; padding: 8px 0 32px;">
            <button class="btn btn-primary" style="padding:14px 36px; font-size:15px;" onclick="emb_inscribirse()">Inscribirme como Embajador</button>
            <p style="font-size:12px; color:var(--text-light); margin-top:10px;">Sin costos. Sin compromisos. Un solo clic.</p>
          </div>
        </div>

        <!-- ===== DASHBOARD: Inscrito ===== -->
        <div id="emb-dashboard" style="display:none;">

          <!-- Bienvenida + Código -->
          <div class="emb-welcome">
            <div>
              <div style="font-size:18px; font-weight:700;" id="emb-nombre">Embajador</div>
              <div style="font-size:13px; color:var(--text-light);">Panel de tu programa de embajadores</div>
            </div>
            <div class="emb-code-badge">
              <i class="fa-solid fa-fingerprint"></i>
              <span id="emb-codigo">EMBAJADOR-0000</span>
              <i class="fa-regular fa-copy" onclick="emb_copiarCodigo()" title="Copiar código"></i>
            </div>
          </div>

          <!-- 4 Stats -->
          <div class="stats-grid" style="grid-template-columns:repeat(4,1fr); margin-bottom:20px;">
            <div class="stat-card">
              <div style="font-size:24px; font-weight:700; color:var(--primary);" id="emb-stat-props">0</div>
              <div style="font-size:12px; color:var(--text-light); text-transform:uppercase; letter-spacing:.5px;">Propiedades</div>
            </div>
            <div class="stat-card">
              <div style="font-size:24px; font-weight:700;" id="emb-stat-nivel">Bronce</div>
              <div style="font-size:12px; color:var(--text-light); text-transform:uppercase; letter-spacing:.5px;">Nivel actual</div>
            </div>
            <div class="stat-card">
              <div style="font-size:24px; font-weight:700; color:var(--primary);" id="emb-stat-vistas">0</div>
              <div style="font-size:12px; color:var(--text-light); text-transform:uppercase; letter-spacing:.5px;">Vistas perfil</div>
            </div>
            <div class="stat-card">
              <div style="font-size:24px; font-weight:700; color:var(--text-light);" id="emb-stat-faltantes">0</div>
              <div style="font-size:12px; color:var(--text-light); text-transform:uppercase; letter-spacing:.5px;">Para siguiente</div>
            </div>
          </div>

          <!-- Nivel actual (badge grande + progreso) -->
          <div class="emb-level-hero" id="emb-level-hero">
            <div class="emb-badge-circle" id="emb-badge-large">
              <span class="emb-bc-icon"><i class="fa-solid fa-shield-halved"></i></span>
              <span class="emb-bc-label">BRONCE</span>
            </div>
            <div style="flex:1;">
              <h3 style="font-size:18px; font-weight:700; margin-bottom:4px;" id="emb-level-title">Rango Bronce</h3>
              <p style="font-size:13px; color:var(--text-light); margin-bottom:14px;" id="emb-level-desc">Tu camino como embajador comienza aquí.</p>
              <div class="emb-progress-track" id="emb-progress-wrap">
                <div class="emb-progress-fill" id="emb-progress-fill" style="width:0%"></div>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-light); margin-top:5px;">
                <span id="emb-progress-text">0 / 5 propiedades</span>
                <span id="emb-progress-pct">0%</span>
              </div>
              <div class="emb-lock-notice" id="emb-lock-notice">
                <i class="fa-solid fa-lock"></i>
                <span>Ingresa tu código de referido para activar tu progreso</span>
              </div>
            </div>
          </div>

          <!-- Roadmap de 5 niveles -->
          <div style="font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--text-light); margin-bottom:12px; display:flex; align-items:center; gap:10px;">Rangos del Programa<span style="flex:1; height:1px; background:var(--border); display:block;"></span></div>
          <div class="emb-levels-row" id="emb-levels-row" style="margin-bottom:24px;"></div>

          <!-- Código de referido (una sola vez) -->
          <div class="form-card" id="emb-referral-section" style="margin-bottom:20px;">
            <h4 style="font-size:16px; font-weight:700; margin-bottom:4px;"><i class="fa-solid fa-link" style="color:var(--primary); margin-right:6px;"></i>Registrar mi Referido</h4>
            <p style="font-size:13px; color:var(--text-light); margin-bottom:14px;">Ingresa el código del embajador que te invitó. Esta acción es permanente y solo se realiza una vez.</p>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <input type="text" id="emb-input-referido" class="form-input" placeholder="Ej: EMBAJADOR-1038" autocomplete="off" spellcheck="false" style="flex:1; min-width:200px;" onkeydown="if(event.key==='Enter')emb_registrarReferido()">
              <button class="btn btn-primary" onclick="emb_registrarReferido()">Registrar</button>
            </div>
            <p style="font-size:11px; color:var(--text-light); margin-top:8px;"><i class="fa-solid fa-circle-info" style="margin-right:4px;"></i>Una vez registrado, esta sección desaparecerá permanentemente.</p>
          </div>

          <!-- Redes sociales -->
          <div class="form-card" style="margin-bottom:20px;">
            <h4 style="font-size:16px; font-weight:700; margin-bottom:4px;"><i class="fa-solid fa-share-nodes" style="color:var(--primary); margin-right:6px;"></i>Mis Redes Sociales</h4>
            <p style="font-size:13px; color:var(--text-light); margin-bottom:14px;">Estas redes aparecerán en tu perfil del directorio de embajadores.</p>
            <div class="form-grid">
              <div class="form-grupo">
                <label><i class="fa-brands fa-facebook-f" style="color:#1877f2; margin-right:4px;"></i>Facebook</label>
                <input type="url" id="emb-input-fb" class="form-input" placeholder="https://facebook.com/tu-perfil">
              </div>
              <div class="form-grupo">
                <label><i class="fa-brands fa-instagram" style="color:#e1306c; margin-right:4px;"></i>Instagram</label>
                <input type="url" id="emb-input-ig" class="form-input" placeholder="https://instagram.com/tu-perfil">
              </div>
              <div class="form-grupo" style="grid-column:1/-1;">
                <label><i class="fa-solid fa-globe" style="color:var(--primary); margin-right:4px;"></i>Sitio web</label>
                <input type="url" id="emb-input-web" class="form-input" placeholder="https://tu-sitio-web.com">
              </div>
            </div>
            <button class="btn btn-outline" style="margin-top:12px;" onclick="emb_guardarRedes()"><i class="fa-solid fa-floppy-disk" style="margin-right:4px;"></i>Guardar redes</button>
          </div>

          <!-- Compartir perfil -->
          <div class="form-card" style="margin-bottom:20px;">
            <h4 style="font-size:16px; font-weight:700; margin-bottom:4px;"><i class="fa-solid fa-bullhorn" style="color:var(--primary); margin-right:6px;"></i>Compartir mi Perfil</h4>
            <p style="font-size:13px; color:var(--text-light); margin-bottom:14px;">Comparte tu enlace de embajador para que te sigan y te encuentren en el directorio.</p>
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:14px;">
              <input type="text" id="emb-profile-link" class="form-input" readonly style="margin:0; background:var(--bg-secondary);">
              <button class="btn btn-outline" style="white-space:nowrap;" onclick="emb_copiarLink()"><i class="fa-regular fa-copy"></i> Copiar</button>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <a class="emb-share-btn" id="emb-share-wa" href="#" target="_blank"><i class="fa-brands fa-whatsapp" style="color:#25d366;"></i> WhatsApp</a>
              <a class="emb-share-btn" id="emb-share-fb" href="#" target="_blank"><i class="fa-brands fa-facebook-f" style="color:#1877f2;"></i> Facebook</a>
              <button class="emb-share-btn" onclick="emb_compartirIG()"><i class="fa-brands fa-instagram" style="color:#e1306c;"></i> Instagram</button>
              <button class="emb-share-btn" onclick="emb_compartirNativo()"><i class="fa-solid fa-arrow-up-from-bracket"></i> Compartir</button>
            </div>
          </div>

          <!-- Generador de imágenes de campaña -->
          <div class="form-card" style="margin-bottom:20px;">
            <h4 style="font-size:16px; font-weight:700; margin-bottom:4px;"><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--primary); margin-right:6px;"></i>Generador de Imágenes</h4>
            <p style="font-size:13px; color:var(--text-light); margin-bottom:14px;">Crea imágenes de campaña para compartir en tus redes sociales. Se generan al instante en tu dispositivo.</p>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
              <button class="emb-tpl-btn active" data-tpl="story" onclick="emb_selTpl(this,'story')">Historia WhatsApp</button>
              <button class="emb-tpl-btn" data-tpl="post" onclick="emb_selTpl(this,'post')">Post Instagram / FB</button>
              <button class="emb-tpl-btn" data-tpl="card" onclick="emb_selTpl(this,'card')">Tarjeta de Referido</button>
            </div>
            <div class="emb-gen-preview" id="emb-gen-preview">
              <div id="emb-gen-placeholder" style="text-align:center; color:var(--text-light);">
                <div style="font-size:36px; margin-bottom:10px; opacity:.4;"><i class="fa-regular fa-image"></i></div>
                <p style="font-size:13px;">Selecciona una plantilla y genera tu imagen</p>
              </div>
              <img id="emb-gen-image" src="" alt="Imagen generada" style="display:none;">
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center;">
              <button class="btn btn-primary" onclick="emb_generarImagen()"><i class="fa-solid fa-bolt" style="margin-right:4px;"></i>Generar Imagen</button>
              <button class="btn btn-outline" id="emb-btn-download" style="display:none;" onclick="emb_descargarImagen()"><i class="fa-solid fa-download" style="margin-right:4px;"></i>Descargar</button>
              <button class="btn btn-outline" id="emb-btn-share-img" style="display:none;" onclick="emb_compartirImagen()"><i class="fa-solid fa-share" style="margin-right:4px;"></i>Compartir</button>
            </div>
          </div>

          <!-- Generador de Fichas Profesionales (existente) -->
          <div class="form-card" style="margin-bottom:20px;">
            <h3 style="font-size:16px; margin-bottom:16px;">Generador de Fichas Profesionales</h3>
            <div class="form-grid">
              <div class="form-grupo"><label>Precio *</label><input type="text" id="f-precio" class="form-input" placeholder="Ej: 15000"></div>
              <div class="form-grupo"><label>Recámaras *</label><input type="text" id="f-recamaras" class="form-input" placeholder="Ej: 2"></div>
              <div class="form-grupo" style="grid-column:1/-1;"><label>Ubicación (Colonia, Ciudad) *</label><input type="text" id="f-ubicacion" class="form-input" placeholder="Ej: Polanco, CDMX"></div>
              <div class="form-grupo" style="grid-column:1/-1;"><label>Foto de la propiedad</label><input type="file" id="f-foto" class="form-input" accept="image/*"></div>
              <div class="form-grupo" style="grid-column:1/-1;"><label>O pega la URL de la foto</label><input type="text" id="f-url" class="form-input" placeholder="https://scontent..."></div>
              <div style="grid-column:1/-1;"><button class="btn btn-primary" onclick="generarFichaFundador()" style="width:100%; padding:14px;">Generar Ficha para WhatsApp</button></div>
            </div>
            <div id="f-resultados" style="display:none; margin-top:16px;">
              <div class="form-card" style="text-align:center;">
                <h3 style="margin-top:0; margin-bottom:16px;">Tu ficha está lista</h3>
                <img id="f-imagen-preview" src="" alt="Ficha Generada" style="max-width:100%; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,.1); margin-bottom:20px; display:none;">
                <div style="display:flex; gap:12px; margin-bottom:24px;">
                  <a id="f-btn-descarga" href="#" download="ficha-vivemas.png" class="btn btn-primary" style="flex:1; display:none; text-decoration:none; text-align:center;">Descargar Imagen</a>
                </div>
                <div style="text-align:left;">
                  <label style="font-size:13px; font-weight:600; margin-bottom:6px; display:block;">Link de la propiedad (SEO):</label>
                  <div style="display:flex; gap:8px; margin-bottom:16px;">
                    <input type="text" id="f-link-seo" class="form-input" readonly style="margin:0;">
                    <button class="btn btn-outline" style="padding:8px 16px; white-space:nowrap;" onclick="copiarTexto('f-link-seo')">Copiar</button>
                  </div>
                  <label style="font-size:13px; font-weight:600; margin-bottom:6px; display:block;">Texto para Facebook / Grupos:</label>
                  <textarea id="f-texto-viral" class="form-input" rows="4" style="margin-bottom:12px;"></textarea>
                  <button class="btn btn-outline" style="width:100%;" onclick="copiarTexto('f-texto-viral')">Copiar Texto</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Links de Embajador (existente, mejorado) -->
          <div class="form-card" style="margin-bottom:20px;">
            <h4 style="font-size:16px; font-weight:700; margin-bottom:8px;">Links de Embajador</h4>
            <p style="font-size:13px; color:var(--text-light); margin-bottom:16px;">Comparte tu enlace de embajador. Cuando otro agente se registre con tu enlace, obtendrás puntos para subir de rango.</p>
            <div class="form-grupo">
              <label>Link de tu Perfil Público (Para clientes)</label>
              <div style="display:flex; gap:8px;">
                <input type="text" id="fund-link-perfil" class="form-input" readonly style="margin:0; background:var(--bg-secondary);">
                <button class="btn btn-outline" onclick="copiarTexto('fund-link-perfil')">Copiar</button>
              </div>
            </div>
            <div class="form-grupo" style="margin-top:12px;">
              <label style="color:var(--primary); font-weight:700;">Link de Embajador (Para invitar agentes)</label>
              <div style="display:flex; gap:8px;">
                <input type="text" id="fund-link-embajador" class="form-input" readonly style="margin:0; background:#f0fdf4; border-color:#bbf7d0;">
                <button class="btn btn-primary" onclick="copiarTexto('fund-link-embajador')">Copiar</button>
              </div>
            </div>
          </div>

          <!-- Botón reset demo (solo desarrollo, casi invisible) -->
          <div style="text-align:center; margin-top:24px;">
            <button class="btn btn-outline" onclick="emb_reset()" style="opacity:.2; font-size:11px; padding:4px 12px;">Reiniciar demo</button>
          </div>

        </div>
      </section>
      <!-- ===== FIN PROGRAMA DE EMBAJADORES ===== -->
        
    </main>
  </div>

  <!-- MODAL GENÉRICO DE CONFIRMACIÓN DE CUENTA -->
<div id="modal-confirmar-cuenta" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:10000;align-items:center;justify-content:center">
  <div style="background:white;border-radius:16px;padding:28px;max-width:440px;width:90%">
    <h3 id="mcc-titulo" style="margin-bottom:12px"></h3>
    <div id="mcc-mensaje" style="font-size:13px;color:var(--text-light);line-height:1.6;margin-bottom:14px"></div>
    <div id="mcc-password-wrap" style="display:none;margin-bottom:10px">
      <input type="password" id="mcc-password" class="form-input" placeholder="Tu contraseña">
    </div>
    <div id="mcc-error" style="display:none;font-size:12px;color:#dc2626;margin-bottom:10px"></div>
    <div style="display:flex;gap:10px;margin-top:6px">
      <button id="mcc-confirmar" class="btn btn-primary" style="flex:1" onclick="ejecutarConfirmacionCuenta()">Confirmar</button>
      <button class="btn btn-outline" style="flex:1" onclick="cerrarModalConfirmarCuenta()">Cancelar</button>
    </div>
  </div>
</div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="../js/api.js"></script>
  <script src="../js/comparador.js"></script>
  <script src="../js/auth.js"></script>
  <script src="../js/dashboard.js"></script>
  <script src="../js/session-manager.js"></script>
  <script src="../js/ui/toasts.js"></script>
  <script src="../js/ui/confirm.js"></script>
  <script src="../js/ui/lucide.js"></script>
  <script src="../js/ui/topbar.js"></script>
  <script src="../js/chatbot.js"></script>

  <!-- Font Awesome para iconos del programa de embajadores -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

  <!-- ===== LÓGICA DEL PROGRAMA DE EMBAJADORES ===== -->
  <script>
  (function(){
    'use strict';

    /* ── Configuración de niveles ── */
    var EMB_NIVELES = [
      { nombre:'Bronce',   icono:'fa-shield-halved', desde:0,  hasta:5,  color:'#CD7F32', bg:'rgba(205,127,50,0.07)' },
      { nombre:'Plata',    icono:'fa-shield-halved', desde:5,  hasta:12, color:'#9CA3AF', bg:'rgba(156,163,175,0.07)' },
      { nombre:'Oro',      icono:'fa-crown',         desde:12, hasta:19, color:'#EAB308', bg:'rgba(234,179,8,0.07)' },
      { nombre:'Diamante', icono:'fa-gem',           desde:19, hasta:26, color:'#06B6D4', bg:'rgba(6,182,212,0.07)' },
      { nombre:'Elite',    icono:'fa-star',          desde:26, hasta:36, color:'#A855F7', bg:'rgba(168,85,247,0.07)' }
    ];
    var PROPS_MAX = 36;
    var DESCRIPCIONES = [
      'Tu camino como embajador comienza aqui. Publica propiedades para desbloquear el siguiente rango.',
      'Estas ganando visibilidad. Sigue publicando para acceder a beneficios de prioridad.',
      'Eres un embajador destacado. Tu badge verificado te diferencia en el directorio.',
      'Estas en el nivel mas alto de exposicion. Sin limites en propiedades premium.',
      'Has alcanzado la cuspide del programa. Asesoria exclusiva y red de elite.'
    ];

    /* ── Estado ── */
    var embState = embLoad();
    var selectedTpl = 'story';
    var genImageURL = null;

    function embDefaults(){
      return {
        inscrito: false,
        nombre: 'Carlos Mendoza',
        codigoEmbajador: 'EMBAJADOR-1042',
        propiedades: 3,
        codigoReferidoIngresado: false,
        referidoPor: null,
        redes: { facebook:'', instagram:'', sitioWeb:'' },
        perfilSlug: 'carlos-mendoza',
        vistasPerfil: 47
      };
    }
    function embLoad(){
      try { var s = localStorage.getItem('emb_state'); if(s) { var p = JSON.parse(s); var d = embDefaults(); for(var k in d) if(p[k]===undefined) p[k]=d[k]; return p; } } catch(e){}
      return embDefaults();
    }
    function embSave(){ localStorage.setItem('emb_state', JSON.stringify(embState)); }

    function getNivelIdx(props){
      for(var i=EMB_NIVELES.length-1; i>=0; i--) if(props>=EMB_NIVELES[i].desde) return i;
      return 0;
    }

    /* ── Render principal ── */
    function embRender(){
      var landing = document.getElementById('emb-landing');
      var dash = document.getElementById('emb-dashboard');
      if(!embState.inscrito){ landing.style.display=''; dash.style.display='none'; return; }
      landing.style.display='none'; dash.style.display='';

      var ni = getNivelIdx(embState.propiedades);
      var nv = EMB_NIVELES[ni];

      // Bienvenida
      document.getElementById('emb-nombre').textContent = embState.nombre;
      document.getElementById('emb-codigo').textContent = embState.codigoEmbajador;

      // Stats
      document.getElementById('emb-stat-props').textContent = embState.propiedades;
      var statNivel = document.getElementById('emb-stat-nivel');
      statNivel.textContent = nv.nombre;
      statNivel.style.color = nv.color;
      document.getElementById('emb-stat-vistas').textContent = embState.vistasPerfil;
      var falt = ni<EMB_NIVELES.length-1 ? Math.max(0, nv.hasta-embState.propiedades) : Math.max(0, PROPS_MAX-embState.propiedades);
      document.getElementById('emb-stat-faltantes').textContent = falt;

      // Badge grande
      var badge = document.getElementById('emb-badge-large');
      badge.style.borderColor = nv.color;
      badge.style.background = nv.bg;
      badge.style.color = nv.color;
      badge.innerHTML = '<span class="emb-bc-icon"><i class="fa-solid '+nv.icono+'"></i></span><span class="emb-bc-label">'+nv.nombre.toUpperCase()+'</span>';

      var hero = document.getElementById('emb-level-hero');
      hero.style.borderColor = nv.color;
      hero.style.borderWidth = '2px';
      document.getElementById('emb-level-title').textContent = 'Rango '+nv.nombre;
      document.getElementById('emb-level-title').style.color = nv.color;
      document.getElementById('emb-level-desc').textContent = DESCRIPCIONES[ni];

      // Progreso
      var pWrap = document.getElementById('emb-progress-wrap');
      var pFill = document.getElementById('emb-progress-fill');
      var lock = document.getElementById('emb-lock-notice');
      if(!embState.codigoReferidoIngresado){
        pWrap.classList.add('emb-progress-locked');
        pFill.style.width = '0%';
        lock.style.display = 'flex';
        document.getElementById('emb-progress-text').textContent = 'Progreso bloqueado';
        document.getElementById('emb-progress-pct').textContent = '--';
      } else {
        pWrap.classList.remove('emb-progress-locked');
        var enNivel = embState.propiedades - nv.desde;
        var reqNivel = nv.hasta - nv.desde;
        var pct = Math.min(100, (enNivel/reqNivel)*100);
        pFill.style.width = pct+'%';
        pFill.style.background = nv.color;
        lock.style.display = 'none';
        document.getElementById('emb-progress-text').textContent = embState.propiedades+' / '+nv.hasta+' propiedades';
        document.getElementById('emb-progress-pct').textContent = Math.round(pct)+'%';
      }

      // Badge en header
      var hdrBadge = document.getElementById('fund-badge-rango');
      hdrBadge.style.display = '';
      hdrBadge.textContent = nv.nombre;
      hdrBadge.style.color = nv.color;
      hdrBadge.style.borderColor = nv.color;
      hdrBadge.style.border = '1px solid '+nv.color;

      // Roadmap
      var row = document.getElementById('emb-levels-row');
      row.innerHTML = '';
      for(var i=0; i<EMB_NIVELES.length; i++){
        var n = EMB_NIVELES[i];
        var done = embState.propiedades >= n.hasta || (i===EMB_NIVELES.length-1 && embState.propiedades>=PROPS_MAX);
        var cur = i===ni;
        var lok = i>ni;
        var card = document.createElement('div');
        card.className = 'emb-level-card'+(done?' completed':'')+(cur?' current':'')+(lok?' locked':'');
        if(cur) card.style.setProperty('--lc-color', n.color);
        var extra = done?'<div class="emb-lc-check"><i class="fa-solid fa-check"></i></div>': lok?'<div class="emb-lc-lock"><i class="fa-solid fa-lock"></i></div>':'';
        card.innerHTML = extra+'<div style="font-size:20px; color:'+(lok?'#9ca3af':n.color)+'; margin-bottom:6px;"><i class="fa-solid '+n.icono+'"></i></div><div style="font-size:12px; font-weight:700; color:'+(lok?'#9ca3af':n.color)+';">'+n.nombre+'</div><div style="font-size:10px; color:var(--text-light);">'+n.desde+'+ props</div>';
        row.appendChild(card);
      }

      // Referido (una sola vez)
      document.getElementById('emb-referral-section').style.display = embState.codigoReferidoIngresado ? 'none' : '';

      // Redes
      document.getElementById('emb-input-fb').value = embState.redes.facebook||'';
      document.getElementById('emb-input-ig').value = embState.redes.instagram||'';
      document.getElementById('emb-input-web').value = embState.redes.sitioWeb||'';

      // Link perfil
      var pURL = 'https://tu-sitio.com/directorio/embajador/'+embState.perfilSlug;
      document.getElementById('emb-profile-link').value = pURL;
      var shareText = encodeURIComponent('Conoce al Embajador '+embState.nombre+' - Codigo: '+embState.codigoEmbajador);
      var shareURL = encodeURIComponent(pURL);
      document.getElementById('emb-share-wa').href = 'https://wa.me/?text='+shareText+'%20'+shareURL;
      document.getElementById('emb-share-fb').href = 'https://www.facebook.com/sharer/sharer.php?u='+shareURL;

      // Links embajador
      document.getElementById('fund-link-perfil').value = pURL;
      document.getElementById('fund-link-embajador').value = 'https://tu-sitio.com/embajadores?ref='+embState.codigoEmbajador;

      // Reset generador
      document.getElementById('emb-gen-image').style.display = 'none';
      document.getElementById('emb-gen-placeholder').style.display = '';
      document.getElementById('emb-btn-download').style.display = 'none';
      document.getElementById('emb-btn-share-img').style.display = 'none';
      genImageURL = null;
    }

    /* ── Acciones públicas ── */
    window.emb_inscribirse = function(){
      embState.inscrito = true;
      // En produccion: fetch('/api/founders/register', { method:'POST' })
      embSave();
      embRender();
      embConfetti();
      embToast('Te has inscrito como Embajador. Bienvenido al programa.','success');
    };

    window.emb_registrarReferido = function(){
      var input = document.getElementById('emb-input-referido');
      var codigo = input.value.trim().toUpperCase();
      if(!codigo){ embToast('Ingresa un codigo de embajador','error'); input.focus(); return; }
      if(codigo.indexOf('EMBAJADOR-')!==0){ embToast('El codigo debe comenzar con EMBAJADOR-','error'); input.focus(); return; }
      if(codigo === embState.codigoEmbajador){ embToast('No puedes registrar tu propio codigo','error'); input.focus(); return; }
      embState.codigoReferidoIngresado = true;
      embState.referidoPor = codigo;
      // En produccion: fetch('/api/founders/set-referrer', { method:'POST', body:JSON.stringify({codigo}) })
      embSave();
      embRender();
      embToast('Referido registrado: '+codigo+'. Tu progreso ahora esta activo.','success');
    };

    window.emb_guardarRedes = function(){
      embState.redes.facebook = document.getElementById('emb-input-fb').value.trim();
      embState.redes.instagram = document.getElementById('emb-input-ig').value.trim();
      embState.redes.sitioWeb = document.getElementById('emb-input-web').value.trim();
      // En produccion: fetch('/api/founders/update-socials', { method:'PUT', body:JSON.stringify(embState.redes) })
      embSave();
      embToast('Redes sociales guardadas correctamente','success');
    };

    window.emb_copiarCodigo = function(){
      embCopy(embState.codigoEmbajador);
      embToast('Codigo copiado al portapapeles','success');
    };

    window.emb_copiarLink = function(){
      embCopy(document.getElementById('emb-profile-link').value);
      embToast('Enlace de perfil copiado','success');
    };

    window.emb_compartirIG = function(){
      embCopy(document.getElementById('emb-profile-link').value);
      embToast('Enlace copiado. Pegalo en tu historia o bio de Instagram','info');
    };

    window.emb_compartirNativo = async function(){
      var link = document.getElementById('emb-profile-link').value;
      if(navigator.share){
        try{ await navigator.share({ title:'Embajador '+embState.nombre, text:'Codigo: '+embState.codigoEmbajador, url:link }); }catch(e){}
      } else { embCopy(link); embToast('Enlace copiado al portapapeles','info'); }
    };

    window.emb_selTpl = function(btn, tpl){
      document.querySelectorAll('.emb-tpl-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      selectedTpl = tpl;
    };

    window.emb_generarImagen = async function(){
      await document.fonts.ready;
      var canvas = document.getElementById('embCanvas');
      var ctx = canvas.getContext('2d');
      if(selectedTpl==='story'){ canvas.width=1080; canvas.height=1920; drawStory(ctx,1080,1920); }
      else if(selectedTpl==='post'){ canvas.width=1080; canvas.height=1080; drawPost(ctx,1080,1080); }
      else { canvas.width=1200; canvas.height=630; drawCard(ctx,1200,630); }
      genImageURL = canvas.toDataURL('image/png');
      var img = document.getElementById('emb-gen-image');
      img.src = genImageURL; img.style.display = '';
      document.getElementById('emb-gen-placeholder').style.display = 'none';
      document.getElementById('emb-btn-download').style.display = '';
      document.getElementById('emb-btn-share-img').style.display = '';
      embToast('Imagen generada correctamente','success');
    };

    window.emb_descargarImagen = function(){
      if(!genImageURL) return;
      var a = document.createElement('a');
      a.href = genImageURL;
      a.download = 'embajador-'+embState.codigoEmbajador+'-'+selectedTpl+'.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      embToast('Imagen descargada','success');
    };

    window.emb_compartirImagen = async function(){
      if(!genImageURL) return;
      try{
        var res = await fetch(genImageURL);
        var blob = await res.blob();
        var file = new File([blob], 'embajador.png', {type:'image/png'});
        if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
          await navigator.share({ title:'Embajador '+embState.nombre, files:[file] });
        } else { window.emb_descargarImagen(); embToast('Tu navegador no permite compartir imagenes directamente. Se ha descargado.','info'); }
      }catch(e){ window.emb_descargarImagen(); }
    };

    window.emb_reset = function(){
      localStorage.removeItem('emb_state');
      embState = embDefaults();
      embRender();
      embToast('Demo reiniciado','info');
    };

    /* ── Dibujo Canvas: Story (1080x1920) ── */
    function drawStory(ctx, w, h){
      var ni = getNivelIdx(embState.propiedades);
      var nv = EMB_NIVELES[ni];
      var gold = '#c9a84c', goldL = '#e4c76b';

      // Fondo
      var bg = ctx.createLinearGradient(0,0,w*0.3,h);
      bg.addColorStop(0,'#0a0a14'); bg.addColorStop(0.5,'#0f0f1c'); bg.addColorStop(1,'#0a0a14');
      ctx.fillStyle = bg; ctx.fillRect(0,0,w,h);

      // Lineas verticales sutiles
      ctx.strokeStyle = 'rgba(201,168,76,0.03)'; ctx.lineWidth = 1;
      for(var x=0;x<w;x+=60){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }

      // Linea dorada superior
      var lg = ctx.createLinearGradient(0,0,w,0);
      lg.addColorStop(0,'rgba(201,168,76,0)'); lg.addColorStop(0.3,'rgba(201,168,76,0.6)'); lg.addColorStop(0.7,'rgba(201,168,76,0.6)'); lg.addColorStop(1,'rgba(201,168,76,0)');
      ctx.strokeStyle = lg; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0,120); ctx.lineTo(w,120); ctx.stroke();
      drawDiamond(ctx,w/2,120,8,gold);

      // Titulo
      ctx.textAlign = 'center';
      ctx.fillStyle = gold; ctx.font = '600 28px "Bricolage Grotesque", sans-serif';
      ctx.fillText('PROGRAMA DE', w/2, 240);
      ctx.fillStyle = '#ffffff'; ctx.font = '800 72px "Bricolage Grotesque", sans-serif';
      ctx.fillText('EMBAJADORES', w/2, 330);

      // Sub-linea
      var lg2 = ctx.createLinearGradient(w*0.25,0,w*0.75,0);
      lg2.addColorStop(0,'rgba(201,168,76,0)'); lg2.addColorStop(0.5,'rgba(201,168,76,0.5)'); lg2.addColorStop(1,'rgba(201,168,76,0)');
      ctx.strokeStyle = lg2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(w*0.25,370); ctx.lineTo(w*0.75,370); ctx.stroke();

      // Badge nivel
      ctx.fillStyle = nv.bg; ctx.beginPath(); ctx.arc(w/2,500,70,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = nv.color; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = nv.color; ctx.font = '800 28px "Bricolage Grotesque", sans-serif';
      ctx.fillText(nv.nombre.toUpperCase(), w/2, 495);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '400 14px "Bricolage Grotesque", sans-serif';
      ctx.fillText('RANGO ACTUAL', w/2, 520);

      // Nombre
      ctx.fillStyle = '#ffffff'; ctx.font = '300 32px "Bricolage Grotesque", sans-serif';
      ctx.fillText(embState.nombre, w/2, 640);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '400 18px "Bricolage Grotesque", sans-serif';
      ctx.fillText('Embajador Certificado', w/2, 680);

      // Caja codigo
      var bx=(w-500)/2, by=740;
      ctx.fillStyle = 'rgba(201,168,76,0.06)'; ctx.strokeStyle = 'rgba(201,168,76,0.3)'; ctx.lineWidth = 1.5;
      rRect(ctx,bx,by,500,90,16); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '500 14px "Bricolage Grotesque", sans-serif';
      ctx.fillText('TU CODIGO DE EMBAJADOR', w/2, by+30);
      ctx.fillStyle = goldL; ctx.font = '800 30px "Bricolage Grotesque", sans-serif';
      ctx.fillText(embState.codigoEmbajador, w/2, by+65);

      // Linea inferior
      ctx.strokeStyle = lg; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0,h-400); ctx.lineTo(w,h-400); ctx.stroke();
      drawDiamond(ctx,w/2,h-400,8,gold);

      // CTA
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '500 20px "Bricolage Grotesque", sans-serif';
      ctx.fillText('Unete al programa de embajadores', w/2, h-320);
      ctx.fillStyle = gold; ctx.font = '700 22px "Bricolage Grotesque", sans-serif';
      ctx.fillText('tu-sitio.com/embajadores', w/2, h-280);

      // Borde y esquinas
      ctx.strokeStyle = 'rgba(201,168,76,0.1)'; ctx.lineWidth = 2;
      rRect(ctx,40,40,w-80,h-80,20); ctx.stroke();
      drawCorner(ctx,40,40,30,gold,'tl'); drawCorner(ctx,w-40,40,30,gold,'tr');
      drawCorner(ctx,40,h-40,30,gold,'bl'); drawCorner(ctx,w-40,h-40,30,gold,'br');
    }

    /* ── Dibujo Canvas: Post (1080x1080) ── */
    function drawPost(ctx, w, h){
      var ni = getNivelIdx(embState.propiedades);
      var nv = EMB_NIVELES[ni];
      var gold = '#c9a84c', goldL = '#e4c76b';

      var bg = ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w*0.7);
      bg.addColorStop(0,'#12121f'); bg.addColorStop(1,'#08080f');
      ctx.fillStyle = bg; ctx.fillRect(0,0,w,h);

      ctx.fillStyle = nv.bg; ctx.beginPath(); ctx.arc(w/2,h/2-40,220,0,Math.PI*2); ctx.fill();

      ctx.textAlign = 'center';
      ctx.fillStyle = gold; ctx.font = '600 22px "Bricolage Grotesque", sans-serif';
      ctx.fillText('PROGRAMA DE', w/2, 160);
      ctx.fillStyle = '#ffffff'; ctx.font = '800 56px "Bricolage Grotesque", sans-serif';
      ctx.fillText('EMBAJADORES', w/2, 225);

      var lg = ctx.createLinearGradient(w*0.3,0,w*0.7,0);
      lg.addColorStop(0,'rgba(201,168,76,0)'); lg.addColorStop(0.5,'rgba(201,168,76,0.5)'); lg.addColorStop(1,'rgba(201,168,76,0)');
      ctx.strokeStyle = lg; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(w*0.3,255); ctx.lineTo(w*0.7,255); ctx.stroke();

      ctx.fillStyle = nv.color; ctx.font = '800 24px "Bricolage Grotesque", sans-serif';
      ctx.fillText(nv.nombre.toUpperCase(), w/2, 360);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '400 14px "Bricolage Grotesque", sans-serif';
      ctx.fillText('RANGO ACTUAL', w/2, 385);

      ctx.fillStyle = '#ffffff'; ctx.font = '300 28px "Bricolage Grotesque", sans-serif';
      ctx.fillText(embState.nombre, w/2, 470);

      var bx=(w-420)/2, by=520;
      ctx.fillStyle = 'rgba(201,168,76,0.06)'; ctx.strokeStyle = 'rgba(201,168,76,0.3)'; ctx.lineWidth = 1.5;
      rRect(ctx,bx,by,420,80,14); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '500 12px "Bricolage Grotesque", sans-serif';
      ctx.fillText('CODIGO DE EMBAJADOR', w/2, by+26);
      ctx.fillStyle = goldL; ctx.font = '800 26px "Bricolage Grotesque", sans-serif';
      ctx.fillText(embState.codigoEmbajador, w/2, by+58);

      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '500 18px "Bricolage Grotesque", sans-serif';
      ctx.fillText('tu-sitio.com/embajadores', w/2, 680);

      ctx.strokeStyle = 'rgba(201,168,76,0.1)'; ctx.lineWidth = 2;
      rRect(ctx,30,30,w-60,h-60,16); ctx.stroke();
    }

    /* ── Dibujo Canvas: Tarjeta (1200x630) ── */
    function drawCard(ctx, w, h){
      var ni = getNivelIdx(embState.propiedades);
      var nv = EMB_NIVELES[ni];
      var gold = '#c9a84c', goldL = '#e4c76b';

      var bg = ctx.createLinearGradient(0,0,w,h);
      bg.addColorStop(0,'#0a0a14'); bg.addColorStop(1,'#0f0f1c');
      ctx.fillStyle = bg; ctx.fillRect(0,0,w,h);

      ctx.fillStyle = gold; ctx.fillRect(0,0,6,h);

      ctx.textAlign = 'left';
      ctx.fillStyle = gold; ctx.font = '600 14px "Bricolage Grotesque", sans-serif';
      ctx.fillText('EMBAJADOR CERTIFICADO', 50, 60);
      ctx.fillStyle = '#ffffff'; ctx.font = '800 48px "Bricolage Grotesque", sans-serif';
      ctx.fillText(embState.nombre, 50, 125);
      ctx.fillStyle = nv.color; ctx.font = '700 18px "Bricolage Grotesque", sans-serif';
      ctx.fillText('Rango '+nv.nombre, 50, 170);

      var lg = ctx.createLinearGradient(50,0,500,0);
      lg.addColorStop(0,'rgba(201,168,76,0.4)'); lg.addColorStop(1,'rgba(201,168,76,0)');
      ctx.strokeStyle = lg; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(50,195); ctx.lineTo(500,195); ctx.stroke();

      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '500 14px "Bricolage Grotesque", sans-serif';
      ctx.fillText('CODIGO', w-50, 80);
      ctx.fillStyle = goldL; ctx.font = '800 36px "Bricolage Grotesque", sans-serif';
      ctx.fillText(embState.codigoEmbajador, w-50, 125);

      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '400 16px "Bricolage Grotesque", sans-serif';
      ctx.fillText('Unete como embajador  |  tu-sitio.com/embajadores', 50, h-50);
      ctx.fillStyle = gold; ctx.fillRect(0,h-3,w,3);
    }

    /* ── Utilidades de dibujo ── */
    function rRect(ctx,x,y,w,h,r){
      r=Math.max(0,Math.min(r,Math.min(w,h)/2));
      ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
      ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
      ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
    }
    function drawDiamond(ctx,cx,cy,s,c){
      s=Math.max(1,s); ctx.fillStyle=c; ctx.beginPath(); ctx.moveTo(cx,cy-s); ctx.lineTo(cx+s,cy);
      ctx.lineTo(cx,cy+s); ctx.lineTo(cx-s,cy); ctx.closePath(); ctx.fill();
    }
    function drawCorner(ctx,x,y,s,c,p){
      s=Math.max(1,s); ctx.strokeStyle=c; ctx.lineWidth=2; ctx.beginPath();
      if(p==='tl'){ctx.moveTo(x,y+s);ctx.lineTo(x,y);ctx.lineTo(x+s,y);}
      if(p==='tr'){ctx.moveTo(x-s,y);ctx.lineTo(x,y);ctx.lineTo(x,y+s);}
      if(p==='bl'){ctx.moveTo(x,y-s);ctx.lineTo(x,y);ctx.lineTo(x+s,y);}
      if(p==='br'){ctx.moveTo(x-s,y);ctx.lineTo(x,y);ctx.lineTo(x,y-s);}
      ctx.stroke();
    }

    /* ── Utilidades generales ── */
    function embCopy(text){
      if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text); }
      else { var t=document.createElement('textarea'); t.value=text; t.style.position='fixed'; t.style.left='-9999px'; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); }
    }
    function embToast(msg, type){
      // Usar el sistema de toasts existente si está disponible
      if(window.showToast){ window.showToast(msg, type==='error'?'error':type==='info'?'info':'success'); return; }
      // Fallback simple
      var c = document.getElementById('toast-container') || (function(){ var d=document.createElement('div'); d.id='toast-container'; d.style.cssText='position:fixed;bottom:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;'; document.body.appendChild(d); return d; })();
      var colors = { success:'#065f46', error:'#7f1d1d', info:'#1e1b4b' };
      var borders = { success:'#059669', error:'#dc2626', info:'#4f46e5' };
      var texts = { success:'#a7f3d0', error:'#fca5a5', info:'#c7d2fe' };
      var t = document.createElement('div');
      t.style.cssText = 'padding:12px 18px;border-radius:8px;font-size:13px;font-family:inherit;color:'+texts[type||'success']+';background:'+colors[type||'success']+';border:1px solid '+borders[type||'success']+';box-shadow:0 8px 24px rgba(0,0,0,0.3);transform:translateX(120%);transition:transform .3s;';
      t.textContent = msg;
      c.appendChild(t);
      requestAnimationFrame(function(){ t.style.transform='translateX(0)'; });
      setTimeout(function(){ t.style.transform='translateX(120%)'; setTimeout(function(){ t.remove(); },300); }, 3500);
    }
    function embConfetti(){
      var c = document.createElement('div');
      c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99998;overflow:hidden;';
      document.body.appendChild(c);
      var colors = ['#c9a84c','#e4c76b','#FFD700','#CD7F32','#ffffff','#A855F7','#06B6D4'];
      for(var i=0;i<50;i++){
        var p = document.createElement('div');
        p.style.cssText = 'position:absolute;width:'+(5+Math.random()*8)+'px;height:'+(5+Math.random()*8)+'px;top:-10px;left:'+Math.random()*100+'%;background:'+colors[Math.floor(Math.random()*colors.length)]+';border-radius:'+(Math.random()>.5?'50%':'2px')+';animation:embFall '+(2+Math.random()*2)+'s ease-in '+(Math.random()*1.5)+'s forwards;';
        c.appendChild(p);
      }
      if(!document.getElementById('emb-confetti-style')){
        var s = document.createElement('style'); s.id='emb-confetti-style';
        s.textContent='@keyframes embFall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}';
        document.head.appendChild(s);
      }
      setTimeout(function(){ c.remove(); }, 5000);
    }

    /* ── Init ── */
    embRender();
  })();
  </script>

  <!-- Canvas oculto para generar imágenes del programa de embajadores -->
  <canvas id="embCanvas" style="display:none;"></canvas>

  <script>
    document.addEventListener('DOMContentLoaded', () => {
      if (window.initFotosPublicar) window.initFotosPublicar();
  </script>
</body>
</html>