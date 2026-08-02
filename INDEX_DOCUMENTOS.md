# Vive Más Inmobiliaria
# Índice de Documentación Legal y Operativa

Versión: 3.0
Fecha: Actualización de estructura de carpetas

---

# 📚 Centro Documental

Este archivo contiene el inventario general de documentos legales, políticas y lineamientos creados para la plataforma Vive Más Inmobiliaria.

La documentación está diseñada para cubrir operación SaaS inmobiliaria, usuarios finales, empresas, pagos, seguridad, inteligencia artificial y cumplimiento digital.

> **Nota de versión 3.0:** La documentación legal fue reorganizada en subcarpetas temáticas dentro de `public/legal/`. Los archivos duplicados `seguridad.html` y `politica-pagos.html` fueron movidos a `archivados/` como respaldo histórico. El CSS se centralizó en `public/css/`.


---

## 📁 Estructura de Carpetas

```
vive-mas-inmobiliaria/
│
├── INDEX_DOCUMENTOS.md
│
├── public/
│   ├── css/
│   │   ├── global.css          # Sistema de estilos global
│   │   └── legal.css           # Estilos del centro legal
│   │
│   ├── legal/                  # Centro Legal
│   │   ├── index.html          # Página principal del centro legal
│   │   │
│   │   ├── normas-generales/   # Documentos base
│   │   │   ├── terminos.html
│   │   │   ├── privacidad.html
│   │   │   ├── cookies.html
│   │   │   ├── aviso-legal-empresa.html
│   │   │   └── propiedad-intelectual.html
│   │   │
│   │   ├── seguridad/          # Seguridad y confianza
│   │   │   ├── seguridad-cuentas.html
│   │   │   ├── politica-antifraude.html
│   │   │   ├── politica-comunidad.html
│   │   │   └── politica-de-verificacion-de-usuarios-y-propiedades.html
│   │   │
│   │   ├── comercial/          # Pagos y comercio
│   │   │   ├── politica-de-pagos-y-procesadores.html
│   │   │   ├── politica-devoluciones-cancelaciones.html
│   │   │   ├── politica-de-publicidad-y-contenido-promocional.html
│   │   │   └── publicacion-inmuebles.html
│   │   │
│   │   ├── plataforma/         # Operación y plataforma
│   │   │   ├── politica-ia.html
│   │   │   ├── politica-de-continuidad-y-respaldo.html
│   │   │   ├── politica-de-documentos-y-firmas-digitales.html
│   │   │   └── mensajeria.html
│   │   │
│   │   ├── b2b/                # Empresas y profesionales
│   │   │   └── politica-de-privacidad-b2b.html
│   │   │
│   │   ├── acuerdos/           # Acuerdos profesionales
│   │   │   ├── acuerdo-asesores-inmobiliarios.html
│   │   │   ├── acuerdo-empresas-desarrolladores.html
│   │   │   └── acuerdo-niveles-servicio-sla.html
│   │   │
│   │   └── archivados/         # Duplicados / respaldo histórico
│   │       ├── seguridad.html          # Duplicado → seguridad/seguridad-cuentas.html
│   │       └── politica-pagos.html     # Duplicado → comercial/politica-de-pagos-y-procesadores.html
│   │
│   └── pages/                  # Páginas de la aplicación
│
└── src/                        # Código de la aplicación
```


---

# 1. Términos y Condiciones

**Archivo:**

`public/legal/normas-generales/terminos.html`

## Contenido:

- Reglas generales de uso de la plataforma.
- Registro de usuarios.
- Creación de cuentas.
- Responsabilidades del usuario.
- Uso permitido y prohibido.
- Publicación de propiedades.
- Comunicación entre usuarios.
- Limitaciones de responsabilidad.
- Suspensión de cuentas.
- Aceptación de condiciones.


---

# 2. Política de Privacidad

**Archivo:**

`public/legal/normas-generales/privacidad.html`

## Contenido:

- Datos personales recopilados.
- Finalidades del tratamiento.
- Uso de información.
- Protección de datos.
- Derechos de usuarios.
- Cookies relacionadas.
- Seguridad de información.
- Conservación de datos.
- Solicitudes de usuarios.


---

# 3. Política de Cookies

**Archivo:**

`public/legal/normas-generales/cookies.html`

## Contenido:

- Uso de cookies.
- Tecnologías similares.
- Cookies necesarias.
- Cookies analíticas.
- Cookies funcionales.
- Gestión y eliminación.
- Proveedores externos.


---

# 4. Política de Inteligencia Artificial

**Archivo:**

`public/legal/plataforma/politica-ia.html`

## Contenido:

- Uso responsable de IA.
- Automatizaciones.
- Asistentes digitales.
- Generación de contenido.
- Revisión humana.
- Limitaciones de resultados.
- Privacidad en sistemas inteligentes.
- Uso ético de IA.


