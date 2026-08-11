# TODO - Panel Admin: KYC/KYB, Promociones y Salud

## Backend
- [ ] `src/controllers/admin.controller.js`: Agregar función `getVerificaciones` que devuelva usuarios con KYC o KYB en estado `en_revision`.
- [ ] `src/routes/admin.routes.js`: Agregar ruta `GET /admin/verificaciones`.

## Frontend
- [ ] `public/pages/admin.html`: Agregar 3 enlaces en el sidebar (Verificaciones, Promociones, Salud).
- [ ] `public/pages/admin.html`: Agregar sección `sec-verificaciones` (panel KYC/KYB).
- [ ] `public/pages/admin.html`: Agregar sección `sec-promociones` (vista previa).
- [ ] `public/pages/admin.html`: Agregar sección `sec-salud` (panel de salud).
- [ ] `public/js/admin.js`: Agregar función `cargarVerificaciones()`.
- [ ] `public/js/admin.js`: Agregar función `cargarSalud()`.
- [ ] `public/js/admin.js`: Agregar lógica de renderizado de promociones.

## Verificación
- [ ] Probar que las 3 secciones funcionan correctamente.
