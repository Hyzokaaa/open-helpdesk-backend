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
    version: '1.16.0',
    date: '2026-08-24',
    categories: [
      {
        title: { en: 'Organizations', es: 'Organizaciones' },
        features: [
          { en: 'Create and manage organizations — group related contacts under one company', es: 'Crea y gestiona organizaciones — agrupa contactos relacionados bajo una empresa' },
          { en: 'Add and remove members from organizations', es: 'Agrega y elimina miembros de organizaciones' },
          { en: 'Notes field to keep context about each organization', es: 'Campo de notas para mantener contexto sobre cada organización' },
          { en: 'Auto-enroll contacts by email domain — new contacts are matched to their organization automatically', es: 'Inscripción automática por dominio de email — los nuevos contactos se asocian a su organización automáticamente' },
        ],
      },
      {
        title: { en: 'Departments', es: 'Departamentos' },
        features: [
          { en: 'Create departments to organize your team — assign agents and route tickets by area', es: 'Crea departamentos para organizar tu equipo — asigna agentes y dirige tickets por área' },
          { en: 'Filter tickets by department in list and board view', es: 'Filtra tickets por departamento en la lista y el tablero' },
          { en: 'Department tabs for quick switching between team areas', es: 'Pestañas de departamento para cambiar rápidamente entre áreas del equipo' },
          { en: 'Assign tickets to a department from the ticket detail view', es: 'Asigna tickets a un departamento desde la vista de detalle del ticket' },
        ],
      },
      {
        title: { en: 'Rich Text Editor', es: 'Editor de Texto Enriquecido' },
        features: [
          { en: 'Format comments with bold, italic, strikethrough, code, and lists', es: 'Formatea comentarios con negrita, cursiva, tachado, código y listas' },
          { en: 'Format ticket descriptions with the same rich text editor', es: 'Formatea descripciones de tickets con el mismo editor de texto enriquecido' },
          { en: '@mentions and canned responses (/slash) work inside the rich text editor', es: 'Las @menciones y respuestas predefinidas (/slash) funcionan dentro del editor' },
          { en: 'Contextual hints appear when using lists or code blocks', es: 'Sugerencias contextuales aparecen al usar listas o bloques de código' },
        ],
      },
      {
        title: { en: 'Custom Domains', es: 'Dominios Personalizados' },
        features: [
          { en: 'Connect your own domain to any workspace — your customers see your brand, not ours', es: 'Conecta tu propio dominio a cualquier workspace — tus clientes ven tu marca, no la nuestra' },
          { en: 'DNS verification with CNAME or A record support', es: 'Verificación DNS con soporte para registros CNAME o A' },
          { en: 'Automatic CORS configuration for verified domains', es: 'Configuración CORS automática para dominios verificados' },
          { en: 'Portal accessible at your custom domain root', es: 'Portal accesible desde la raíz de tu dominio personalizado' },
          { en: 'Multi-workspace support on a single custom domain', es: 'Soporte multi-workspace en un solo dominio personalizado' },
        ],
      },
      {
        title: { en: 'System & Workspace Branding', es: 'Marca del Sistema y Workspace' },
        features: [
          { en: 'Upload a logo and customize app name at the system level', es: 'Sube un logo y personaliza el nombre de la app a nivel de sistema' },
          { en: 'Each workspace can override branding with its own logo, name, and subtitle', es: 'Cada workspace puede personalizar su marca con su propio logo, nombre y subtítulo' },
          { en: 'Branding applies across dashboard, login, and portal', es: 'La marca se aplica en el dashboard, login y portal' },
        ],
      },
      {
        title: { en: 'Ticket Improvements', es: 'Mejoras en Tickets' },
        features: [
          { en: 'Create tickets on behalf of a contact — search by email, auto-creates the contact if new', es: 'Crea tickets en nombre de un contacto — busca por email, crea el contacto automáticamente si es nuevo' },
          { en: '"Reported by" and "Registered by" shown separately in ticket detail', es: '"Reportado por" y "Registrado por" mostrados por separado en el detalle del ticket' },
          { en: 'Send & Resolve — reply and close a ticket in one click', es: 'Enviar y Resolver — responde y cierra un ticket en un click' },
          { en: 'Ticket source badge shows where the ticket came from (UI, email, portal, or API)', es: 'Insignia de origen del ticket muestra de dónde vino (UI, email, portal o API)' },
          { en: 'Original email date preserved and shown when tickets come from email import', es: 'Fecha original del email preservada y visible cuando los tickets vienen de importación de email' },
          { en: 'Sequential ticket search matches partial numbers', es: 'La búsqueda de tickets por número acepta coincidencias parciales' },
        ],
      },
      {
        title: { en: 'Email Rules', es: 'Reglas de Email' },
        features: [
          { en: 'Create rules to filter inbound emails — skip, assign, or route based on sender, subject, or domain', es: 'Crea reglas para filtrar emails entrantes — omitir, asignar o dirigir según remitente, asunto o dominio' },
          { en: 'Rules are evaluated before creating tickets from email', es: 'Las reglas se evalúan antes de crear tickets desde email' },
          { en: 'Drag to reorder rules by priority', es: 'Arrastra para reordenar reglas por prioridad' },
        ],
      },
      {
        title: { en: 'Portal Improvements', es: 'Mejoras del Portal' },
        features: [
          { en: 'Department selector in the portal ticket submission form', es: 'Selector de departamento en el formulario de envío de tickets del portal' },
          { en: 'Portal language toggle', es: 'Selector de idioma en el portal' },
        ],
      },
      {
        title: { en: 'Members & Contacts', es: 'Miembros y Contactos' },
        features: [
          { en: 'Separate tabs for team members and contacts', es: 'Pestañas separadas para miembros del equipo y contactos' },
          { en: 'Contact origin badge — see who was auto-created from email', es: 'Insignia de origen del contacto — ve quién fue creado automáticamente desde email' },
          { en: 'Promote contacts to team members with one click', es: 'Promueve contactos a miembros del equipo con un click' },
        ],
      },
      {
        title: { en: 'Workspace Setup Wizard', es: 'Asistente de Configuración del Workspace' },
        features: [
          { en: 'Multi-step workspace creation with guided setup', es: 'Creación de workspace en múltiples pasos con configuración guiada' },
        ],
      },
      {
        title: { en: 'Filesystem Storage', es: 'Almacenamiento en Disco' },
        features: [
          { en: 'Store files on disk instead of S3 — no cloud storage required for selfhosted deployments', es: 'Almacena archivos en disco en vez de S3 — sin necesidad de almacenamiento en la nube para instalaciones selfhosted' },
        ],
      },
      {
        title: { en: 'Install Script', es: 'Script de Instalación' },
        features: [
          { en: 'Interactive installer asks to install prerequisites (Node.js, PostgreSQL, nginx)', es: 'Instalador interactivo que ofrece instalar prerrequisitos (Node.js, PostgreSQL, nginx)' },
          { en: 'Automatic database creation and password setup', es: 'Creación automática de base de datos y configuración de contraseña' },
          { en: 'Step-by-step progress indicator', es: 'Indicador de progreso paso a paso' },
        ],
      },
      {
        title: { en: 'Improvements', es: 'Mejoras' },
        features: [
          { en: 'User avatar dropdown menu in navbar', es: 'Menú desplegable con avatar de usuario en la barra de navegación' },
          { en: 'Report date perspective toggle — view stats by import date or original email date', es: 'Selector de perspectiva de fecha en reportes — ve estadísticas por fecha de importación o fecha original del email' },
          { en: 'Date range preset "All" to see complete history', es: 'Preselección "Todo" en rango de fechas para ver el historial completo' },
          { en: 'Ticket detail layout reordered — comments before attachments', es: 'Diseño del detalle de ticket reordenado — comentarios antes que adjuntos' },
          { en: 'Details and Activity in separate tabs', es: 'Detalles y Actividad en pestañas separadas' },
        ],
      },
    ],
  },
  {
    version: '1.15.0',
    date: '2026-08-04',
    categories: [
      {
        title: { en: 'Universal System Logs', es: 'Registros Universales del Sistema' },
        features: [
          { en: 'Full activity logging across the platform — track every action performed by users and the system', es: 'Registro completo de actividad en toda la plataforma — rastrea cada acción realizada por usuarios y el sistema' },
          { en: 'Filter logs by category, level, source, and date range', es: 'Filtra registros por categoría, nivel, fuente y rango de fechas' },
          { en: 'Dedicated logs view for system administrators', es: 'Vista dedicada de registros para administradores del sistema' },
        ],
      },
      {
        title: { en: 'Platform Mailbox', es: 'Buzón de Plataforma' },
        features: [
          { en: 'Configure a single IMAP mailbox in Admin Settings to receive emails across all workspaces', es: 'Configura un único buzón IMAP en Configuración de Admin para recibir emails en todos los workspaces' },
          { en: 'Emails are automatically routed to the correct workspace based on address', es: 'Los emails se enrutan automáticamente al workspace correcto según la dirección' },
        ],
      },
      {
        title: { en: 'Mailbox Address Filtering', es: 'Filtrado de Direcciones del Buzón' },
        features: [
          { en: 'Choose which emails to process: only the mailbox address, specific aliases, or all emails (catch-all)', es: 'Elige qué emails procesar: solo la dirección del buzón, alias específicos, o todos los emails (catch-all)' },
        ],
      },
      {
        title: { en: 'Email Encryption Options', es: 'Opciones de Cifrado de Email' },
        features: [
          { en: 'Configure TLS, TLS with self-signed certificates, or no encryption for IMAP connections', es: 'Configura TLS, TLS con certificados autofirmados, o sin cifrado para conexiones IMAP' },
        ],
      },
      {
        title: { en: 'Auto-Reply Control', es: 'Control de Respuesta Automática' },
        features: [
          { en: 'Toggle automatic confirmation emails when tickets are created from inbound email, per mailbox', es: 'Activa o desactiva los emails de confirmación automática cuando se crean tickets desde email entrante, por buzón' },
        ],
      },
      {
        title: { en: 'Date Format & Timezone', es: 'Formato de Fecha y Zona Horaria' },
        features: [
          { en: 'Choose your preferred date format (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD) in user preferences', es: 'Elige tu formato de fecha preferido (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD) en preferencias de usuario' },
          { en: 'Set your timezone so dates and times are displayed in your local time', es: 'Configura tu zona horaria para que las fechas y horas se muestren en tu hora local' },
        ],
      },
      {
        title: { en: 'Improvements', es: 'Mejoras' },
        features: [
          { en: 'Resend pending workspace invitations with one click', es: 'Reenvía invitaciones pendientes del workspace con un click' },
          { en: 'Upgraded to PostgreSQL 18 for improved performance', es: 'Actualización a PostgreSQL 18 para mejor rendimiento' },
        ],
      },
    ],
  },
  {
    version: '1.14.0',
    date: '2026-07-31',
    categories: [
      {
        title: { en: 'System Email Configuration', es: 'Configuración de Correo del Sistema' },
        features: [
          { en: 'Configure SMTP settings from the Admin UI — no more editing environment variables', es: 'Configura SMTP desde la UI de administración — sin editar variables de entorno' },
          { en: 'System email is used for password reset, email verification, and workspace notifications', es: 'El correo del sistema se usa para recuperación de contraseña, verificación y notificaciones del workspace' },
        ],
      },
      {
        title: { en: 'Invitations & Signup', es: 'Invitaciones y Registro' },
        features: [
          { en: 'Invite team members by email — invitations now use the workspace custom sender when configured', es: 'Invita miembros por correo — las invitaciones ahora usan el sender personalizado del workspace cuando está configurado' },
          { en: 'Copy invitation link directly from the pending invitations list', es: 'Copia el enlace de invitación directamente desde la lista de invitaciones pendientes' },
          { en: 'New users can sign up via invitation link and are automatically added to the workspace', es: 'Nuevos usuarios pueden registrarse via enlace de invitación y se agregan automáticamente al workspace' },
          { en: 'Clear warning when no email service is configured — with link to settings', es: 'Aviso claro cuando no hay servicio de correo configurado — con enlace a la configuración' },
        ],
      },
      {
        title: { en: 'Mailbox Controls', es: 'Controles de Buzón' },
        features: [
          { en: 'Import all emails from a mailbox — process your entire inbox backlog with one click', es: 'Importa todos los emails de un buzón — procesa todo tu inbox acumulado con un click' },
          { en: 'Poll Now — trigger an immediate check for new emails without waiting for the next interval', es: 'Consultar Ahora — lanza una verificación inmediata de nuevos emails sin esperar al próximo intervalo' },
          { en: 'Pause and Resume polling — stop email processing temporarily and restart when ready', es: 'Pausar y Reanudar polling — detén el procesamiento de emails temporalmente y reinicia cuando estés listo' },
          { en: 'Live countdown showing last poll time, duration, and next poll — auto-refreshes every 5 seconds', es: 'Contador en vivo mostrando último poll, duración y próximo poll — se actualiza cada 5 segundos' },
          { en: 'All emails in the mailbox are now processed regardless of the To: address', es: 'Todos los emails del buzón se procesan ahora sin importar la dirección To:' },
        ],
      },
      {
        title: { en: 'Multi-Frontend Support', es: 'Soporte Multi-Frontend' },
        features: [
          { en: 'Email links (password reset, invitations) now point to the correct frontend when multiple domains are configured', es: 'Los enlaces en correos (recuperación, invitaciones) ahora apuntan al frontend correcto cuando hay múltiples dominios configurados' },
        ],
      },
    ],
  },
  {
    version: '1.13.0',
    date: '2026-07-23',
    categories: [
      {
        title: { en: 'AI Writing Assistant', es: 'Asistente de Escritura IA' },
        features: [
          { en: 'Improve ticket descriptions with AI — rewrite for clarity in one click', es: 'Mejora descripciones de tickets con IA — reescribe con claridad en un click' },
          { en: 'Translate ticket descriptions between English and Spanish automatically', es: 'Traduce descripciones de tickets entre inglés y español automáticamente' },
          { en: 'AI remembers previous results — no need to reprocess the same description twice', es: 'La IA recuerda resultados anteriores — no necesitas reprocesar la misma descripción dos veces' },
        ],
      },
      {
        title: { en: 'Ticket Followers & Collaborators', es: 'Seguidores y Colaboradores de Tickets' },
        features: [
          { en: 'Follow tickets to stay updated — followers receive notifications on changes', es: 'Sigue tickets para mantenerte al día — los seguidores reciben notificaciones de cambios' },
          { en: '@mentioning someone in a comment automatically adds them as a follower', es: 'Mencionar a alguien con @ en un comentario lo agrega automáticamente como seguidor' },
          { en: 'Followers get read-only access to the ticket — see everything, no accidental edits', es: 'Los seguidores tienen acceso de solo lectura al ticket — ven todo sin ediciones accidentales' },
        ],
      },
      {
        title: { en: 'Ticket Pickup & Transfer', es: 'Tomar y Transferir Tickets' },
        features: [
          { en: 'Pick up open tickets from the shared pool — assigns the ticket to you instantly', es: 'Toma tickets abiertos del pool compartido — se te asigna el ticket al instante' },
          { en: 'Transfer tickets to another agent — the recipient must accept before the transfer completes', es: 'Transfiere tickets a otro agente — el destinatario debe aceptar antes de que se complete' },
          { en: 'Accept or reject transfer requests directly from the ticket detail view', es: 'Acepta o rechaza solicitudes de transferencia directamente desde la vista de detalle del ticket' },
          { en: 'Transfer requests expire automatically after 48 hours if not responded', es: 'Las solicitudes de transferencia expiran automáticamente después de 48 horas si no se responden' },
        ],
      },
      {
        title: { en: 'Smarter Notifications', es: 'Notificaciones Inteligentes' },
        features: [
          { en: 'Notifications now reach only people involved in the ticket — no more noise for the whole team', es: 'Las notificaciones ahora llegan solo a los involucrados en el ticket — sin más ruido para todo el equipo' },
          { en: 'Click any notification to jump directly to the ticket', es: 'Haz click en cualquier notificación para ir directamente al ticket' },
          { en: 'Notification type labels — instantly see if it\'s a new ticket, comment, status change, or transfer', es: 'Etiquetas de tipo en notificaciones — ve al instante si es un ticket nuevo, comentario, cambio de estado o transferencia' },
        ],
      },
      {
        title: { en: 'Data Migration', es: 'Migración de Datos' },
        features: [
          { en: 'Export all your workspace data — tickets, comments, tags, members, and more', es: 'Exporta todos los datos de tu workspace — tickets, comentarios, etiquetas, miembros y más' },
          { en: 'Import data from another workspace — upload an export file or paste a link', es: 'Importa datos desde otro workspace — sube un archivo de exportación o pega un enlace' },
          { en: 'Generate a shareable export link — valid for 24 hours, single use', es: 'Genera un enlace de exportación compartible — válido por 24 horas, un solo uso' },
          { en: 'Safe to re-import — duplicate tickets and tags are detected and skipped', es: 'Seguro para reimportar — los tickets y etiquetas duplicados se detectan y se omiten' },
        ],
      },
      {
        title: { en: 'Custom Email Sender', es: 'Remitente de Email Personalizado' },
        features: [
          { en: 'Send notifications from your own email address — your customers see your brand, not ours', es: 'Envía notificaciones desde tu propia dirección de email — tus clientes ven tu marca, no la nuestra' },
          { en: 'Just enter your email and password — SMTP settings are auto-detected for Gmail, Outlook, and more', es: 'Solo ingresa tu email y contraseña — la configuración SMTP se auto-detecta para Gmail, Outlook y más' },
          { en: 'Advanced settings available for self-hosted mail servers', es: 'Configuración avanzada disponible para servidores de correo propios' },
          { en: 'Test your connection before saving to make sure everything works', es: 'Prueba tu conexión antes de guardar para asegurarte de que todo funciona' },
        ],
      },
      {
        title: { en: 'Improvements', es: 'Mejoras' },
        features: [
          { en: 'All dropdown selectors now support type-to-search when there are more than 5 options', es: 'Todos los selectores desplegables ahora permiten buscar escribiendo cuando hay más de 5 opciones' },
          { en: 'Comment timestamps — see the date and time of each comment', es: 'Fecha y hora en comentarios — ve cuándo se publicó cada comentario' },
        ],
      },
    ],
  },
  {
    version: '1.12.0',
    date: '2026-07-07',
    categories: [
      {
        title: { en: 'Integrate with Your Product', es: 'Integra con tu Producto' },
        features: [
          { en: 'Connect your app to Open Helpdesk with one API call, your users access support without a separate login', es: 'Conecta tu app a Open Helpdesk con una llamada API, tus usuarios acceden al soporte sin un login separado' },
          { en: 'Choose which API keys can create user sessions with the new "Token Exchange" permission', es: 'Elige qué API keys pueden crear sesiones de usuario con el nuevo permiso "Token Exchange"' },
        ],
      },
      {
        title: { en: 'Improvements', es: 'Mejoras' },
        features: [
          { en: 'Dragging tickets on the board is now smooth, no more page jumps', es: 'Arrastrar tickets en el tablero ahora es fluido, sin saltos de página' },
        ],
      },
    ],
  },
  {
    version: '1.11.0',
    date: '2026-06-04',
    categories: [
      {
        title: { en: 'Public API & Webhooks', es: 'API Pública y Webhooks' },
        features: [
          { en: 'REST API for tickets, comments, and members — integrate Open Helpdesk with any tool', es: 'API REST para tickets, comentarios y miembros — integra Open Helpdesk con cualquier herramienta' },
          { en: 'API keys with custom scopes — control exactly what each key can do', es: 'API keys con scopes personalizados — controla exactamente qué puede hacer cada key' },
          { en: 'Key expiration — set 30, 60, 90 days, 1 year, or no expiration', es: 'Expiración de keys — configura 30, 60, 90 días, 1 año o sin expiración' },
          { en: 'Webhooks — receive HTTP notifications when tickets or comments are created or updated', es: 'Webhooks — recibe notificaciones HTTP cuando se crean o actualizan tickets o comentarios' },
          { en: 'Webhook signatures — verify authenticity with HMAC-SHA256', es: 'Firmas de webhooks — verifica autenticidad con HMAC-SHA256' },
        ],
      },
      {
        title: { en: 'Personal Stats Dashboard', es: 'Dashboard de Estadísticas Personal' },
        features: [
          { en: 'My Stats page — see your personal performance metrics at a glance', es: 'Página Mis Estadísticas — ve tus métricas de rendimiento personal de un vistazo' },
          { en: 'Agents see tickets resolved, response times, CSAT score, and resolution trends', es: 'Los agentes ven tickets resueltos, tiempos de respuesta, CSAT y tendencia de resoluciones' },
          { en: 'Reporters see tickets created, resolution status, and how fast they get served', es: 'Los reporteros ven tickets creados, estado de resolución y qué tan rápido los atienden' },
          { en: 'Admins and supervisors can view any team member\'s stats from the members page', es: 'Admins y supervisores pueden ver las estadísticas de cualquier miembro del equipo' },
        ],
      },
      {
        title: { en: 'Bulk Member Import', es: 'Importación Masiva de Miembros' },
        features: [
          { en: 'Import members from a CSV file — upload, preview, edit inline, and confirm', es: 'Importa miembros desde un archivo CSV — sube, previsualiza, edita en línea y confirma' },
          { en: 'Welcome emails with password setup link sent to new users automatically', es: 'Emails de bienvenida con enlace para crear contraseña enviados automáticamente' },
          { en: 'Option to skip email verification for imported users', es: 'Opción de omitir la verificación de email para usuarios importados' },
        ],
      },
      {
        title: { en: 'Permissions & Visibility', es: 'Permisos y Visibilidad' },
        features: [
          { en: 'Sidebar items now show only what your role can access — cleaner navigation', es: 'Los elementos del sidebar ahora muestran solo lo que tu rol puede acceder — navegación más limpia' },
          { en: 'Agents can view members but cannot invite or manage — read-only access', es: 'Los agentes pueden ver miembros pero no invitar ni gestionar — acceso de solo lectura' },
        ],
      },
      {
        title: { en: 'Sign in with Google & Microsoft', es: 'Iniciar sesión con Google y Microsoft' },
        features: [
          { en: 'Sign in or sign up with your Google or Microsoft account — one click, no password needed', es: 'Inicia sesión o regístrate con tu cuenta de Google o Microsoft — un click, sin contraseña' },
          { en: 'New OAuth users are guided through onboarding automatically', es: 'Los nuevos usuarios OAuth son guiados por el onboarding automáticamente' },
        ],
      },
      {
        title: { en: 'Customer Portal', es: 'Portal de Cliente' },
        features: [
          { en: 'Public ticket submission form — your customers can create tickets without logging in', es: 'Formulario público de tickets — tus clientes pueden crear tickets sin iniciar sesión' },
          { en: 'Custom fields shown in the portal — required fields are validated before submission', es: 'Campos personalizados en el portal — los campos requeridos se validan antes de enviar' },
          { en: 'File attachments supported in portal submissions', es: 'Adjuntos de archivos soportados en envíos del portal' },
          { en: 'Portal respects your workspace branding and color palette', es: 'El portal respeta el branding y paleta de colores de tu workspace' },
          { en: 'Track your ticket via magic link — no login needed, link sent by email', es: 'Sigue tu ticket con un enlace mágico — sin login, enlace enviado por email' },
          { en: 'Add comments and view agent replies from the tracking page', es: 'Agrega comentarios y ve las respuestas del agente desde la página de seguimiento' },
          { en: 'View attachments with full-screen image viewer and video player', es: 'Ve adjuntos con visor de imágenes a pantalla completa y reproductor de video' },
          { en: 'Embeddable widget — add a support button to any website with a single script tag', es: 'Widget embebible — agrega un botón de soporte a cualquier sitio web con una sola línea de código' },
        ],
      },
      {
        title: { en: 'SLA Tracking', es: 'Seguimiento de SLA' },
        features: [
          { en: 'Set response and resolution time targets per priority — define your SLA policy per workspace', es: 'Define tiempos objetivo de respuesta y resolución por prioridad — configura tu política SLA por workspace' },
          { en: 'Automatic breach detection — tickets exceeding SLA targets are flagged in real time', es: 'Detección automática de incumplimientos — los tickets que exceden los objetivos SLA se marcan en tiempo real' },
          { en: 'First response time tracked per ticket — see how fast your team responds', es: 'Tiempo de primera respuesta por ticket — ve qué tan rápido responde tu equipo' },
          { en: 'SLA compliance percentage shown in reports dashboard', es: 'Porcentaje de cumplimiento SLA en el panel de reportes' },
          { en: 'SLA status visible in ticket detail — met, breached, or time remaining', es: 'Estado SLA visible en el detalle del ticket — cumplido, incumplido o tiempo restante' },
        ],
      },
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