---

# 5. Política de Propiedad Intelectual

**Archivo:**

`public/legal/normas-generales/propiedad-intelectual.html`

## Contenido:

- Derechos sobre software.
- Código fuente.
- Diseño de plataforma.
- Marca Vive Más.
- Contenido propio.
- Uso permitido.
- Protección tecnológica.


---

# 6. Política de Seguridad de Cuentas

**Archivo:**

`public/legal/seguridad/seguridad-cuentas.html`

## Contenido:

- Protección de usuarios.
- Contraseñas.
- Accesos.
- Sesiones.
- Prevención de fraude.
- Actividad sospechosa.
- Seguridad tecnológica.


---

# 6b. Política de Seguridad Tecnológica (archivada)

**Archivo:**

`public/legal/archivados/seguridad.html`

> ⚠️ Documento duplicado. La versión vigente es `public/legal/seguridad/seguridad-cuentas.html`. Se conserva en `archivados/` como respaldo histórico.

## Contenido:

- Alcance de la política de seguridad.
- Protección de cuentas de usuario.
- Buenas prácticas para usuarios.
- Protección de infraestructura tecnológica.
- Protección de información y bases de datos.
- Seguridad de archivos y contenido multimedia.
- Seguridad de proveedores externos.
- Control de acceso interno.
- Respaldos y continuidad operativa.
- Prevención de fraude y abuso.
- Monitoreo y detección de actividades inusuales.
- Mantenimiento de seguridad.
- Reporte responsable de vulnerabilidades.
- Respuesta ante incidentes de seguridad.
- Responsabilidad del usuario en seguridad.
- Limitaciones de seguridad.


---

# 7. Política de Pagos y Procesadores

**Archivo:**

`public/legal/comercial/politica-de-pagos-y-procesadores.html`

## Contenido:

- Suscripciones.
- Planes de pago.
- Cobros recurrentes.
- Métodos de pago.
- Procesadores externos.
- Facturación.
- Impuestos.
- Pagos rechazados.
- Disputas financieras.
- Prevención de fraude.


---

# 7b. Política de Pagos y Servicios Digitales (archivada)

**Archivo:**

`public/legal/archivados/politica-pagos.html`

> ⚠️ Documento duplicado. La versión vigente es `public/legal/comercial/politica-de-pagos-y-procesadores.html`. Se conserva en `archivados/` como respaldo histórico.

## Contenido:

- Servicios gratuitos y de pago.
- Planes y suscripciones.
- Precios y cambios de tarifas.
- Métodos de pago.
- Proveedores externos de pago.
- Pagos recurrentes y renovaciones automáticas.
- Confirmación de pagos.
- Facturación e impuestos.
- Promociones y descuentos.
- Pagos rechazados o problemas de cobro.
- Prevención de fraude financiero.
- Cancelación de servicios.
- Reembolsos.
- Disputas de pago y contracargos.
- Suspensión por falta de pago.
- Servicios digitales y disponibilidad.
- Uso responsable de servicios de pago.


---

# 7c. Política de Devoluciones y Cancelaciones

**Archivo:**

`public/legal/comercial/politica-devoluciones-cancelaciones.html`

## Contenido:

- Condiciones de devolución.
- Cancelación de servicios.
- Reembolsos.
- Derechos del consumidor.
- Procedimientos de solicitud.


---

# 7d. Política de Publicidad y Contenido Promocional

**Archivo:**

`public/legal/comercial/politica-de-publicidad-y-contenido-promocional.html`

## Contenido:

- Publicidad destacada.
- Contenido promocional.
- Prácticas comerciales.
- Veracidad publicitaria.
- Restricciones de promoción.


---

# 8. Política de Documentos y Firmas Digitales

**Archivo:**

`public/legal/plataforma/politica-de-documentos-y-firmas-digitales.html`

## Contenido:

- Carga de documentos.
- Gestión de archivos.
- Documentos inmobiliarios.
- Almacenamiento.
- Firmas electrónicas.
- Responsabilidad documental.
- Archivos falsificados.
- Seguridad documental.


---

# 9. Política de Privacidad B2B

**Archivo:**

`public/legal/b2b/politica-de-privacidad-b2b.html`

## Contenido:

- Clientes empresariales.
- Constructoras.
- Agencias.
- Desarrolladores.
- Usuarios internos.
- Equipos comerciales.
- Administradores.
- Datos empresariales.
- Confidencialidad.


---

# 10. Política de Continuidad y Respaldo

**Archivo:**

`public/legal/plataforma/politica-de-continuidad-y-respaldo.html`

## Contenido:

- Disponibilidad del servicio.
- Infraestructura tecnológica.
- Backups.
- Recuperación ante fallos.
- Mantenimiento.
- Proveedores cloud.
- Incidentes tecnológicos.
- Continuidad operativa.


