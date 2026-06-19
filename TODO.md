# Vive Más Inmobiliaria — Requerimientos de Implementación

## Prioridad Alta (1, 6, 7, 9, 10, 11)

### 1. Filtros múltiples en Inicio y Catálogo
- [ ] Permitir selección múltiple en filtros de operación (venta + renta)
- [ ] Permitir selección múltiple en filtros de tipo (casa + departamento + terreno)
- [ ] Actualizar main.js y catalogo.js para handle arrays
- [ ] Actualizar API backend para soportar múltiples valores

### 6. Mostrar/Ocultar Contraseña ✓ (COMPLETADO)
- [x] Agregar botón "ojo" en login.html
- [x] Agregar botón "ojo" en registro.html
- [x] Función togglePassword en auth.js

### 7. Modernización de Diseño
- [ ] Nuevo diseño: Nueva Publicación (dashboard.html)
- [ ] Nuevo diseño: Panel Administrador (admin.html)
- [ ] Nuevo diseño: Panel Usuario (dashboard.html)
- [ ] Aplicar estilos consistentes con página principal

### 9. Mejoras en Nueva Publicación
- [ ] Validación visual de campos obligatorios (resaltar en rojo)
- [ ] Simplificar ubicación: País, Estado, Dirección completa
- [ ] Selección en mapa (ya implementado)
- [ ] Mejorar mensajes de error

### 10. Baños y Medios Baños ✓ (COMPLETADO)
- [x] Separar campo "Baños" en "Baños completos" y "Medios baños"
- [x] Actualizar dashboard.html
- [x] Actualizar dashboard.js
- [x] Actualizar Property.js
- [x] Actualizar visualización en propiedad.js
- [x] Actualizar visualización en api.js (catálogo)

### 11. Control de Sesión y Expiración
- [ ] Mostrar ventana de advertencia 60 segundos antes
- [ ] Agregar temporizador regresivo
- [ ] Opciones: Mantener/Renovar/Cerrar sesión
- [ ] Implementar en api.js o auth.js

---

## Prioridad Media (2, 3, 8)

### 2. Mejora de los Chatbots
- [ ] Agregar descripción clara a cada chatbot
- [ ] Detectar intención incorrecta
- [ ] Redireccionamiento automático

### 3. Creación Masiva de Usuarios
- [ ] Herramienta en Panel Administrador
- [ ] Carga de archivo .xlsx
- [ ] Validación de duplicados
- [ ] Reporte de errores

### 8. Plantilla Carga Masiva de Propiedades
- [ ] Descargar plantilla Excel para cuentas Premium
- [ ] Instrucciones de llenado
- [ ] Soporte para imágenes
- [ ] Relación automática imagen-propiedad

---

## Prioridad Baja / Fase 2 (4, 5)

### 4. Página "Nosotros"
- [ ] Actualización automática de ciudades
- [ ] Nueva sección: Testimonios
- [ ] Administrable desde panel admin

### 5. Implementación futura: OTP por celular
- [ ] Envío de código SMS
- [ ] Validación de número celular
- [ ] Recuperación de cuenta mediante OTP

---

## Referencias

- Usuario test: saul@gmail.com / 123456
- Admin test: admin@vivemas.com / admin123
