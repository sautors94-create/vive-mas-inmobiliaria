# TODO — Mejora de Agentes de Validación y Moderación

## Paso 1: Agentevalidacion.js
- [x] Agregar regex de emojis (excesivos en título → MEDIUM).
- [x] Agregar regex de lenguaje ofensivo (título/descripción → HIGH).
- [x] Agregar validación de estacionamientos (rango razonable).
- [x] Agregar validación de colonia/dirección con placeholders.
- [x] Precio según operación (renta vs venta) con umbrales distintos.
- [x] Aceptar opción `duplicado` para emitir issue de DUPLICATE.

## Paso 2: Agentemoderacion.js
- [x] Enriquecer `construirMensajeUsuario` con más datos (estacionamientos, colonia, direccion, cp, lat/lng, fecha publicación).
- [x] Añadir normalización defensiva del JSON devuelto (asegurar `issues` array, clamp `risk_score`).

## Paso 3: property.controller.js
- [x] Agregar detección de duplicados (mismo usuario, mismo título y/o misma foto).
- [x] Pasar `duplicado` a ambos agentes y agregar issue de DUPLICATE si aplica.

## Paso 4: Portabilidad de imports
- [x] Corregir mayúsculas en los imports de property.controller.js (agenteValidacion → Agentevalidacion, agenteModeracion → Agentemoderacion).

## Seguimiento
- [x] Pruebas de humo de las regex (node --check + node -e).
- [x] Verificar que los archivos pasan la verificación de sintaxis.
