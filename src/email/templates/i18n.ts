type Translations = Record<string, Record<string, string>>;

const APP_NAME = process.env.APP_NAME || 'Open Helpdesk';

const translations: Translations = {
  // Shared
  'email.header': {
    en: APP_NAME,
    es: APP_NAME,
  },
  'email.viewTicket': {
    en: 'View Ticket',
    es: 'Ver Ticket',
  },

  // Ticket created
  'ticketCreated.title': {
    en: 'New Ticket Created',
    es: 'Nuevo Ticket Creado',
  },
  'ticketCreated.subject': {
    en: 'New ticket',
    es: 'Nuevo ticket',
  },
  'ticketCreated.body': {
    en: '{reporterName} created a new ticket in {workspaceName}.',
    es: '{reporterName} creó un nuevo ticket en {workspaceName}.',
  },
  'ticketCreated.fieldTitle': {
    en: 'Title',
    es: 'Título',
  },
  'ticketCreated.fieldPriority': {
    en: 'Priority',
    es: 'Prioridad',
  },
  'ticketCreated.fieldCategory': {
    en: 'Category',
    es: 'Categoría',
  },

  // Ticket assigned
  'ticketAssigned.title': {
    en: 'Ticket Assigned to You',
    es: 'Ticket Asignado a Ti',
  },
  'ticketAssigned.subject': {
    en: 'Ticket assigned to you',
    es: 'Ticket asignado a ti',
  },
  'ticketAssigned.body': {
    en: 'Hi {assigneeName}, a ticket has been assigned to you in {workspaceName}.',
    es: 'Hola {assigneeName}, se te ha asignado un ticket en {workspaceName}.',
  },
  'ticketUnassigned.title': {
    en: 'Ticket Unassigned',
    es: 'Ticket Desasignado',
  },
  'ticketUnassigned.subject': {
    en: 'You have been unassigned from',
    es: 'Has sido desasignado de',
  },
  'ticketUnassigned.body': {
    en: 'You have been unassigned from the following ticket in {workspaceName}.',
    es: 'Has sido desasignado del siguiente ticket en {workspaceName}.',
  },

  // New comment
  'newComment.footer': {
    en: 'Reply to this email to respond · {ticketNumber} · {workspaceName}',
    es: 'Responde a este email para comentar · {ticketNumber} · {workspaceName}',
  },

  // Status changed
  'statusChanged.title': {
    en: 'Status Changed',
    es: 'Estado Cambiado',
  },
  'statusChanged.subject': {
    en: 'Ticket status changed',
    es: 'Estado del ticket cambiado',
  },
  'statusChanged.body': {
    en: 'The status of {ticketName} has been updated.',
    es: 'El estado de {ticketName} ha sido actualizado.',
  },
  // Password reset
  'passwordReset.subject': {
    en: 'Reset your password',
    es: 'Restablecer tu contraseña',
  },
  'passwordReset.title': {
    en: 'Password Reset',
    es: 'Restablecer Contraseña',
  },
  'passwordReset.body': {
    en: 'Hi {firstName}, we received a request to reset your password.',
    es: 'Hola {firstName}, recibimos una solicitud para restablecer tu contraseña.',
  },
  'passwordReset.button': {
    en: 'Reset Password',
    es: 'Restablecer Contraseña',
  },
  'passwordReset.expiry': {
    en: 'This link will expire in 1 hour.',
    es: 'Este enlace expirará en 1 hora.',
  },
  'passwordReset.ignore': {
    en: 'If you did not request this, you can safely ignore this email.',
    es: 'Si no solicitaste esto, puedes ignorar este correo.',
  },

  // Email verification
  'emailVerification.subject': {
    en: 'Verify your email',
    es: 'Verifica tu correo',
  },
  'emailVerification.title': {
    en: 'Email Verification',
    es: 'Verificación de Correo',
  },
  'emailVerification.body': {
    en: 'Hi {firstName}, please verify your email to get started.',
    es: 'Hola {firstName}, por favor verifica tu correo para comenzar.',
  },
  'emailVerification.button': {
    en: 'Verify Email',
    es: 'Verificar Correo',
  },
  'emailVerification.expiry': {
    en: 'This link will expire in 24 hours.',
    es: 'Este enlace expirará en 24 horas.',
  },
  'emailVerification.ignore': {
    en: 'If you did not create an account, you can safely ignore this email.',
    es: 'Si no creaste una cuenta, puedes ignorar este correo.',
  },

  // Import welcome
  'importWelcome.subject': {
    en: 'You\'ve been added to a workspace',
    es: 'Has sido agregado a un espacio de trabajo',
  },
  'importWelcome.title': {
    en: 'Welcome!',
    es: 'Bienvenido!',
  },
  'importWelcome.body': {
    en: 'Hi {firstName}, you\'ve been added to <strong>{workspaceName}</strong>. Set your password to get started.',
    es: 'Hola {firstName}, has sido agregado a <strong>{workspaceName}</strong>. Establece tu contraseña para comenzar.',
  },
  'importWelcome.button': {
    en: 'Set Password',
    es: 'Establecer Contraseña',
  },
  'importWelcome.expiry': {
    en: 'This link will expire in 1 hour.',
    es: 'Este enlace expirará en 1 hora.',
  },
  'importWelcome.accessAnytime': {
    en: 'You can access the workspace anytime at: <a href="{workspaceUrl}" style="color: #6330f7;">{workspaceUrl}</a>',
    es: 'Puedes acceder al workspace en cualquier momento en: <a href="{workspaceUrl}" style="color: #6330f7;">{workspaceUrl}</a>',
  },

  // Workspace invitation
  'invitation.subject': {
    en: 'You\'ve been invited to a workspace',
    es: 'Has sido invitado a un espacio de trabajo',
  },
  'invitation.title': {
    en: 'Workspace Invitation',
    es: 'Invitación a Espacio de Trabajo',
  },
  'invitation.body': {
    en: '{inviterName} has invited you to join <strong>{workspaceName}</strong>.',
    es: '{inviterName} te ha invitado a unirte a <strong>{workspaceName}</strong>.',
  },
  'invitation.button': {
    en: 'View Invitation',
    es: 'Ver Invitación',
  },
  'invitation.expiry': {
    en: 'This invitation will expire in 7 days.',
    es: 'Esta invitación expirará en 7 días.',
  },
  'invitation.accessAnytime': {
    en: 'You can access the workspace anytime at: <a href="{workspaceUrl}" style="color: #6330f7;">{workspaceUrl}</a>',
    es: 'Puedes acceder al workspace en cualquier momento en: <a href="{workspaceUrl}" style="color: #6330f7;">{workspaceUrl}</a>',
  },

  // Ticket confirmation (creator)
  'ticketConfirmation.subject': {
    en: 'Your ticket has been created',
    es: 'Tu ticket ha sido creado',
  },
  'ticketConfirmation.title': {
    en: 'Your support request has been received',
    es: 'Tu solicitud de soporte ha sido recibida',
  },
  'ticketConfirmation.body': {
    en: 'We have received your support request and a ticket has been created.',
    es: 'Hemos recibido tu solicitud de soporte y se ha creado un ticket.',
  },
  'ticketConfirmation.fieldTitle': {
    en: 'Title',
    es: 'Título',
  },
  'ticketConfirmation.trackInfo': {
    en: 'You can track the status of your ticket and add comments using the link below.',
    es: 'Puedes seguir el estado de tu ticket y agregar comentarios usando el enlace a continuación.',
  },
  'ticketConfirmation.button': {
    en: 'Track Your Ticket',
    es: 'Seguir Tu Ticket',
  },
  'ticketConfirmation.updates': {
    en: 'You will also receive email updates when there are new responses.',
    es: 'También recibirás actualizaciones por correo cuando haya nuevas respuestas.',
  },

  // Transfer request
  'transferRequest.subject': {
    en: 'Transfer request',
    es: 'Solicitud de transferencia',
  },
  'transferRequest.title': {
    en: 'Transfer Request',
    es: 'Solicitud de Transferencia',
  },
  'transferRequest.body': {
    en: '{requesterName} wants to transfer a ticket to you in {workspaceName}.',
    es: '{requesterName} quiere transferirte un ticket en {workspaceName}.',
  },
  'transferResolved.subject.accepted': {
    en: 'Transfer accepted',
    es: 'Transferencia aceptada',
  },
  'transferResolved.title.accepted': {
    en: 'Transfer Accepted',
    es: 'Transferencia Aceptada',
  },
  'transferResolved.body.accepted': {
    en: 'Your transfer request for {ticketName} in {workspaceName} has been accepted.',
    es: 'Tu solicitud de transferencia de {ticketName} en {workspaceName} ha sido aceptada.',
  },
  'transferResolved.subject.rejected': {
    en: 'Transfer rejected',
    es: 'Transferencia rechazada',
  },
  'transferResolved.title.rejected': {
    en: 'Transfer Rejected',
    es: 'Transferencia Rechazada',
  },
  'transferResolved.body.rejected': {
    en: 'Your transfer request for {ticketName} in {workspaceName} has been rejected.',
    es: 'Tu solicitud de transferencia de {ticketName} en {workspaceName} ha sido rechazada.',
  },
  'transferResolved.subject.cancelled': {
    en: 'Transfer cancelled',
    es: 'Transferencia cancelada',
  },
  'transferResolved.title.cancelled': {
    en: 'Transfer Cancelled',
    es: 'Transferencia Cancelada',
  },
  'transferResolved.body.cancelled': {
    en: 'The transfer request for {ticketName} in {workspaceName} has been cancelled.',
    es: 'La solicitud de transferencia de {ticketName} en {workspaceName} ha sido cancelada.',
  },

  // Priorities
  'priority.low': { en: 'Low', es: 'Baja' },
  'priority.medium': { en: 'Medium', es: 'Media' },
  'priority.high': { en: 'High', es: 'Alta' },
  'priority.critical': { en: 'Critical', es: 'Crítica' },

  // Categories
  'category.bug': { en: 'Bug', es: 'Error' },
  'category.issue': { en: 'Issue', es: 'Incidencia' },
  'category.task': { en: 'Task', es: 'Tarea' },

  // Statuses
  'status.open': { en: 'Open', es: 'Abierto' },
  'status.pending': { en: 'Pending', es: 'Pendiente' },
  'status.in-progress': { en: 'In Progress', es: 'En progreso' },
  'status.resolved': { en: 'Resolved', es: 'Resuelto' },
  'status.discarded': { en: 'Discarded', es: 'Descartado' },

  // Upgrade available
  'upgradeAvailable.subject': {
    en: 'Open Helpdesk v{version} is available',
    es: 'Open Helpdesk v{version} esta disponible',
  },
  'upgradeAvailable.title': {
    en: 'Open Helpdesk v{version} is available',
    es: 'Open Helpdesk v{version} esta disponible',
  },
  'upgradeAvailable.body': {
    en: 'A new version of Open Helpdesk (v{version}) is available. Check the release notes for details on what\'s new.',
    es: 'Una nueva version de Open Helpdesk (v{version}) esta disponible. Revisa las notas de la version para mas detalles.',
  },
  'upgradeAvailable.button': {
    en: 'View Release',
    es: 'Ver Version',
  },
  'upgradeAvailable.disable': {
    en: 'You can disable upgrade notifications in Admin Settings.',
    es: 'Puedes desactivar las notificaciones de actualizacion en Configuracion de Administrador.',
  },

  // CSAT survey
  'csat.subject': {
    en: 'How was your experience?',
    es: '¿Cómo fue tu experiencia?',
  },
  'csat.title': {
    en: 'Your ticket has been resolved',
    es: 'Tu ticket ha sido resuelto',
  },
  'csat.body': {
    en: 'Your ticket {ticketName} has been resolved. We\'d love to hear your feedback.',
    es: 'Tu ticket {ticketName} ha sido resuelto. Nos encantaría conocer tu opinión.',
  },
  'csat.question': {
    en: 'How would you rate your experience?',
    es: '¿Cómo calificarías tu experiencia?',
  },
  'csat.good': { en: 'Good', es: 'Buena' },
  'csat.neutral': { en: 'Neutral', es: 'Neutral' },
  'csat.bad': { en: 'Bad', es: 'Mala' },
};

export function t(key: string, lang: string, vars?: Record<string, string>): string {
  const entry = translations[key];
  if (!entry) return key;

  let text = entry[lang] || entry['en'] || key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
  }

  return text;
}
