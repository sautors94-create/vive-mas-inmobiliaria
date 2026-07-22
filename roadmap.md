🚀 SIGUIENTE FASE: Panel de Administración — Módulo Enterprise (piloto)

Por qué se empieza aquí y no en el panel de usuario: el panel admin ya tiene el mayor scaffolding construido (10 secciones activas, modal de vista previa, filtros base), es donde vive el valor operativo más alto (moderación, revisión, analítica de negocio), y el flujo pendiente de "pausar → revisión" requiere cambios del lado admin de cualquier forma. Conviene resolver ese acoplamiento aquí primero.

Alcance del piloto: en vez de aplicar el rediseño tipo Stripe/HubSpot a los 8 módulos del dashboard a la vez, se construye completo en un solo módulo admin para validar el patrón antes de replicarlo.

Candidato a piloto: Revisión / Propiedades (dentro de sec-revision o sec-propiedades)

Ya existen: modelo Property, endpoint de listado, modal de vista previa, filtro por plan pendiente de ampliar.

Entregables del piloto:


Header del módulo: título, breadcrumb, última actualización, botones Exportar / Actualizar
KPIs superiores: total, en revisión hoy, aprobadas esta semana, rechazadas esta semana, variación %
Filtros: fecha, estado, plan, ciudad, usuario/propietario, búsqueda de texto libre — en tiempo real
Tabla profesional: orden por columna, selección múltiple, acciones por fila (ver, aprobar, rechazar, editar), exportación a Excel (se reutiliza el patrón ya usado en mensajería)
Panel lateral (drawer): al seleccionar una propiedad, ver todo su detalle sin salir de la vista — fotos, mapa, dueño, historial de estado — reemplazando el modal actual por algo más completo
Gráfico simple: tendencia de publicaciones/aprobaciones de los últimos 30 días (una sola gráfica de línea o barras, no todo el catálogo de gráficos del documento original)


Fuera de alcance en el piloto (se evalúan después de validar el patrón): reportes programados por correo, auditoría completa, vistas guardadas compartibles, scroll virtual — quedan para la Fase 3 si el piloto demuestra que vale la pena replicarlo a los otros 7 módulos.

Después del piloto


Si funciona: replicar el mismo patrón de componentes (KPIs + filtros + tabla + drawer) a Leads, Usuarios, Pagos
Retomar entonces "Fase 0" (comparador, pausar-a-revisión, KYC frontend, bug de catálogo) — varios de esos pendientes se resuelven más fácil una vez que exista el drawer/tabla reutilizable



🌍 PREPARACIÓN GLOBAL (futuro, sin fecha aún)


Migrar formatPrecio en api.js a dinámico (moneda y localidad, no fijo a MXN)
Cambiar emojis en crearCardPropiedad por iconos SVG para consistencia visual internacional
Preparar estructura de URL para subdirectorios (/mx/, /co/, /es/)