# TODO — Implementación

## Tarea 1: Créditos/financiamientos en propiedades y filtros
- [x] 1. Agregar campo `creditosAceptados` al schema de `src/models/Property.js`
- [x] 2. Persistir `creditosAceptados` en `crearPropiedad` y `editarPropiedad` en `src/controllers/property.controller.js`
- [x] 3. Agregar filtro por `creditosAceptados` en `listarPropiedades` (`src/controllers/property.controller.js`)
- [x] 4. Agregar filtro de créditos en `public/pages/catalogo.html` (sticky bar + panel avanzado)
- [x] 5. Agregar lógica de filtro de créditos en `public/js/catalogo.js`
- [x] 6. Mostrar créditos aceptados en la vista de detalle (`public/js/propiedad.js`)

## Tarea 2: Cupones en pagos y panel admin
- [x] 7. Verificar middleware de `/cupones/validar` y `/cupones/canjear` — ya usan `auth.middleware` (cualquier usuario autenticado), no requiere cambio
- [x] 8. Agregar campo de cupón + función `canjearCupon()` en el modal de planes de `public/js/dashboard.js`

## Followup (pasos manuales)
- [ ] Probar flujo de publicación con créditos (venta) y vista en detalle
- [ ] Probar filtro por crédito en catálogo
- [ ] Crear cupón `SOMOSASESORES` tipo `basico_plus` 360 días desde admin (panel → Cupones → Nuevo)
- [ ] Probar canje de cupón `basico_plus` (sin pago) y redirección a Stripe para tipo `stripe`
- [ ] Reiniciar servidor y verificar
