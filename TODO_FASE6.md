# TODO FASE 6 (Stepper 7 pasos)

## Objetivo
Implementar stepper y flujo de publicación paso-a-paso en `public/pages/dashboard.html` para completar:
- 6.1 Crear componente stepper (7 pasos)
- 6.2 Implementar navegación entre pasos
- 6.3 Progress indicator visual
- 6.4 Validación por paso

## Plan (checklist)
- [ ] 6.1 Stepper UI: agregar markup y contenedores `step-content` en `dashboard.html`.
- [ ] 6.1 Stepper state: crear funciones `setStep(n)` y helpers para mostrar/ocultar pasos en `public/js/dashboard.js`.
- [ ] 6.2 Navegación: botones `Atrás`/`Siguiente` + `Continuar` (final enviar en step 7).
- [ ] 6.3 Progress indicator: barra o puntos activos según paso actual.
- [ ] 6.4 Validación por paso:
  - Paso 1: título/precio/operación/tipo
  - Paso 2: descripción
  - Paso 3: estado/ciudad/(opcional colonia)/dirección
  - Paso 4: lat/lng
  - Paso 5: recámaras/baños/medios baños/estacionamientos/m2 (si aplica)
  - Paso 6: fotos (mínimo 2) o si no hay fotos mostrar error
  - Paso 7: resumen final y envío (llama a `publicarPropiedad`)
- [ ] Mantener compatibilidad: conservar `previsualizarFotos`, `iniciarMapaPublicar`, `publicarPropiedad`.
- [ ] Actualizar `TODO_PROCESO.md` para marcar 6.1..6.4 como [x] al finalizar.

