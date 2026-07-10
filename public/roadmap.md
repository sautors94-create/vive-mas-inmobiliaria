🗺️ HOJA DE RUTA - Vive Más Inmobiliaria
Objetivo: Consolidar plataforma nacional (México) preparada para escalabilidad global. Regla: Cero alert()/ prompt(). Código puro, rápido y modular.

🚨 URGENCIAS / ERRORES ACTUALES
 BUG Dashboard (Resumen Ejecutivo): La sección "Mis Propiedades" con botón Grid/Lista no está jalando los datos del usuario. No aparecen las propiedades.
 BUG Catálogo: Al quitar todos los filtros, no muestra el catálogo completo (quedará pendiente hasta terminar lo del Admin).
👤 MÓDULO: DASHBOARD DE USUARIO (Vistas y UX)
Resumen Ejecutivo y Planes
 Difuminar Resumen (Plan Gratuito): Aplicar filter: blur(5px)y pointer-events: nonea toda la sección del resumen ejecutivo si el usuario tiene plan gratuito.
 CTA de Mejora: Superponga una tarjeta/leyenda sobre el desenfoque que diga "Desbloquea el análisis completo de tus propiedades" con un botón CTA que lleve a la sección de planos o pasarela de pago.
 Vista Mis Propiedades (Debajo del Resumen): Implementar el Grid/List toggle (botones para cambiar la vista).
 Lógica de Datos: Conectar el Grid/List al endpoint que trae las propiedades del usuario logueado.
Funcionalidades adicionales de usuario
 Comparador de propiedades: Modal o sección para comparar máximo 3 propiedades lado a lado.
 Flujo Editar/Pausar: Al editar, enviar una revisión (Panel diferenciado en Admin).
 Verificación KYC: Subida de documento, validación facial y asignación de insignia en perfil.
💬 MÓDULO: SISTEMA DE MENSAJERÍA (Usuarios)
Nota: Arquitectura definida (Sin WebSockets, purga de 6 meses en SQL).

 Bandeja de entrada de leads: Bandeja de leads del chatbot, historial, estatus, filtro, eliminar y exportar a Excel.
 Mensajes Inbox (P2P): Bandeja de mensajes entre usuarios (Miniatura de propiedad, leído/no leído, respondedor).
 Restricción por Plan: Usuarios gratuitos solo pueden responder 1 vez como vendedores. Mostrar CTA para mejorar el plan si intentas responder más.
 Historial y Purga: Lógica en backend para no mostrar chats de más de 6 meses. Botón de exportar historial simplificado a Excel.
🛡️ MÓDULO: PANEL DE ADMINISTRACIÓN (Control y Moderación)
1. Revisión de Propiedades
 Vista Previa Completa: Al seleccionar una propiedad en revisión, abrirla en un modal/panel que replique exactamente la vista del catálogo (slider de fotos, mapa, detalles) para validar visualmente antes de aprobar.
 Filtros Avanzados de Revisión:
Filtro por Plan (Premium, Básico, Gratuito).
Filtro/Buscador por Usuario (Crucial para cuentas con alta carga de propiedades).
2. Propiedades Destacadas (Impulso con IA/Bot)
 Filtros de Gestión: Mismos filtros que en revisión (Por Plan, Por Usuario).
 Lógica de Promoción (Bot/IA): El algoritmo debe tomar las propiedades marcadas como "Destacadas" y alterar su peso en el backend.
Salir primero al aplicar cualquier filtro en el catálogo público.
Aparecer en la sección de "Más buscadas" o "Recomendadas" en el inicio.html.
3. Módulo de Bloqueos / Usuarios Vetados (NUEVO)
 Listado de Vetados: Vista de tabla con usuarios bloqueados.
 Historial y Motivos: Campo de texto/comentarios para registrador por qué fue vetado (spam, fraude, datos falsos).
 Vinculación de Cuentas (Alias): Capacidad de agregar Múltiples correos o IDs a un mismo perfil de vetado. Si el usuario crea una nueva cuenta con otro correo electrónico, el administrador puede ligarla a su historial de vetado anterior para evitar evasión de bloqueos.
4. Monitoreo de Mensajes (Moderación) (NUEVO)
 Bandeja de Monitoreo: El administrador debe poder leer los mensajes entre usuarios (solo con fines de moderación, indicando que es una vista de auditoría).
 Bot de Detección de Riesgo (IA/NLP): Integración con un modelo (o lógica de palabras clave) que analiza los mensajes y marca con una insignia los de "Alto Riesgo" (ej. intentos de estafa, sacar al usuario de la plataforma, acoso).
 Acción Automática/Semi-automática: Al detectar infracción grave:
Bloquear el chat inmediatamente.
Cambiar el estado de la cuenta del infractor a "En Revisión".
Notificar al administrador para que decida si reactiva o da de baja definitiva.
🗄️ TAREAS DE BACKEND / BASE DE DATOS (Soporte a lo anterior)
Crear modelo Conversacionesy Mensajes.
Crear modelo Vetadosy Vetados_Cuentas_Ligadas(para el módulo de bloqueos).
Crear tabla/log Auditoria_Mensajes(para guardar las alertas del Bot de riesgo).
Ajustar modelo Usuariospara añadir campos: estado_moderacion(normal, en_revision, vetado), limite_mensajes_mes.
Ajustar modelo Propiedadespara añadir peso de relevancia (para el algoritmo de Destacadas).
🌍 PREPARACIÓN GLOBAL (Futuro)
Migrar formatPrecioen api.jsa dinámico (recibir moneda y localidad, no codificar MXN).
Evaluar cambio de emojis en crearCardPropiedadpor iconos SVG para consistencia visual internacional.
Preparar estructura de URL para soportar subdirectorios ( /mx/, /co/, /es/).
💳 MÓDULO: PAGOS SaaS (Método: Stripe Payment Links - No-Code)
Configuración del Panel de Stripe
Crear Productos y Precios (Básico, Premium) en Stripe Dashboard.
Generar "Enlaces de Pago" para cada plan.
Restringir métodos de pago en los enlaces para aceptar SOLO Tarjeta .
Configurar URLs de redirección (éxito -> tablero, cancelación -> aviones).
Frontend (Código Propio)
Botones "Mejorar Plan" que redirijan a los Stripe Payment Links.
Guardar ID de usuario en localStorageantes de redirigir (para identificarlo al regresar).
Leer parámetro ?pago=exitoen el dashboard.htmlal regresar para mostrar un modal de "¡Felicidades, ya eres Premium!".
Backend (Único código requerido)
Crear punto final /api/webhooks/stripe(Escuchar eventos).
Validar firma del Webhook (Seguridad para asegurar que es Stripe quien llama).
Lógica: Al recibir checkout.session.completed, extrae el correo electrónico del usuario y actualiza su plan en la base de datos a 'premium' o 'basico'.