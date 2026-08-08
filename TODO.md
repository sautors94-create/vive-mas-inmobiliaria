# TODO — ViveMás Infrastructure & System Health Center + Página /promocion

## BACKEND — Modelos
- [x] src/models/HealthMetric.js
- [x] src/models/AlertLog.js
- [x] src/models/AuditLog.js
- [x] src/models/SystemConfig.js

## BACKEND — Servicios de monitoreo
- [x] src/services/health/monitors/mongoMonitor.js
- [x] src/services/health/monitors/cloudinaryMonitor.js
- [x] src/services/health/monitors/nodeMonitor.js
- [x] src/services/health/monitors/websiteMonitor.js
- [x] src/services/health/monitors/hostingerMonitor.js
- [x] src/services/health/monitors/backupMonitor.js
- [x] src/services/health/alertManager.js
- [x] src/services/health/collector.js
- [x] src/services/health/healthScheduler.js

## BACKEND — Controlador y rutas
- [x] src/controllers/health.controller.js
- [x] src/routes/health.routes.js

## BACKEND — Integración
- [x] src/app.js (montar ruta /api/admin/health + scheduler)
- [x] .env.example (nuevas variables vacías)

## FRONTEND — Panel Salud
- [x] public/css/health.css
- [x] public/js/health-admin.js
- [x] public/pages/health.html
- [x] public/pages/admin.html (link sidebar)

## FRONTEND — Página promoción QR
- [x] public/promocion.html

## Verificación
- [ ] Probar rutas protegidas /api/admin/health
- [ ] Verificar que no se exponen secretos

