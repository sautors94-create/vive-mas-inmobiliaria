# Plan de correcciones — COMPLETADO ✅

## 1. Mapa - Mostrar aproximación 100m + botones Google Maps/Waze ✅

### Cambios realizados:
- **public/js/propiedad.js** — El mapa en la vista de propiedad ahora:
  - Muestra un círculo de 100m de radio en lugar del punto exacto (L.circle con radius: 100)
  - Muestra nota de privacidad "Por privacidad mostramos la zona aproximada (±100 m)"
  - Agrega botones "Ver en Google Maps" y "Ver en Waze" debajo del mapa
- **public/css/propiedad.css** — Estilos `.mapa-nota`, `.mapa-acciones`, `.mapa-btn` ya presentes

### Archivos editados:
- `public/js/propiedad.js`
- `public/css/propiedad.css`

## 2. Dashboard mensajes - Quitar función exportar ✅

### Cambios realizados:
- **public/js/dashboard.js** — Eliminada la función `exportarMensajesExcel`
- **public/pages/dashboard.html** — Eliminado el botón "Exportar a Excel"
- **src/routes/message.routes.js** — Eliminada la ruta `/exportar/excel` y la importación de `exportarMensajesExcel`
- **src/controllers/message.controller.js** — Eliminada la función `exportarMensajesExcel` y su exportación

### Archivos editados:
- `public/js/dashboard.js`
- `public/pages/dashboard.html`
- `src/routes/message.routes.js`
- `src/controllers/message.controller.js`

## 3. Admin pagos - Más espacio ✅

### Cambios realizados:
- **public/css/admin.css** — Reglas `#sec-pagos` para mayor espaciado:
  - `#sec-pagos .mod-header` con `margin-bottom: 28px`
  - `#sec-pagos .mod-kpis` con `margin-bottom: 28px`
  - Tabla `.data-table` con celdas más amplias (`padding: 14px 16px`)
  - Badges de estatus con mejor padding
- **public/pages/admin.html** — Espaciado inline en la sección de pagos (KPIs de 4 columnas con `gap:18px`, `margin-bottom:28px`)

### Archivos editados:
- `public/css/admin.css`
- `public/pages/admin.html`