---

# 11. Aviso Legal Empresa

**Archivo:**

`public/legal/normas-generales/aviso-legal-empresa.html`

## Contenido:

- Identidad del titular.
- Razón social.
- Información legal.
- Propiedad intelectual.
- Uso del sitio.
- Jurisdicción.
- Legislación aplicable.
- Contacto legal.


---

# 12. Política de Comunidad y Conducta

**Archivo:**

`public/legal/seguridad/politica-comunidad.html`

## Contenido:

- Normas de convivencia.
- Conducta de usuarios.
- Publicaciones permitidas.
- Contenido prohibido.
- Reportes.
- Moderación.
- Uso responsable.


---

# 13. Política de Publicación de Inmuebles

**Archivo:**

`public/legal/comercial/publicacion-inmuebles.html`

## Contenido:

- Reglas para anuncios.
- Información obligatoria.
- Fotografías.
- Datos de propiedades.
- Responsabilidad del anunciante.
- Calidad de publicaciones.
- Eliminación de anuncios.


---

# 14. Política Antifraude y Verificación

**Archivo:**

`public/legal/seguridad/politica-antifraude.html`

## Contenido:

- Verificación de usuarios.
- Validación de propiedades.
- Detección de fraude.
- Actividades sospechosas.
- Restricciones.
- Seguridad comercial.


---

# 14b. Política de Verificación de Usuarios y Propiedades

**Archivo:**

`public/legal/seguridad/politica-de-verificacion-de-usuarios-y-propiedades.html`

## Contenido:

- Verificación de identidad.
- Validación documental.
- Procesos de aprobación.
- Revisión de propiedades.
- Seguridad en la verificación.


---

# 15. Política de Mensajería y Comunicaciones

**Archivo:**

`public/legal/plataforma/mensajeria.html`

## Contenido:

- Chats internos.
- Contacto entre usuarios.
- Uso responsable de mensajes.
- Protección contra abuso.
- Comunicaciones comerciales.
- Privacidad.


---

# 16. Centro Legal Web

**Archivo:**

`public/legal/index.html`

## Contenido:

Página principal de acceso a todas las políticas:

- Términos.
- Privacidad.
- Cookies.
- IA.
- Pagos.
- Documentos.
- B2B.
- Seguridad.
- Aviso legal.
- Acuerdos profesionales.


---

# 17. Acuerdos Profesionales

## 17.1 Acuerdo de Asesores Inmobiliarios

**Archivo:**

`public/legal/acuerdos/acuerdo-asesores-inmobiliarios.html`

### Contenido:

- Condiciones para asesores.
- Agentes y brokers.
- Uso de la plataforma.
- Responsabilidades profesionales.
- Comisiones y honorarios.

## 17.2 Acuerdo de Empresas y Desarrolladores

**Archivo:**

`public/legal/acuerdos/acuerdo-empresas-desarrolladores.html`

### Contenido:

- Constructoras.
- Desarrolladores.
- Inmobiliarias corporativas.
- Publicaciones masivas.
- Condiciones B2B.

## 17.3 Acuerdo de Niveles de Servicio (SLA)

**Archivo:**

`public/legal/acuerdos/acuerdo-niveles-servicio-sla.html`

### Contenido:

- Niveles de servicio.
- Disponibilidad.
- Soporte técnico.
- Tiempos de respuesta.
- Compensaciones.
- Mantenimiento.


---

# 18. Sistema de Estilos

## Archivo:

`public/css/global.css`

## Contenido:

- Diseño general.
- Colores corporativos.
- Botones.
- Tarjetas.
- Formularios.
- Alertas.
- Responsive.
- Componentes visuales.


---

# 19. Estilo Legal

## Archivo:

`public/css/legal.css`

## Contenido:

- Estilos específicos del centro legal.
- Componentes de documentos legales.
- Secciones de políticas.


---

# Estado del Proyecto

✅ Documentación legal base creada
✅ Centro legal preparado con los 23 documentos
✅ Documentos reorganizados en subcarpetas temáticas (`normas-generales/`, `seguridad/`, `comercial/`, `plataforma/`, `b2b/`, `acuerdos/`)
✅ Duplicados archivados en `archivados/` (seguridad.html, politica-pagos.html)
✅ Sistema CSS global centralizado en `public/css/`
✅ Todas las referencias de páginas, API y mensajería actualizadas a rutas nuevas
✅ Políticas SaaS estructuradas
✅ Documentación empresarial B2B preparada
✅ Acuerdos profesionales organizados en `public/legal/acuerdos/`
✅ Base para plataforma inmobiliaria digital


---

# Próximos documentos recomendados

- Política de API y desarrolladores.
- Política de proveedores externos.
- Política de soporte técnico.
- Contrato de prestación de servicios SaaS.
- Política de protección de datos ampliada.

