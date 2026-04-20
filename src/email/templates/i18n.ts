type Translations = Record<string, Record<string, string>>;

const appName = process.env.APP_NAME || 'Open Helpdesk';

const translations: Translations = {
  // Shared
  'email.header': {
    en: appName,
    es: appName,
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
    en: '{creatorName} created a new ticket in {workspaceName}.',
    es: '{creatorName} creó un nuevo ticket en {workspaceName}.',
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
  'newComment.title': {
    en: 'New Comment',
    es: 'Nuevo Comentario',
  },
  'newComment.subject': {
    en: 'New comment on',
    es: 'Nuevo comentario en',
  },
  'newComment.body': {
    en: '{authorName} commented on {ticketName}:',
    es: '{authorName} comentó en {ticketName}:',
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
  'status.pending': { en: 'Pending', es: 'Pendiente' },
  'status.in-progress': { en: 'In Progress', es: 'En progreso' },
  'status.resolved': { en: 'Resolved', es: 'Resuelto' },
  'status.closed': { en: 'Closed', es: 'Cerrado' },
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
