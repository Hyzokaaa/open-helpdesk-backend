export interface ChangelogFeature {
  en: string;
  es: string;
}

export interface ChangelogCategory {
  title: { en: string; es: string };
  features: ChangelogFeature[];
}

export interface ChangelogVersion {
  version: string;
  date: string;
  categories: ChangelogCategory[];
}

export const coreChangelog: ChangelogVersion[] = [
  {
    version: '1.11.0',
    date: '2026-06-04',
    categories: [
      {
        title: { en: 'Search & Real-Time', es: 'Búsqueda y Tiempo Real' },
        features: [
          { en: 'Search tickets by name, description, or ticket number — results update as you type', es: 'Busca tickets por nombre, descripción o número de ticket — los resultados se actualizan mientras escribes' },
          { en: 'Real-time updates — new tickets, status changes, and comments appear instantly without refreshing', es: 'Actualizaciones en tiempo real — nuevos tickets, cambios de estado y comentarios aparecen al instante sin recargar' },
          { en: 'Ticket ID column in the table and visible in ticket detail view', es: 'Columna de ID de ticket en la tabla y visible en la vista de detalle' },
        ],
      },
      {
        title: { en: 'Attachments', es: 'Adjuntos' },
        features: [
          { en: 'Files are uploaded before creating the ticket — if something fails, no orphan tickets are created', es: 'Los archivos se suben antes de crear el ticket — si algo falla, no se crean tickets huérfanos' },
          { en: 'Upload progress shown per file — retry failed uploads with one click', es: 'Progreso de subida por archivo — reintenta subidas fallidas con un click' },
        ],
      },
      {
        title: { en: 'Security & Reliability', es: 'Seguridad y Fiabilidad' },
        features: [
          { en: 'Deactivated users can no longer log in — accounts are blocked immediately', es: 'Los usuarios desactivados ya no pueden iniciar sesión — las cuentas se bloquean inmediatamente' },
          { en: 'Ticket numbers are now guaranteed unique even under heavy load', es: 'Los números de ticket ahora están garantizados como únicos incluso bajo carga alta' },
          { en: 'Clear error message when file storage is temporarily unavailable', es: 'Mensaje de error claro cuando el almacenamiento de archivos no está disponible temporalmente' },
          { en: 'Dates displayed in your browser\'s language instead of always English', es: 'Fechas mostradas en el idioma de tu navegador en vez de siempre en inglés' },
          { en: 'Dashboard and admin pages are now protected — unauthorized users are redirected to login', es: 'Las páginas de dashboard y administración ahora están protegidas — usuarios no autorizados son redirigidos al login' },
        ],
      },
    ],
  },
  {
    version: '1.10.0',
    date: '2026-05-31',
    categories: [
      {
        title: { en: 'Email Mailbox Management', es: 'Gestión de Buzones de Email' },
        features: [
          { en: 'Connect any IMAP mailbox to receive tickets — works with Gmail, Outlook, or any email provider', es: 'Conecta cualquier buzón IMAP para recibir tickets — funciona con Gmail, Outlook o cualquier proveedor de email' },
          { en: 'Multiple mailboxes per workspace — route different email addresses to the same workspace', es: 'Múltiples buzones por workspace — dirige diferentes direcciones de email al mismo workspace' },
          { en: 'Test connection before saving — verify IMAP credentials and browse available folders', es: 'Prueba la conexión antes de guardar — verifica credenciales IMAP y explora las carpetas disponibles' },
          { en: 'Live sync status — see when each mailbox last synced and catch errors instantly', es: 'Estado de sincronización en vivo — ve cuándo se sincronizó cada buzón por última vez y detecta errores al instante' },
        ],
      },
      {
        title: { en: 'Workspace Settings', es: 'Configuración del Workspace' },
        features: [
          { en: 'Redesigned workspace settings — color palette moved to sidebar, cleaner layout', es: 'Configuración del workspace rediseñada — paleta de colores movida al sidebar, diseño más limpio' },
        ],
      },
    ],
  },
  {
    version: '1.9.0',
    date: '2026-05-25',
    categories: [
      {
        title: { en: 'Email-to-Ticket', es: 'Email a Ticket' },
        features: [
          { en: 'Your customers can create tickets by sending an email — no login needed', es: 'Tus clientes pueden crear tickets enviando un email — sin necesidad de iniciar sesión' },
          { en: 'Email replies are added as comments to the original ticket automatically', es: 'Las respuestas por email se agregan como comentarios al ticket original automáticamente' },
          { en: 'All emails about a ticket are threaded in one conversation', es: 'Todos los emails sobre un ticket se agrupan en una conversación' },
          { en: 'Support email address visible in workspace settings — ready to share with your customers', es: 'Dirección de email de soporte visible en la configuración del workspace — lista para compartir con tus clientes' },
        ],
      },
    ],
  },
  {
    version: '1.8.0',
    date: '2026-05-18',
    categories: [
      {
        title: { en: 'Ticket Workflow', es: 'Flujo de Tickets' },
        features: [
          { en: 'New "Open" status — tickets start unassigned in a shared pool for agents to pick up', es: 'Nuevo estado "Abierto" — los tickets comienzan sin asignar en un pool compartido para que los agentes los tomen' },
          { en: 'Auto-assign on pickup — moving a ticket from Open assigns it to you automatically', es: 'Asignación automática al tomar — mover un ticket de Abierto te lo asigna automáticamente' },
          { en: 'Sequential ticket numbers — reference tickets as #1, #2, #3 instead of long IDs', es: 'Números de ticket secuenciales — referencia tickets como #1, #2, #3 en vez de IDs largos' },
        ],
      },
      {
        title: { en: 'Roles & Visibility', es: 'Roles y Visibilidad' },
        features: [
          { en: 'Supervisor role — can assign tickets, see all tickets, and access audit log', es: 'Rol Supervisor — puede asignar tickets, ver todos los tickets y acceder al registro de auditoría' },
          { en: 'Agents now see only their assigned tickets and the open pool', es: 'Los agentes ahora solo ven sus tickets asignados y el pool de abiertos' },
          { en: 'Compact board cards — priority shown by colored border, more tickets visible at once', es: 'Tarjetas compactas en el tablero — prioridad indicada por borde de color, más tickets visibles a la vez' },
        ],
      },
      {
        title: { en: 'Reports Redesign', es: 'Rediseño de Reportes' },
        features: [
          { en: 'Refreshed dashboard with donut charts, area charts, and a unified color palette', es: 'Dashboard renovado con gráficas de dona, gráficas de área y una paleta de colores unificada' },
          { en: 'Overview cards with colored indicators and larger metrics at a glance', es: 'Tarjetas de resumen con indicadores de color y métricas más grandes de un vistazo' },
          { en: 'Cleaner chart axes, rounded bars, and subtle gradients', es: 'Ejes de gráficas más limpios, barras redondeadas y gradientes sutiles' },
        ],
      },
    ],
  },
  {
    version: '1.7.0',
    date: '2026-05-16',
    categories: [
      {
        title: { en: 'Ticket Management', es: 'Gestión de Tickets' },
        features: [
          { en: 'Bulk actions — select multiple tickets and change status or delete in one click', es: 'Acciones masivas — selecciona varios tickets y cambia su estado o elimínalos en un click' },
          { en: 'Edit mode with save button — make changes and review before saving', es: 'Modo de edición con botón guardar — haz cambios y revísalos antes de guardar' },
          { en: 'Password visibility toggle on login, signup, and reset password', es: 'Botón para ver contraseña en login, registro y restablecimiento de contraseña' },
        ],
      },
      {
        title: { en: 'Ticket Board', es: 'Tablero de Tickets' },
        features: [
          { en: 'Kanban board view — see tickets organized by status in columns', es: 'Vista de tablero Kanban — ve los tickets organizados por estado en columnas' },
          { en: 'Drag and drop tickets between columns to change status instantly', es: 'Arrastra y suelta tickets entre columnas para cambiar el estado al instante' },
          { en: 'Custom ticket ordering per column — saved for each user', es: 'Orden personalizado de tickets por columna — guardado para cada usuario' },
          { en: 'Auto-refresh every 30 seconds — no need to reload the page', es: 'Actualización automática cada 30 segundos — sin necesidad de recargar la página' },
          { en: 'Priority-colored cards — identify urgent tickets at a glance', es: 'Tarjetas coloreadas por prioridad — identifica tickets urgentes de un vistazo' },
        ],
      },
    ],
  },
  {
    version: '1.6.0',
    date: '2026-05-09',
    categories: [
      {
        title: { en: 'Reports Dashboard', es: 'Panel de Reportes' },
        features: [
          { en: 'Reports page with key metrics — open tickets, resolved count, resolution time, first response time', es: 'Página de reportes con métricas clave — tickets abiertos, resueltos, tiempo de resolución, primera respuesta' },
          { en: 'Tickets over time chart — see creation and resolution trends', es: 'Gráfica de tickets en el tiempo — ve tendencias de creación y resolución' },
          { en: 'Breakdown by status, priority, and category with visual charts', es: 'Desglose por estado, prioridad y categoría con gráficas visuales' },
          { en: 'Top agents ranking — who resolved the most tickets', es: 'Ranking de mejores agentes — quién resolvió más tickets' },
          { en: 'Date range filter — view data for last 7, 30, or 90 days', es: 'Filtro por rango de fechas — ve datos de los últimos 7, 30 o 90 días' },
        ],
      },
      {
        title: { en: 'Ticket Lifecycle', es: 'Ciclo de Vida del Ticket' },
        features: [
          { en: 'New "Discarded" status replaces "Closed" — for spam, duplicates, and unanswered tickets', es: 'Nuevo estado "Descartado" reemplaza "Cerrado" — para spam, duplicados y tickets sin respuesta' },
          { en: 'Discard reason required when discarding — duplicate, spam, no response, or won\'t fix', es: 'Razón de descarte obligatoria al descartar — duplicado, spam, sin respuesta o no se corregirá' },
          { en: 'Three ticket tabs: Active, Resolved, and Discarded', es: 'Tres pestañas de tickets: Activos, Resueltos y Descartados' },
          { en: 'Resolved tickets track who resolved them — accurate agent performance metrics', es: 'Los tickets resueltos registran quién los resolvió — métricas de rendimiento precisas' },
          { en: 'Discarded tickets are excluded from resolution metrics and agent rankings', es: 'Los tickets descartados se excluyen de métricas de resolución y rankings de agentes' },
        ],
      },
      {
        title: { en: 'Customer Satisfaction', es: 'Satisfacción del Cliente' },
        features: [
          { en: 'Satisfaction survey sent automatically when a ticket is resolved', es: 'Encuesta de satisfacción enviada automáticamente al resolver un ticket' },
          { en: 'One-click rating from email — Good, Neutral, or Bad, no login required', es: 'Calificación con un click desde el email — Buena, Neutral o Mala, sin necesidad de iniciar sesión' },
          { en: 'CSAT score and breakdown displayed in the reports dashboard', es: 'Puntaje CSAT y desglose mostrados en el panel de reportes' },
          { en: 'Surveys are skipped when the resolver is also the ticket creator', es: 'Las encuestas se omiten cuando quien resuelve es también quien creó el ticket' },
        ],
      },
      {
        title: { en: 'Permissions', es: 'Permisos' },
        features: [
          { en: 'Reporters can no longer edit tickets after creation — updates happen through comments', es: 'Los reporteros ya no pueden editar tickets después de crearlos — las actualizaciones se hacen por comentarios' },
          { en: 'Canned responses reserved for agents and admins only', es: 'Respuestas predefinidas reservadas solo para agentes y administradores' },
        ],
      },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-05-04',
    categories: [
      {
        title: { en: 'Canned Responses', es: 'Respuestas Predefinidas' },
        features: [
          { en: 'Canned responses — create reusable reply templates for your workspace', es: 'Respuestas predefinidas — crea plantillas de respuesta reutilizables para tu workspace' },
          { en: 'Quick insert with "/" while writing comments — type, select, done', es: 'Inserción rápida con "/" al escribir comentarios — escribe, selecciona, listo' },
          { en: 'Manage responses from a dedicated page (admins and agents)', es: 'Gestiona respuestas desde una página dedicada (admins y agentes)' },
        ],
      },
      {
        title: { en: 'Custom Fields', es: 'Campos Personalizados' },
        features: [
          { en: 'Define custom fields per workspace — text, number, select, multi-select, date, checkbox', es: 'Define campos personalizados por workspace — texto, número, selección, selección múltiple, fecha, casilla' },
          { en: 'Custom fields appear in ticket creation and detail views', es: 'Los campos personalizados aparecen en la creación y detalle de tickets' },
          { en: 'Required fields are validated before saving', es: 'Los campos obligatorios se validan antes de guardar' },
          { en: 'Manage field definitions from a dedicated admin page', es: 'Gestiona las definiciones de campos desde una página dedicada de admin' },
        ],
      },
      {
        title: { en: 'Reporter Experience', es: 'Experiencia del Reportero' },
        features: [
          { en: 'Reporters now see only their own tickets — cleaner, focused view', es: 'Los reporteros ahora solo ven sus propios tickets — vista limpia y enfocada' },
          { en: 'Sidebar shows only relevant sections based on your role', es: 'La barra lateral muestra solo secciones relevantes según tu rol' },
          { en: 'Attachment deletion restricted to files you uploaded', es: 'Eliminación de adjuntos restringida a archivos que tú subiste' },
          { en: 'Reporters cannot edit priority, category, or tags — only description and custom fields', es: 'Los reporteros no pueden editar prioridad, categoría ni etiquetas — solo descripción y campos personalizados' },
        ],
      },
      {
        title: { en: 'UI Improvements', es: 'Mejoras de Interfaz' },
        features: [
          { en: 'All destructive actions now show a confirmation dialog instead of browser default', es: 'Todas las acciones destructivas ahora muestran un diálogo de confirmación en vez del predeterminado del navegador' },
          { en: 'Canned responses and custom fields pages use standard table layout with action menus', es: 'Las páginas de respuestas predefinidas y campos personalizados usan el diseño de tabla estándar con menús de acción' },
          { en: 'Create and edit forms open in a side panel for consistency', es: 'Los formularios de crear y editar abren en un panel lateral para consistencia' },
        ],
      },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-05-03',
    categories: [
      {
        title: { en: 'Audit Log', es: 'Registro de Auditoría' },
        features: [
          { en: 'Audit log page — see who did what and when across your workspace', es: 'Página de auditoría — ve quién hizo qué y cuándo en tu workspace' },
          { en: 'Filter by action, entity type, or user with paginated results', es: 'Filtra por acción, tipo de entidad o usuario con resultados paginados' },
          { en: 'Tracks tickets, comments, members, workspace settings, and user changes', es: 'Rastrea tickets, comentarios, miembros, configuración del workspace y cambios de usuario' },
          { en: 'Shows what changed before and after each action', es: 'Muestra qué cambió antes y después de cada acción' },
          { en: 'Visible only to workspace admins', es: 'Visible solo para administradores del workspace' },
        ],
      },
      {
        title: { en: 'Ticket Activity', es: 'Actividad del Ticket' },
        features: [
          { en: 'Activity timeline in ticket detail — see the full history of changes', es: 'Línea de tiempo en el detalle del ticket — ve el historial completo de cambios' },
          { en: 'Latest 5 entries shown by default, expand to see all', es: 'Últimas 5 entradas visibles por defecto, expande para ver todas' },
          { en: 'Updates automatically when the ticket is modified', es: 'Se actualiza automáticamente cuando el ticket es modificado' },
        ],
      },
      {
        title: { en: 'Invitations', es: 'Invitaciones' },
        features: [
          { en: 'Send multiple invitations at once in a single batch', es: 'Envía múltiples invitaciones a la vez en un solo lote' },
          { en: 'Prevents duplicate emails, already-invited users, and existing members before sending', es: 'Previene emails duplicados, usuarios ya invitados y miembros existentes antes de enviar' },
          { en: 'Agent seat validation — checks plan limits before inviting admins or agents', es: 'Validación de asientos de agente — verifica los límites del plan antes de invitar admins o agentes' },
        ],
      },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-04-30',
    categories: [
      {
        title: { en: 'Workspace Branding', es: 'Marca del Workspace' },
        features: [
          { en: 'Color palette per workspace — all members see the chosen theme', es: 'Paleta de colores por workspace — todos los miembros ven el tema elegido' },
          { en: '7 predefined palettes: green, blue, purple, orange, rose, teal, indigo', es: '7 paletas predefinidas: verde, azul, púrpura, naranja, rosa, turquesa, índigo' },
          { en: 'Custom color picker with HSV selector and live preview', es: 'Selector de color personalizado con selector HSV y vista previa en vivo' },
          { en: 'Light and dark mode preview in custom color modal', es: 'Vista previa en modo claro y oscuro en el modal de color personalizado' },
          { en: 'Palette persists across workspace sections (settings, admin, etc.)', es: 'La paleta persiste en todas las secciones del workspace (ajustes, admin, etc.)' },
          { en: 'Adaptive primary color — adjusts contrast automatically for light and dark mode', es: 'Color primario adaptativo — ajusta el contraste automáticamente para modo claro y oscuro' },
        ],
      },
      {
        title: { en: 'Workspace Settings', es: 'Configuración del Workspace' },
        features: [
          { en: 'Workspace settings page accessible to workspace admins (not just system admins)', es: 'Página de configuración del workspace accesible para admins del workspace (no solo admins del sistema)' },
        ],
      },
      {
        title: { en: 'Mobile Support', es: 'Soporte Móvil' },
        features: [
          { en: 'Mobile sidebar drawer with hamburger menu and backdrop overlay', es: 'Barra lateral móvil con menú hamburguesa y fondo oscuro' },
          { en: 'Horizontal scroll on all data tables for small screens', es: 'Scroll horizontal en todas las tablas de datos para pantallas pequeñas' },
          { en: 'Notification panel repositioned for mobile viewports', es: 'Panel de notificaciones reposicionado para pantallas móviles' },
          { en: 'Column drag disabled on mobile to prevent scroll conflicts', es: 'Arrastre de columnas desactivado en móvil para evitar conflictos con el scroll' },
        ],
      },
      {
        title: { en: 'UI Improvements', es: 'Mejoras de Interfaz' },
        features: [
          { en: 'Create user and create workspace forms now open in a side panel', es: 'Los formularios de crear usuario y workspace ahora abren en un panel lateral' },
          { en: 'Add multiple members at once from the members page', es: 'Agregar múltiples miembros a la vez desde la página de miembros' },
          { en: 'Smart app title: auto-splits name and subtitle in sidebar (e.g. "Open" + "Helpdesk")', es: 'Título inteligente: divide automáticamente nombre y subtítulo en la barra lateral (ej. "Open" + "Helpdesk")' },
          { en: 'Solid primary buttons replacing gradients for better consistency', es: 'Botones primarios sólidos reemplazando degradados para mejor consistencia' },
          { en: 'Auto-contrast text on primary backgrounds adapts to light custom palettes', es: 'Texto con contraste automático sobre fondos primarios se adapta a paletas custom claras' },
        ],
      },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-04-28',
    categories: [
      {
        title: { en: 'Admin Panel', es: 'Panel de Administración' },
        features: [
          { en: 'Separate Users and Workspaces management pages', es: 'Páginas separadas de gestión de Usuarios y Espacios' },
          { en: 'Action menu on table rows for quick operations', es: 'Menú de acciones en filas de tabla para operaciones rápidas' },
          { en: 'Sortable columns on users and workspaces tables', es: 'Columnas ordenables en tablas de usuarios y espacios' },
          { en: 'Drag-and-drop column reordering on all tables', es: 'Reordenamiento de columnas arrastrando en todas las tablas' },
        ],
      },
      {
        title: { en: 'Workspaces', es: 'Espacios de Trabajo' },
        features: [
          { en: 'Any user can now create workspaces', es: 'Cualquier usuario puede crear espacios de trabajo' },
          { en: 'Dashboard landing page with workspace cards and role badges', es: 'Página de inicio con tarjetas de espacios e insignias de rol' },
        ],
      },
      {
        title: { en: 'Invitations', es: 'Invitaciones' },
        features: [
          { en: 'Invite users to workspaces by email with role selection', es: 'Invitar usuarios a espacios por correo con selección de rol' },
          { en: 'Send multiple invitations at once', es: 'Enviar múltiples invitaciones a la vez' },
          { en: 'Invited users can accept or reject from the invitation link', es: 'Los usuarios invitados pueden aceptar o rechazar desde el enlace' },
          { en: 'New users are auto-joined to the workspace after signup', es: 'Los usuarios nuevos se unen automáticamente al espacio tras registrarse' },
          { en: 'Dedicated invitations page with pending invitations table', es: 'Página dedicada de invitaciones con tabla de invitaciones pendientes' },
          { en: 'Admins and agents can send invitations', es: 'Administradores y agentes pueden enviar invitaciones' },
        ],
      },
      {
        title: { en: 'Sidebar', es: 'Barra Lateral' },
        features: [
          { en: 'Workspace switcher with quick selection dropdown', es: 'Selector de workspace con desplegable de selección rápida' },
          { en: 'Collapsible navigation sections', es: 'Secciones de navegación colapsables' },
          { en: 'Workspace context persists across all sections', es: 'El contexto del workspace se mantiene en todas las secciones' },
        ],
      },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-04-21',
    categories: [
      {
        title: { en: 'Authentication & Account', es: 'Autenticación y Cuenta' },
        features: [
          { en: 'Email and password login with secure authentication', es: 'Inicio de sesión con email y contraseña con autenticación segura' },
          { en: 'Forgot password flow with email reset link (1-hour expiry)', es: 'Recuperación de contraseña con enlace por email (expira en 1 hora)' },
          { en: 'Change password from settings (requires current password)', es: 'Cambio de contraseña desde configuración (requiere contraseña actual)' },
          { en: 'Users created only by system admins (no public registration)', es: 'Usuarios creados solo por administradores del sistema (sin registro público)' },
        ],
      },
      {
        title: { en: 'User Management', es: 'Gestión de Usuarios' },
        features: [
          { en: 'Create users with name, email, and password (system admin only)', es: 'Crear usuarios con nombre, email y contraseña (solo admin del sistema)' },
          { en: 'Promote/demote users to system admin', es: 'Promover/degradar usuarios a administrador del sistema' },
          { en: 'List all users in admin panel', es: 'Listar todos los usuarios en panel de administración' },
          { en: 'Activate or deactivate user accounts', es: 'Activar o desactivar cuentas de usuario' },
          { en: 'Admin panel with user and workspace management tables', es: 'Panel de administración con tablas de gestión de usuarios y espacios' },
          { en: 'Confirmation modals for all admin actions (promote, demote, activate, deactivate)', es: 'Modales de confirmación para todas las acciones de administración (promover, degradar, activar, desactivar)' },
        ],
      },
      {
        title: { en: 'Workspaces', es: 'Espacios de Trabajo' },
        features: [
          { en: 'Create workspaces with name and description (system admin only)', es: 'Crear espacios de trabajo con nombre y descripción (solo admin del sistema)' },
          { en: 'Edit workspace in a side panel with two-column layout', es: 'Editar espacio en un panel lateral con diseño de dos columnas' },
          { en: 'Delete workspace with danger zone and irreversibility warning', es: 'Eliminar espacio con zona de peligro y advertencia de irreversibilidad' },
          { en: 'System admins see and access all workspaces', es: 'Los administradores del sistema ven y acceden a todos los espacios' },
          { en: 'Auto-assign creator as workspace admin', es: 'Asignación automática del creador como admin del espacio' },
          { en: 'Deleting a workspace removes all its tickets, members, and tags', es: 'Eliminar un espacio borra todos sus tickets, miembros y etiquetas' },
        ],
      },
      {
        title: { en: 'Members', es: 'Miembros' },
        features: [
          { en: 'Add members with role selection (admin, agent, reporter)', es: 'Agregar miembros con selección de rol (admin, agente, reportero)' },
          { en: 'Change member role with inline dropdown', es: 'Cambiar rol de miembro con selector en línea' },
          { en: 'Remove members from workspace', es: 'Eliminar miembros del espacio de trabajo' },
          { en: 'Last-admin protection: cannot remove or demote the sole admin', es: 'Protección de último admin: no se puede eliminar o degradar al único administrador' },
          { en: 'Role editing restricted: admins edit non-admins, system admins edit anyone', es: 'Edición de roles restringida: admins editan no-admins, system admins editan a cualquiera' },
        ],
      },
      {
        title: { en: 'Tickets', es: 'Tickets' },
        features: [
          { en: 'Create, edit, assign, change status, and delete tickets', es: 'Crear, editar, asignar, cambiar estado y eliminar tickets' },
          { en: 'Priorities: low, medium, high, critical', es: 'Prioridades: baja, media, alta, crítica' },
          { en: 'Categories: bug, issue, task', es: 'Categorías: error, incidencia, tarea' },
          { en: 'Statuses: pending, in-progress, resolved, closed', es: 'Estados: pendiente, en progreso, resuelto, cerrado' },
          { en: 'Filter by status, priority, tags, and assignee', es: 'Filtrar por estado, prioridad, etiquetas y asignado' },
          { en: 'Sort by name, category, priority, status, or date', es: 'Ordenar por nombre, categoría, prioridad, estado o fecha' },
          { en: 'Paginated list with active/closed tab split', es: 'Lista paginada con separación de pestañas activo/cerrado' },
          { en: 'Ticket detail and creation in a side panel', es: 'Detalle y creación de ticket en un panel lateral' },
          { en: 'Inline editing of title, description, priority, and category', es: 'Edición en línea de título, descripción, prioridad y categoría' },
          { en: 'Closed tickets require admin permission to edit', es: 'Los tickets cerrados requieren permiso de admin para editar' },
          { en: 'Confirmation prompt when closing a form with unsaved changes', es: 'Confirmación al cerrar un formulario con cambios sin guardar' },
        ],
      },
      {
        title: { en: 'Comments', es: 'Comentarios' },
        features: [
          { en: '@mention system with autocomplete dropdown', es: 'Sistema de @menciones con autocompletado desplegable' },
          { en: 'Keyboard navigation in mention dropdown (arrows, Enter, Escape)', es: 'Navegación por teclado en el desplegable de menciones (flechas, Enter, Escape)' },
          { en: 'Submit with Enter, newline with Shift+Enter', es: 'Enviar con Enter, nueva línea con Shift+Enter' },
          { en: 'Pasted text is automatically cleaned to plain text', es: 'El texto pegado se limpia automáticamente a texto plano' },
        ],
      },
      {
        title: { en: 'Attachments', es: 'Archivos Adjuntos' },
        features: [
          { en: 'Upload images and videos to tickets', es: 'Subir imágenes y videos a tickets' },
          { en: 'Drag-and-drop upload with visual overlay', es: 'Subida arrastrando y soltando con indicador visual' },
          { en: 'Thumbnail preview grid', es: 'Cuadrícula de miniaturas de vista previa' },
          { en: 'Lightbox viewer with zoom and pan for images', es: 'Visor en pantalla completa con zoom y desplazamiento para imágenes' },
          { en: 'Video playback with native controls', es: 'Reproducción de video con controles nativos' },
          { en: 'Delete attachment with confirmation', es: 'Eliminar adjunto con confirmación' },
          { en: 'Cloud storage for files (S3-compatible)', es: 'Almacenamiento en la nube para archivos (compatible con S3)' },
        ],
      },
      {
        title: { en: 'Tags', es: 'Etiquetas' },
        features: [
          { en: 'Create and delete tags with optional color', es: 'Crear y eliminar etiquetas con color opcional' },
          { en: 'Tag selector in ticket creation and detail', es: 'Selector de etiquetas en creación y detalle de ticket' },
          { en: 'Colored tag badges in ticket list', es: 'Insignias de etiquetas con color en lista de tickets' },
          { en: 'Tag management restricted by permission (admin/agent)', es: 'Gestión de etiquetas restringida por permisos (admin/agente)' },
        ],
      },
      {
        title: { en: 'Permissions', es: 'Permisos' },
        features: [
          { en: 'Role-based access: admin, agent, reporter', es: 'Acceso basado en roles: admin, agente, reportero' },
          { en: '20+ permissions covering all features', es: '20+ permisos cubriendo todas las funcionalidades' },
          { en: 'System admins have full access to all workspaces', es: 'Los admins del sistema tienen acceso completo a todos los workspaces' },
          { en: 'Buttons and actions are shown or hidden based on your role', es: 'Botones y acciones se muestran u ocultan según tu rol' },
        ],
      },
      {
        title: { en: 'Notifications', es: 'Notificaciones' },
        features: [
          { en: 'In-app notifications with bell icon and unread indicator', es: 'Notificaciones in-app con icono de campana e indicador de no leídos' },
          { en: 'Email notifications for important events', es: 'Notificaciones por email para eventos importantes' },
          { en: 'Notifies on ticket creation, assignment, status change, and new comments', es: 'Notifica al crear tickets, asignar, cambiar estado y nuevos comentarios' },
          { en: 'Choose which notifications you receive by email or in-app', es: 'Elige qué notificaciones recibes por email o en la app' },
          { en: 'Notification preferences page with per-event toggles', es: 'Página de preferencias de notificaciones con controles por evento' },
          { en: 'Mark as read individually or all at once', es: 'Marcar como leído individualmente o todos a la vez' },
          { en: 'Navigate to related ticket on click', es: 'Navegar al ticket relacionado al hacer clic' },
          { en: 'Unread count updates automatically', es: 'El conteo de no leídos se actualiza automáticamente' },
        ],
      },
      {
        title: { en: 'Internationalization', es: 'Internacionalización' },
        features: [
          { en: 'Full UI translated: English and Spanish', es: 'UI completamente traducida: inglés y español' },
          { en: 'Language selector in user preferences', es: 'Selector de idioma en preferencias de usuario' },
          { en: 'Email templates translated (English and Spanish)', es: 'Plantillas de email traducidas (inglés y español)' },
          { en: 'All labels translated — priorities, statuses, categories, roles', es: 'Todas las etiquetas traducidas — prioridades, estados, categorías, roles' },
        ],
      },
      {
        title: { en: 'Themes', es: 'Temas' },
        features: [
          { en: '5 themes: System, Light, Light Border, Dark, Dark Deep', es: '5 temas: Sistema, Claro, Claro con Bordes, Oscuro, Oscuro Profundo' },
          { en: 'System theme auto-detects OS preference', es: 'Tema del sistema detecta automáticamente la preferencia del SO' },
          { en: 'Theme preference persisted per user', es: 'Preferencia de tema persistida por usuario' },
        ],
      },
      {
        title: { en: 'Settings', es: 'Configuración' },
        features: [
          { en: 'Modular settings with sidebar sub-navigation', es: 'Configuración modular con sub-navegación en barra lateral' },
          { en: 'Sidebar with expandable workspace list and workspace-level settings', es: 'Barra lateral con lista de espacios expandible y ajustes a nivel de espacio' },
          { en: 'Sections: Account, Security, Preferences, Notifications', es: 'Secciones: Cuenta, Seguridad, Preferencias, Notificaciones' },
          { en: 'Inline name editing with save on change', es: 'Edición de nombre en línea con guardado al cambiar' },
        ],
      },
    ],
  },
];
