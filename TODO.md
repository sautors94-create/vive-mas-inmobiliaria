# TODO — Marketing Automation Engine

## Backend — Módulo `services/marketingAutomation/`
- [x] `config/meta.config.js` — Credenciales y endpoints de Meta
- [x] `content/contentGenerator.js` — Generador de texto + hashtags
- [x] `utils/imageValidator.js` — Validación de imágenes antes de publicar
- [x] `utils/tokenRefresher.js` — Cron de renovación de tokens
- [x] `publishers/base.publisher.js` — Clase base abstracta
- [x] `publishers/facebook.publisher.js` — Publicación Facebook (photos)
- [x] `publishers/instagram.publisher.js` — Publicación Instagram (container + publish)
- [x] `auth/metaOAuth.service.js` — Lógica OAuth (config_id)
- [x] `auth/metaOAuth.controller.js` — Connect/callback/disconnect/status
- [x] `auth/metaOAuth.routes.js` — Rutas Express de OAuth
- [x] `events/propertyPublished.handler.js` — Escucha evento de propiedad publicada
- [x] `index.js` — Punto de entrada del módulo

## Backend — Modelos
- [x] `src/models/SocialConfig.js` — Configuración de conexión Meta
- [x] `src/models/SocialActivityLog.js` — Registro de actividad
- [x] Modificar `src/models/Property.js` — Agregar objeto `socialMedia`

## Backend — Integración
- [x] Modificar `src/controllers/admin.controller.js` — Emitir evento al aprobar
- [x] Modificar `src/app.js` — Inicializar módulo al arrancar
- [x] (Opcional) Endpoint de reintento en `property.routes.js`

## Frontend — Panel del usuario
- [x] Modificar `public/js/dashboard.js` — Pestaña "Redes Sociales" en drawer
- [x] Modificar `public/css/mis-propiedades-workspace.css` — Estilos

## Verificación
- [ ] Levantar servidor y validar inicialización sin errores
- [ ] Probar flujo de aprobación → evento → publicación/logs
