# TODO — Gestión avanzada de cupones (vigencia + activar/desactivar + eliminar)

## Tarea: Mejorar el módulo de cupones del panel admin

## Pasos
- [x] 1. Agregar campo `expiraEn` (fecha de vigencia) en `src/models/Cupon.js`
- [x] 2. Backend `src/routes/pagos.js`:
  - [x] a. Validar expiración en `POST /cupones/validar` (rechazar vencidos)
  - [x] b. Validar expiración en `POST /cupones/canjear` (rechazar vencidos)
  - [x] c. Aceptar `expiraEn` en `POST /admin/cupones` (crear)
  - [x] d. Aceptar `expiraEn` en `PATCH /admin/cupones/:id` (editar)
- [x] 3. Frontend `public/pages/admin.html`:
  - [x] a. Input de fecha "Vigencia (opcional)" en el formulario de cupón
  - [x] b. Columnas "Vence" y "Acciones" en la tabla de cupones (colspan 8)
- [x] 4. Frontend `public/js/admin.js`:
  - [x] a. `guardarCupon()` envía `expiraEn`
  - [x] b. `cargarCuponesAdmin()` muestra Vence, estado Expirado y acciones
  - [x] c. `toggleCuponActivo()` (activar/desactivar vía PATCH)
  - [x] d. `eliminarCupon()` (eliminar vía DELETE con confirmación)

## Pasos adicionales (solicitud: uso ilimitado + duplicar cupones)
- [x] 5. Frontend `public/js/admin.js`:
  - [x] a. `editarCupon(id)` — carga cupón existente en el formulario y guarda vía PATCH
  - [x] b. `duplicarCupon(id)` — precarga datos del cupón con código limpio para crear uno nuevo
  - [x] c. Botones "✏️ Editar" y "⧉ Duplicar" en la tabla de cupones
  - [x] d. Mostrar "∞" en la columna Usos cuando el cupón es ilimitado
  - [x] e. Título dinámico del formulario (Nuevo/Editar/Duplicar)
- [x] 6. Script `seed-cupones.js`:
  - [x] a. Upsert de SOMOSASESORES: tipo `basico_plus`, sin Stripe, activo, `usosMaximos: null` (ilimitado), `dias: 360`

## Followup (pasos manuales)
- [x] Ejecutar `node seed-cupones.js` — ✅ Ejecutado: SOMOSASESORES actualizado (uso ilimitado), BASICO_MENSUAL y BASICO_ANUAL creados (Stripe, inactivos por referencia)
- [ ] Reiniciar servidor
- [ ] Probar crear cupón con vigencia
- [ ] Probar canjear cupón expirado (debe rechazar)
- [ ] Probar activar/desactivar y eliminar cupón desde la tabla
- [ ] Probar editar un cupón (cambiar usos máximos → dejar vacío = ilimitado)
- [ ] Probar duplicar un cupón (mismos datos, código nuevo)

