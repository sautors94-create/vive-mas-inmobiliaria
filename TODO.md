# TODO — Reorganización de Documentación Legal (Opción B)

## Paso 1: Crear subcarpetas en `public/legal/`
- [x] Crear `normas-generales/`, `seguridad/`, `comercial/`, `plataforma/`, `b2b/`, `archivados/`, `css/`

## Paso 2: Mover (con renombrado) los documentos a sus subcarpetas
- [x] `pages/terminos.html` → `legal/normas-generales/terminos.html`
- [x] `privacidad.html` → `normas-generales/privacidad.html`
- [x] `cookies.html` → `normas-generales/cookies.html`
- [x] `aviso-legal-empresa.html` → `normas-generales/aviso-legal-empresa.html`
- [x] `politica-propiedad-intelectual.html` → `normas-generales/propiedad-intelectual.html`
- [x] `politica-seguridad-cuentas.html` → `seguridad/seguridad-cuentas.html`
- [x] `politica-antifraude.html` → `seguridad/politica-antifraude.html`
- [x] `politica-comunidad.html` → `seguridad/politica-comunidad.html`
- [x] `politica-de-verificacion-de-usuarios-y-propiedades.html` → `seguridad/politica-de-verificacion-de-usuarios-y-propiedades.html`
- [x] `politica-de-pagos-y-procesadores.html` → `comercial/politica-de-pagos-y-procesadores.html`
- [x] `politica-devoluciones-cancelaciones.html` → `comercial/politica-devoluciones-cancelaciones.html`
- [x] `politica-de-publicidad-y-contenido-promocional.html` → `comercial/politica-de-publicidad-y-contenido-promocional.html`
- [x] `politica-publicacion-inmuebles.html` → `comercial/publicacion-inmuebles.html`
- [x] `politica-ia.html` → `plataforma/politica-ia.html`
- [x] `politica-de-continuidad-y-respaldo.html` → `plataforma/politica-de-continuidad-y-respaldo.html`
- [x] `politica-de-documentos-y-firmas-digitales.html` → `plataforma/politica-de-documentos-y-firmas-digitales.html`
- [x] `politica-de-mensajeria-y-comunicaciones.html` → `plataforma/mensajeria.html`
- [x] `politica-de-privacidad-b2b.html` → `b2b/politica-de-privacidad-b2b.html`
- [x] `acuerdo-asesores-inmobiliarios.html` → `acuerdos/acuerdo-asesores-inmobiliarios.html`
- [x] `acuerdo-empresas-desarrolladores.html` → `acuerdos/acuerdo-empresas-desarrolladores.html`
- [x] `acuerdo-niveles-servicio-sla.html` → `acuerdos/acuerdo-niveles-servicio-sla.html`
- [x] `politica-pagos.html` (duplicado) → `archivados/politica-pagos.html`
- [x] `seguridad.html` (duplicado) → `archivados/seguridad.html`
- [x] `global.css` → `css/global.css`
- [x] `legal.css` → `css/legal.css`

## Paso 3: Actualizar referencias de rutas (sin cambiar lógica)
- [x] `public/index.html`: `pages/terminos.html` → `legal/normas-generales/terminos.html`
- [x] `public/pages/servicios.html`: footer `terminos.html` → `../legal/normas-generales/terminos.html`
- [x] `public/pages/registro.html`: footer `terminos.html` → `../legal/normas-generales/terminos.html`
- [x] `public/pages/registro.html`: `../legal/privacidad.html` → `../legal/normas-generales/privacidad.html`
- [x] `public/pages/propiedad.html`: footer `terminos.html` → `../legal/normas-generales/terminos.html`
- [x] `public/pages/nosotros.html`: footer `terminos.html` → `../legal/normas-generales/terminos.html`
- [x] `public/pages/comparador.html`: footer `terminos.html` → `../legal/normas-generales/terminos.html`
- [x] `public/pages/catalogo.html`: footer `terminos.html` → `../legal/normas-generales/terminos.html`
- [x] `public/js/api.js`: rutas cookies/privacidad → subcarpeta `normas-generales/`
- [x] `src/utils/adminMessages.js`: `POLITICAS_URL` → `/legal/normas-generales/terminos.html`

## Paso 4: Actualizar Centro Legal (`public/legal/index.html`)
- [x] Corregir todos los enlaces a las nuevas subcarpetas
- [x] Agregar secciones/categorías nuevas (acuerdos b2b, devoluciones, publicidad, comunidad, etc.)

## Paso 5: Actualizar `INDEX_DOCUMENTOS.md`
- [x] Reflejar la nueva estructura de carpetas
- [x] Corregir rutas de CSS
- [x] Documentar los archivos duplicados archivados
- [x] Listar documentos faltantes detectados

## Paso 6: Verificación final
- [x] Confirmar que no quedan enlaces rotos en el Centro Legal
- [x] Confirmar que todos los archivos quedaron en su lugar

