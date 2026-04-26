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
    version: '1.0.0',
    date: '2026-04-21',
    categories: [
      {
        title: { en: 'Authentication & Account', es: 'Autenticación y Cuenta' },
        features: [
          { en: 'Email/password login with JWT authentication', es: 'Inicio de sesión con email/contraseña y autenticación JWT' },
          { en: 'Forgot password flow with email reset link (1-hour expiry)', es: 'Flujo de contraseña olvidada con enlace de restablecimiento por email (expira en 1 hora)' },
          { en: 'Password reset via token-authenticated link', es: 'Restablecimiento de contraseña mediante enlace con token' },
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
          { en: 'Activate/deactivate users (soft delete)', es: 'Activar/desactivar usuarios (eliminación lógica)' },
          { en: 'Admin panel with user and workspace management tables', es: 'Panel de administración con tablas de gestión de usuarios y espacios' },
          { en: 'Confirmation modals for all admin actions (promote, demote, activate, deactivate)', es: 'Modales de confirmación para todas las acciones de administración (promover, degradar, activar, desactivar)' },
        ],
      },
      {
        title: { en: 'Workspaces', es: 'Espacios de Trabajo' },
        features: [
          { en: 'Create workspaces with name and description (system admin only)', es: 'Crear espacios de trabajo con nombre y descripción (solo admin del sistema)' },
          { en: 'Edit workspace in Sheet overlay panel with two-column layout', es: 'Editar espacio en panel lateral deslizable con diseño de dos columnas' },
          { en: 'Delete workspace with danger zone and irreversibility warning', es: 'Eliminar espacio con zona de peligro y advertencia de irreversibilidad' },
          { en: 'System admins see and access all workspaces', es: 'Los administradores del sistema ven y acceden a todos los espacios' },
          { en: 'Auto-assign creator as workspace admin', es: 'Asignación automática del creador como admin del espacio' },
          { en: 'Cascade deletes: workspace removal cleans up all related data', es: 'Eliminación en cascada: borrar un espacio limpia todos los datos relacionados' },
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
          { en: 'Ticket detail and creation in Sheet overlay panel', es: 'Detalle y creación de ticket en panel lateral deslizable' },
          { en: 'Inline editing of title, description, priority, and category', es: 'Edición en línea de título, descripción, prioridad y categoría' },
          { en: 'Permission-based field editing (closed tickets require special permission)', es: 'Edición de campos basada en permisos (tickets cerrados requieren permiso especial)' },
          { en: 'Discard confirmation when closing form with unsaved changes', es: 'Confirmación de descarte al cerrar formulario con cambios sin guardar' },
        ],
      },
      {
        title: { en: 'Comments', es: 'Comentarios' },
        features: [
          { en: '@mention system with autocomplete dropdown', es: 'Sistema de @menciones con autocompletado desplegable' },
          { en: 'Keyboard navigation in mention dropdown (arrows, Enter, Escape)', es: 'Navegación por teclado en el desplegable de menciones (flechas, Enter, Escape)' },
          { en: 'Submit with Enter, newline with Shift+Enter', es: 'Enviar con Enter, nueva línea con Shift+Enter' },
          { en: 'HTML sanitization to prevent XSS', es: 'Sanitización de HTML para prevenir XSS' },
          { en: 'Paste handler strips formatting (plain text only)', es: 'El pegado elimina formato (solo texto plano)' },
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
          { en: 'S3-compatible storage (AWS S3 or custom endpoint)', es: 'Almacenamiento compatible con S3 (AWS S3 o endpoint personalizado)' },
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
          { en: '20 granular permissions across all modules', es: '20 permisos granulares en todos los módulos' },
          { en: 'System admin bypasses all workspace permissions', es: 'El admin del sistema omite todos los permisos de workspace' },
          { en: 'UI elements rendered conditionally based on permissions', es: 'Elementos de UI renderizados condicionalmente según permisos' },
        ],
      },
      {
        title: { en: 'Notifications', es: 'Notificaciones' },
        features: [
          { en: 'In-app notifications with bell icon and unread indicator', es: 'Notificaciones in-app con icono de campana e indicador de no leídos' },
          { en: 'Email notifications via SMTP or Postmark', es: 'Notificaciones por email vía SMTP o Postmark' },
          { en: 'Events: ticket created, assigned, status changed, new comment', es: 'Eventos: ticket creado, asignado, cambio de estado, nuevo comentario' },
          { en: 'Per-event toggles for email and in-app channels', es: 'Toggles por evento para canales de email e in-app' },
          { en: 'Notification preferences page with matrix UI', es: 'Página de preferencias de notificaciones con interfaz matricial' },
          { en: 'Mark as read individually or all at once', es: 'Marcar como leído individualmente o todos a la vez' },
          { en: 'Navigate to related ticket on click', es: 'Navegar al ticket relacionado al hacer clic' },
          { en: 'Unread count polled every 30 seconds', es: 'Conteo de no leídos consultado cada 30 segundos' },
        ],
      },
      {
        title: { en: 'Internationalization', es: 'Internacionalización' },
        features: [
          { en: 'Full UI translated: English and Spanish', es: 'UI completamente traducida: inglés y español' },
          { en: 'Language selector in user preferences', es: 'Selector de idioma en preferencias de usuario' },
          { en: 'Email templates translated (en/es)', es: 'Plantillas de email traducidas (en/es)' },
          { en: 'Enum labels translated (priorities, statuses, categories)', es: 'Etiquetas de enums traducidas (prioridades, estados, categorías)' },
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
