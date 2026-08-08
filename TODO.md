# TODO — Funcionalidad de cancelación de plan y alertas de vencimiento

## Backend
- [x] 1. `src/models/User.js`: Agregar campo `ultimoAvisoCobroEnviado`
- [x] 2. `src/controllers/property.controller.js`: Agregar función `pausarPropiedadesExcedentes`
- [x] 3. `src/routes/pagos.js`: En `invoice.payment_failed` pausar propiedades excedentes y notificar
- [ ] 4. `src/controllers/auth.controller.js`: Agregar lógica de aviso de próximo cobro en `verificar-plan`
- [ ] 5. `src/routes/auth.routes.js`: Actualizar `verificar-plan` para devolver estado de aviso de cobro

## Frontend
- [x] 6. `public/js/dashboard.js`: Mejorar `cargarCuenta()` con alertas de próximo cobro (amarillo ≤10 días, rojo ≤5 días)
- [ ] 7. `public/css/dashboard.css`: Agregar estilos para alertas de vencimiento

## Verificación
- [ ] 8. Probar el flujo completo en la sección "Mi Cuenta"
